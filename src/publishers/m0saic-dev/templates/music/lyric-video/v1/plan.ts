import type {
  MosaicAssetManifest,
  MosaicDocument,
  MosaicMediaKind,
  MosaicSource,
  MosaicTextLayer,
  MosaicTextSource,
  MosaicTimedWord,
} from "@m0saic/types";
import { asAssetId } from "@m0saic/types";
import {
  resolveWordSpans,
  slugifyAssetKeyFromPath,
  wrapText,
  type WordSpan,
} from "@m0saic/template-utils";
import { placeRects, type PlaceRectsRect } from "@m0saic/dsl-stdlib";

/**
 * Pure planning math for @m0saic-dev/music/lyric-video/v1 — no ctx, no fs.
 *
 * The document shape mirrors the engine's proven BACKGROUND-AUDIO law
 * (packages/cli/test-templates/background-audio-leaf.mosaic): a VISIBLE base
 * layer (background media, else a lavfi color plate), lyric text bands
 * carved as real m0 cells above it (placeRects — never full-canvas overlay
 * positioning), and the song as an audio-only media source on the TOP
 * overlay leaf — the engine skips it from the video composite (its cell
 * paints nothing) while it contributes the mix.
 *
 * Every lyric line is ONE drawtext layer gated by an `overlay.enable` window
 * plus the structured `overlay.window` twin (they MUST agree — the engine
 * prefers `window` and trims the upstream chain to it, so off-window layers
 * cost nothing; perf rule R4). Layers are chunked across text sources at
 * {@link LAYERS_PER_TEXT_SOURCE} to stay inside drawtext's per-source
 * boundary budget (perf rule R5).
 */

export type LyricPosition = "top" | "middle" | "bottom";
export type LyricAlign = "left" | "center" | "right";
export type LyricRevealStyle = "cut" | "fade";

/** One renderable lyric window (an `ok` cue verdict, template-side shape). */
export type LyricWindow = {
  startMs: number;
  endMs: number;
  text: string;
  /** Word-level deepening (karaoke) — aligned to whitespace tokens. */
  words?: MosaicTimedWord[];
};

/** Drawtext boundary budget per text source (R5's ~80, with headroom). */
export const LAYERS_PER_TEXT_SOURCE = 60;

/** Alpha ramp length for the "fade" reveal (the dual-sub convention). */
export const REVEAL_FADE_SEC = 0.18;

export type LyricKaraokeMode = "off" | "highlight" | "dot";

export type LyricStyle = {
  position: LyricPosition;
  align: LyricAlign;
  /** Clamped multiplier over the base font size (0.5–2). */
  textScale: number;
  textColor: string;
  backgroundColor: string;
  revealStyle: LyricRevealStyle;
  /** Word-level karaoke rendering for word-timed lines. */
  karaoke: LyricKaraokeMode;
  karaokeColor: string;
  /** DEV: never block on unresolved timing — guess it (see bestEffortWindows
   *  / synthesizeWordSpans). */
  bestEffort: boolean;
};

const POSITIONS: readonly LyricPosition[] = ["top", "middle", "bottom"];
const ALIGNS: readonly LyricAlign[] = ["left", "center", "right"];
const REVEALS: readonly LyricRevealStyle[] = ["cut", "fade"];
const KARAOKES: readonly LyricKaraokeMode[] = ["off", "highlight", "dot"];

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

const isColorString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Resolve + clamp the style knobs (bad values fall back, never throw). */
export function resolveLyricStyle(props: {
  position?: unknown;
  align?: unknown;
  textScale?: unknown;
  textColor?: unknown;
  backgroundColor?: unknown;
  revealStyle?: unknown;
  karaoke?: unknown;
  karaokeColor?: unknown;
  bestEffortTiming?: unknown;
}): LyricStyle {
  const rawScale =
    typeof props.textScale === "number" && Number.isFinite(props.textScale) ? props.textScale : 1;
  return {
    position: pick(props.position, POSITIONS, "middle"),
    align: pick(props.align, ALIGNS, "center"),
    textScale: Math.min(2, Math.max(0.5, rawScale)),
    textColor: isColorString(props.textColor) ? props.textColor : "#FFFFFF",
    backgroundColor: isColorString(props.backgroundColor) ? props.backgroundColor : "#000000",
    revealStyle: pick(props.revealStyle, REVEALS, "fade"),
    karaoke: pick(props.karaoke, KARAOKES, "off"),
    karaokeColor: isColorString(props.karaokeColor) ? props.karaokeColor : "#FFC53D",
    bestEffort: props.bestEffortTiming === true,
  };
}

/** Base lyric font size in px: ~4.6% of canvas height × textScale. */
export function computeLyricFontPx(canvasH: number, textScale: number): number {
  return Math.max(14, Math.round(canvasH * 0.046 * textScale));
}

const sec = (ms: number) => (ms / 1000).toFixed(3);

/**
 * LAYOUT CONTRACT — no lyric line may paint outside its band (and so never
 * outside the frame). drawtext neither soft-wraps nor clips: a long line
 * renders straight off BOTH frame edges unless the plan pre-breaks it.
 * Every window therefore passes through {@link fitLyricWindows} before any
 * layer is minted:
 *   1. word-wrap at the base font into ≤ {@link MAX_LINES_PER_WINDOW} lines;
 *   2. still too wide/tall (or an unbreakable word wider than the band) →
 *      shrink THAT window's font down {@link FONT_SCALE_LADDER} (a per-layer
 *      `style.fontSize` override — every other lyric keeps its size);
 *   3. at the floor scale, hard-truncate with an ellipsis (pathological
 *      inputs only — a "line" no readable font could hold).
 * Width is estimated with the geometry-contract's measured conservative em
 * width (layoutConstraint.ts), so a fit computed here can only under-fill.
 */
export const LYRIC_CHAR_EM = 0.72;
/** Horizontal text padding inside the band, each side (band-width fraction). */
export const LYRIC_PAD_X_FRAC = 0.02;
/** The band is sized for this many stacked lines per window. */
export const MAX_LINES_PER_WINDOW = 2;
/** Per-window shrink ladder; the last entry is the floor before truncation. */
const FONT_SCALE_LADDER = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4] as const;
const MIN_LYRIC_FONT_PX = 10;

/** A window after the fit stage: LF-free lines, each inside the band. */
export type FittedLyricWindow = {
  startMs: number;
  endMs: number;
  lines: string[];
  /** Per-window font size (base size when no shrink was needed). */
  fontPx: number;
  /** Resolved word spans (karaoke) — set only when the cue's word timing
   *  resolved ok AND the fit didn't truncate (see buildLyricDocument). */
  wordSpans?: WordSpan[];
};

/** Character budget for one line of `fontPx` text inside `usablePx`. */
export function maxCharsForWidth(usablePx: number, fontPx: number): number {
  return Math.max(1, Math.floor(usablePx / (Math.max(1, fontPx) * LYRIC_CHAR_EM)));
}

export function fitLyricWindows(
  windows: LyricWindow[],
  args: { bandW: number; fontSizePx: number },
): FittedLyricWindow[] {
  const usable = args.bandW * (1 - 2 * LYRIC_PAD_X_FRAC);
  return windows.map((w) => {
    const authored = w.text.split("\n");
    for (const scale of FONT_SCALE_LADDER) {
      const fontPx = Math.max(MIN_LYRIC_FONT_PX, Math.round(args.fontSizePx * scale));
      const cap = maxCharsForWidth(usable, fontPx);
      const lines = authored.flatMap((l) => wrapText(l, cap));
      if (lines.length <= MAX_LINES_PER_WINDOW && lines.every((l) => l.length <= cap)) {
        return { startMs: w.startMs, endMs: w.endMs, lines, fontPx };
      }
    }
    const floorPx = Math.max(
      MIN_LYRIC_FONT_PX,
      Math.round(args.fontSizePx * FONT_SCALE_LADDER[FONT_SCALE_LADDER.length - 1]),
    );
    const cap = maxCharsForWidth(usable, floorPx);
    const wrapped = authored.flatMap((l) => wrapText(l, cap));
    const kept = wrapped.slice(0, MAX_LINES_PER_WINDOW);
    const lines = kept.map((l, i) => {
      const spills = l.length > cap || (i === kept.length - 1 && wrapped.length > kept.length);
      return spills ? `${l.slice(0, Math.max(1, cap - 1))}…` : l;
    });
    return { startMs: w.startMs, endMs: w.endMs, lines, fontPx: floorPx };
  });
}

/**
 * Even auto-timing for a fully-UNTIMED lyric set (the zero-input face):
 * lines spread contiguously across [leadInMs, durationMs - tailMs]. The
 * pads are LITERAL user knobs — no silence detection, no guessing; both
 * default to 0 (lyrics start immediately and run to the very end). A pad
 * pair that leaves less than 1ms per line is ignored entirely.
 */
export function autoTimeLyrics(
  texts: string[],
  args: { durationMs: number; leadInMs: number; tailMs: number },
): LyricWindow[] {
  const n = texts.length;
  if (n === 0) return [];
  const duration = Math.max(1, Math.round(args.durationMs));
  let lead = Math.min(Math.max(0, Math.round(args.leadInMs)), duration);
  let tail = Math.min(Math.max(0, Math.round(args.tailMs)), duration);
  if (duration - lead - tail < n) {
    lead = 0;
    tail = 0;
  }
  const span = duration - lead - tail;
  return texts.map((text, i) => ({
    text,
    startMs: lead + Math.round((i * span) / n),
    endMs: lead + Math.round(((i + 1) * span) / n),
  }));
}

/**
 * BEST-EFFORT TIMING (dev/debug, `bestEffortTiming: true`): never block a
 * render on unresolved timing — guess it instead of showing the guidance
 * card. Untimed (and inverted — a mis-tap) lines are spread evenly into
 * the gaps between their TIMED neighbors: each run of guessable lines
 * between anchors divides `[prevAnchor.start, nextAnchor.start]` into
 * run+1 slots (the anchor keeps the first); a leading run spreads from
 * `leadInMs`, a trailing run toward `durationMs − tailMs`. Explicit ends
 * survive when sane; everything else runs to the next line. Lines at/past
 * the duration are still skipped (the outside law).
 */
export function bestEffortWindows(
  cues: Array<{ text: string; startMs?: number; endMs?: number; words?: MosaicTimedWord[] }>,
  opts: { durationMs: number; leadInMs: number; tailMs: number },
): LyricWindow[] {
  const dur = Math.max(1, Math.round(opts.durationMs));
  const lead = Math.min(Math.max(0, Math.round(opts.leadInMs)), dur);
  const tailBound = Math.max(lead + 1, dur - Math.max(0, Math.round(opts.tailMs)));

  const inside = cues.filter((c) => !(typeof c.startMs === "number" && c.startMs >= dur));
  const starts: number[] = new Array(inside.length);
  let i = 0;
  let prevBound = lead;
  while (i < inside.length) {
    if (typeof inside[i].startMs === "number") {
      starts[i] = Math.max(0, inside[i].startMs as number);
      prevBound = starts[i];
      i++;
      continue;
    }
    // A run of guessable lines: find its end (the next timed anchor).
    let j = i;
    while (j < inside.length && typeof inside[j].startMs !== "number") j++;
    const nextBound = j < inside.length ? Math.max(0, inside[j].startMs as number) : tailBound;
    const run = j - i;
    const hasPrevAnchor = i > 0;
    // With a preceding anchor the anchor keeps the first slot; a leading
    // run divides its whole range.
    const slots = hasPrevAnchor ? run + 1 : run;
    const span = Math.max(1, nextBound - prevBound);
    for (let k = 0; k < run; k++) {
      const slot = hasPrevAnchor ? k + 1 : k;
      starts[i + k] = Math.round(prevBound + (slot * span) / Math.max(1, slots));
    }
    i = j;
    prevBound = nextBound;
  }

  const windows: LyricWindow[] = [];
  for (let k = 0; k < inside.length; k++) {
    const startMs = Math.min(starts[k], dur - 1);
    const nextStart = k + 1 < inside.length ? starts[k + 1] : dur;
    const explicit = inside[k].endMs;
    let endMs =
      typeof explicit === "number" && explicit > startMs ? Math.min(explicit, dur) : Math.min(nextStart, dur);
    // An inverted mis-tap can still produce a degenerate window — hold it
    // a beat instead of dropping the line (this mode never hides lines).
    if (endMs <= startMs) endMs = Math.min(startMs + 1000, dur);
    windows.push({
      startMs,
      endMs,
      text: inside[k].text,
      ...(inside[k].words !== undefined ? { words: inside[k].words } : {}),
    });
  }
  return windows;
}

/** Char-proportional word spans across the first ~85% of a line's window
 *  (the review-script demo law, canonicalized for `bestEffortTiming`). */
export function synthesizeWordSpans(
  text: string,
  window: { startMs: number; endMs: number },
): WordSpan[] {
  const tokens = text.trim().split(/\s+/).filter((t) => t !== "");
  if (tokens.length === 0) return [];
  const usable = Math.max(1, (window.endMs - window.startMs) * 0.85);
  const totalChars = tokens.reduce((s, t) => s + t.length, 0) || 1;
  let at = window.startMs;
  return tokens.map((t) => {
    const span = Math.max(80, Math.round((t.length / totalChars) * usable));
    const startMs = Math.min(at, window.endMs - 1);
    const endMs = Math.min(startMs + span, window.endMs);
    at = endMs;
    return { text: t, startMs, endMs };
  });
}

/**
 * Chunk fitted windows so each chunk's total LAYER count (one per visual
 * line) stays ≤ {@link LAYERS_PER_TEXT_SOURCE}; a window's lines never
 * straddle a chunk boundary. Chunking depends only on line counts, so the
 * layout can size itself off the chunk count before any layer exists.
 */
export function chunkLyricWindows(
  windows: FittedLyricWindow[],
  layerCountOf: (w: FittedLyricWindow) => number = (w) => w.lines.length,
): FittedLyricWindow[][] {
  const chunks: FittedLyricWindow[][] = [];
  let current: FittedLyricWindow[] = [];
  let layers = 0;
  for (const w of windows) {
    const n = layerCountOf(w);
    if (layers > 0 && layers + n > LAYERS_PER_TEXT_SOURCE) {
      chunks.push(current);
      current = [];
      layers = 0;
    }
    current.push(w);
    layers += n;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * NEVER hand drawtext a newline: current ffmpeg builds render the LF itself
 * as a tofu box. Each fitted line is its own single-line layer, stacked
 * upward from the band bottom via per-line padding (the dual-sub idiom).
 */
function lineLayers(
  lines: string[],
  hAlign: LyricAlign,
  lineHFrac: number,
  overlay: MosaicTextLayer["overlay"],
  style?: MosaicTextLayer["style"],
): MosaicTextLayer[] {
  return lines.map((line, i) => ({
    content: { kind: "literal" as const, text: line },
    placement: {
      hAlign,
      vAlign: "bottom" as const,
      padding: { x: LYRIC_PAD_X_FRAC, y: 0.06 + (lines.length - 1 - i) * lineHFrac },
    },
    overlay,
    ...(style ? { style } : {}),
  }));
}

/**
 * KARAOKE RENDERING — the alignment trick that makes it cheap and exact:
 * drawtext can't color part of one layer, but two layers with the SAME
 * font, size, and LEFT anchor render glyph-identical advances — so a
 * PREFIX of the line (words 0..k, accent color) painted over the base
 * line covers exactly its first k words. Highlight mode emits one prefix
 * layer per word, enabled [wordStart_k, lineEnd) with an alpha ramp over
 * the word's own span ("highlights for as long as you sing it"); later
 * prefixes repaint identical pixels over earlier ones, so only the NEW
 * word visibly fills. Dot mode emits ONE layer per visual line whose
 * xExpr steps across estimated word centers with a sinusoidal hop.
 *
 * Karaoke lines are LEFT-anchored at a per-line pad that centers the
 * estimated line width ({@link KARAOKE_CENTER_EM} — a NEUTRAL estimate,
 * unlike the fit contract's conservative 0.72: a centering miss splits
 * both ways, while prefix/base alignment is exact regardless because
 * they share the anchor).
 */
export const KARAOKE_CENTER_EM = 0.55;
/** Dot glyph scale relative to the line font. */
const DOT_FONT_FRAC = 0.6;

/** Left inset (band-width fraction) that centers an estimated line. */
function karaokePadX(
  lineChars: number,
  fontPx: number,
  bandW: number,
  align: LyricAlign,
): { padX: number; lineFrac: number } {
  const lineFrac = Math.min(0.96, (lineChars * fontPx * KARAOKE_CENTER_EM) / bandW);
  const padX =
    align === "left"
      ? LYRIC_PAD_X_FRAC
      : align === "right"
        ? Math.max(LYRIC_PAD_X_FRAC, 1 - LYRIC_PAD_X_FRAC - lineFrac)
        : Math.max(LYRIC_PAD_X_FRAC, (1 - lineFrac) / 2);
  return { padX, lineFrac };
}

/** Distribute a window's word spans across its wrapped visual lines.
 *  Returns null when the fit's tokens no longer match the spans (e.g.
 *  ellipsis truncation) — callers fall back to plain line rendering. */
export function mapSpansToLines(
  lines: readonly string[],
  spans: readonly WordSpan[],
): WordSpan[][] | null {
  const perLine: WordSpan[][] = [];
  let cursor = 0;
  for (const line of lines) {
    const count = line.trim().split(/\s+/).filter((t) => t !== "").length;
    perLine.push(spans.slice(cursor, cursor + count) as WordSpan[]);
    cursor += count;
  }
  if (cursor !== spans.length) return null;
  return perLine;
}

/** Karaoke layers for ONE window (base lines + highlight prefixes or dot). */
function karaokeWindowLayers(
  w: FittedLyricWindow,
  spansPerLine: WordSpan[][],
  opts: {
    mode: Exclude<LyricKaraokeMode, "off">;
    align: LyricAlign;
    revealStyle: LyricRevealStyle;
    bandH: number;
    bandW: number;
    baseFontPx: number;
    karaokeColor: string;
  },
): MosaicTextLayer[] {
  const layers: MosaicTextLayer[] = [];
  const lineHFrac = Math.round(w.fontPx * 1.3) / Math.max(1, opts.bandH);
  const style = w.fontPx !== opts.baseFontPx ? { fontSize: w.fontPx } : undefined;
  const lineWindow: MosaicTextLayer["overlay"] = {
    enable: `between(t,${sec(w.startMs)},${sec(w.endMs)})`,
    window: { startSec: Number(sec(w.startMs)), endSec: Number(sec(w.endMs)) },
    ...(opts.revealStyle === "fade"
      ? { alpha: `min(1,max(0,(t-${sec(w.startMs)})/${REVEAL_FADE_SEC}))` }
      : {}),
  };

  w.lines.forEach((line, v) => {
    const tokens = line.trim().split(/\s+/).filter((t) => t !== "");
    const spans = spansPerLine[v];
    const { padX, lineFrac } = karaokePadX(line.length, w.fontPx, opts.bandW, opts.align);
    const padY = 0.06 + (w.lines.length - 1 - v) * lineHFrac;
    // CONSTANT-y anchor: bottom-anchored drawtext positions by text_h,
    // which depends on the GLYPHS PRESENT — a prefix without descenders
    // gets a smaller box and lands lower than its base line. A plain
    // constant y (measured empirically: drawtext tops align across
    // descender differences at a fixed y; ascent/descent identifiers
    // are CONTENT-dependent in this build and re-introduce the drift)
    // makes base + every prefix share the anchor exactly. Residual
    // caveat: a capital appearing later in the line than the prefix
    // covers shifts ~2-4px — rare in lyrics (first words carry the
    // capitals) and cosmetic. Comma-free (filtergraph-inlined).
    const yTopPx = Math.round(opts.bandH - padY * opts.bandH - w.fontPx * 1.25);
    const anchor = {
      hAlign: "left" as const,
      vAlign: "bottom" as const,
      padding: { x: padX, y: padY },
      yExpr: `${Math.max(0, yTopPx)}`,
    };

    // Base line (textColor), left-anchored so the prefixes align exactly.
    layers.push({
      content: { kind: "literal" as const, text: line },
      placement: anchor,
      overlay: lineWindow,
      ...(style ? { style } : {}),
    });

    if (spans.length === 0) return;
    const lineEndSec = sec(w.endMs);

    if (opts.mode === "highlight") {
      // One prefix per word: enabled from the word's start to the line
      // end (cumulative repaint), alpha ramping over the WORD's span.
      for (let k = 0; k < tokens.length; k++) {
        const span = spans[k];
        const durSec = Math.max(0.05, (span.endMs - span.startMs) / 1000);
        layers.push({
          content: { kind: "literal" as const, text: tokens.slice(0, k + 1).join(" ") },
          placement: anchor,
          overlay: {
            enable: `between(t,${sec(span.startMs)},${lineEndSec})`,
            window: { startSec: Number(sec(span.startMs)), endSec: Number(lineEndSec) },
            alpha: `min(1,max(0,(t-${sec(span.startMs)})/${durSec.toFixed(3)}))`,
          },
          style: { ...(style ?? {}), fontColor: opts.karaokeColor } as MosaicTextLayer["style"],
        });
      }
      return;
    }

    // Dot mode: one layer PER WORD, parked at the word's estimated center
    // and held until the next word starts, with a sinusoidal bob. The
    // placement exprs must stay COMMA-FREE: the engine escapes
    // `overlay.enable` expressions but inlines placement exprs into the
    // filtergraph verbatim, so a comma (any if()/lt() call) kills the
    // graph — static per-word x + a pure-arithmetic y is the safe shape.
    let chars = 0;
    const centers = tokens.map((t) => {
      const c = (chars + t.length / 2) / Math.max(1, line.length);
      chars += t.length + 1;
      return Math.min(1, c);
    });
    const dotFont = Math.max(10, Math.round(w.fontPx * DOT_FONT_FRAC));
    const yBase = `h-${padY.toFixed(4)}*h-${Math.round(w.fontPx * 1.35)}`;
    for (let k = 0; k < spans.length; k++) {
      const holdEndMs = spans[k + 1]?.startMs ?? spans[k].endMs;
      layers.push({
        content: { kind: "literal" as const, text: "●" },
        placement: {
          hAlign: "left" as const,
          vAlign: "bottom" as const,
          padding: { x: padX, y: padY },
          xExpr: `w*${(padX + lineFrac * centers[k]).toFixed(4)}-text_w/2`,
          yExpr: `${yBase}-${Math.round(w.fontPx * 0.2)}*abs(sin(3.14159*2*t))`,
        },
        overlay: {
          enable: `between(t,${sec(spans[k].startMs)},${sec(holdEndMs)})`,
          window: {
            startSec: Number(sec(spans[k].startMs)),
            endSec: Number(sec(holdEndMs)),
          },
        },
        style: { fontSize: dotFont, fontColor: opts.karaokeColor } as MosaicTextLayer["style"],
      });
    }
  });
  return layers;
}

/** Layer count one window contributes (chunk budgeting must match what
 *  buildLyricLayers will actually emit). */
export function windowLayerCount(w: FittedLyricWindow, mode: LyricKaraokeMode): number {
  if (mode === "off" || !w.wordSpans) return w.lines.length;
  // highlight: one prefix per word; dot: one dot per word.
  return w.lines.length + w.wordSpans.length;
}

/** One chunk's drawtext layers, each line gated to its window. */
export function buildLyricLayers(
  windows: FittedLyricWindow[],
  opts: {
    align: LyricAlign;
    revealStyle: LyricRevealStyle;
    /** Band height in px — per-window line stacking fractions derive from it. */
    bandH: number;
    /** Band width in px — karaoke centering estimates derive from it. */
    bandW?: number;
    /** The source-level font size; a window matching it needs no override. */
    baseFontPx: number;
    karaoke?: LyricKaraokeMode;
    karaokeColor?: string;
  },
): MosaicTextLayer[] {
  const layers: MosaicTextLayer[] = [];
  const karaokeMode = opts.karaoke ?? "off";
  for (const w of windows) {
    if (karaokeMode !== "off" && w.wordSpans && typeof opts.bandW === "number") {
      const spansPerLine = mapSpansToLines(w.lines, w.wordSpans);
      if (spansPerLine !== null) {
        layers.push(
          ...karaokeWindowLayers(w, spansPerLine, {
            mode: karaokeMode,
            align: opts.align,
            revealStyle: opts.revealStyle,
            bandH: opts.bandH,
            bandW: opts.bandW,
            baseFontPx: opts.baseFontPx,
            karaokeColor: opts.karaokeColor ?? "#FFC53D",
          }),
        );
        continue;
      }
    }
    const startSec = Number(sec(w.startMs));
    const endSec = Number(sec(w.endMs));
    const overlay: MosaicTextLayer["overlay"] = {
      // The enable string and the structured window MUST describe the same
      // window (source.ts law) — both minted from the same rounded seconds.
      enable: `between(t,${sec(w.startMs)},${sec(w.endMs)})`,
      window: { startSec, endSec },
      ...(opts.revealStyle === "fade"
        ? { alpha: `min(1,max(0,(t-${sec(w.startMs)})/${REVEAL_FADE_SEC}))` }
        : {}),
    };
    const lineHFrac = Math.round(w.fontPx * 1.3) / Math.max(1, opts.bandH);
    const style = w.fontPx !== opts.baseFontPx ? { fontSize: w.fontPx } : undefined;
    layers.push(...lineLayers(w.lines, opts.align, lineHFrac, overlay, style));
  }
  return layers;
}

export type LyricSlot = { kind: "base" } | { kind: "lyrics"; chunk: number } | { kind: "audio" };

export type LyricLayout = {
  m0: string;
  /** Slot ids in m0 F-slot (source array) order. */
  slotOrder: LyricSlot[];
  band: { x: number; y: number; w: number; h: number };
  fontSizePx: number;
  lineHFrac: number;
};

const SNAP = 4;
const snap = (v: number) => Math.max(SNAP, Math.round(v / SNAP) * SNAP);

export type LyricBandGeometry = {
  band: { x: number; y: number; w: number; h: number };
  fontSizePx: number;
  lineHFrac: number;
};

/** Chunk-independent band geometry — the fit stage needs it BEFORE chunking. */
export function computeLyricBandGeometry(args: {
  canvasW: number;
  canvasH: number;
  position: LyricPosition;
  textScale: number;
}): LyricBandGeometry {
  const W = Math.round(args.canvasW);
  const H = Math.round(args.canvasH);
  const fontSizePx = computeLyricFontPx(H, args.textScale);
  const lineH = Math.round(fontSizePx * 1.3);

  const sideMargin = snap(W * 0.08);
  const bandW = W - 2 * sideMargin;
  const bandH = snap(2 * lineH + fontSizePx * 0.5);
  const safe = snap(H * 0.08);
  const bandY =
    args.position === "top"
      ? safe
      : args.position === "bottom"
        ? H - safe - bandH
        : snap((H - bandH) / 2);

  return {
    band: { x: sideMargin, y: bandY, w: bandW, h: bandH },
    fontSizePx,
    lineHFrac: lineH / bandH,
  };
}

/**
 * Real-geometry layout: full-frame base (importance 0), one band rect per
 * text chunk (identical rects, ascending importance → deterministic layer
 * split), and a full-frame audio leaf on top.
 */
export function buildLyricLayout(args: {
  canvasW: number;
  canvasH: number;
  position: LyricPosition;
  textScale: number;
  chunkCount: number;
}): LyricLayout {
  const W = Math.round(args.canvasW);
  const H = Math.round(args.canvasH);
  const { band, fontSizePx, lineHFrac } = computeLyricBandGeometry(args);

  const order: LyricSlot[] = [{ kind: "base" }];
  for (let i = 0; i < args.chunkCount; i++) order.push({ kind: "lyrics", chunk: i });
  order.push({ kind: "audio" });

  const rects: PlaceRectsRect[] = order.map((slot, i) => ({
    ...(slot.kind === "lyrics" ? band : { x: 0, y: 0, w: W, h: H }),
    // Distinct ascending importance: base below, lyric chunks in order,
    // the (invisible) audio leaf on the very top overlay layer.
    importance: i,
  }));

  const placed = placeRects({ rootW: W, rootH: H, rects });

  const slotOrder: LyricSlot[] = [];
  for (const layer of placed.layers) {
    const sorted = [...layer.rectIndices].sort(
      (a, b) => rects[a].y - rects[b].y || rects[a].x - rects[b].x || a - b,
    );
    for (const idx of sorted) slotOrder.push(order[idx]);
  }

  return {
    m0: String(placed.m0),
    slotOrder,
    band,
    fontSizePx,
    lineHFrac,
  };
}

export type LyricDocumentArgs = {
  canvasW: number;
  canvasH: number;
  fps: number;
  /** Authored output duration (already resolved — follow-the-song, D6). */
  durationMs: number;
  song: { path: string; assetMediaType: MosaicMediaKind };
  background?: { path: string; mediaType: "video" | "image"; durationMs?: number };
  windows: LyricWindow[];
  style: LyricStyle;
};

/** Assemble the full lyric-video document (deterministic, JSON-safe). */
export function buildLyricDocument(args: LyricDocumentArgs): MosaicDocument {
  // Fit BEFORE chunking: wrapping can raise a window's line count, and the
  // chunk budget counts lines. Band geometry is chunk-independent, so the
  // fit stage can use it up front.
  const geometry = computeLyricBandGeometry({
    canvasW: args.canvasW,
    canvasH: args.canvasH,
    position: args.style.position,
    textScale: args.style.textScale,
  });
  const fitted = fitLyricWindows(args.windows, {
    bandW: geometry.band.w,
    fontSizePx: geometry.fontSizePx,
  });
  // Karaoke: resolve each window's word spans against its OWN window and
  // attach them to the fitted twin (same index — fit preserves order).
  // A failed resolution (no words / mismatch / untimed / inverted) just
  // leaves the window on plain line rendering.
  if (args.style.karaoke !== "off") {
    args.windows.forEach((w, i) => {
      const spans = resolveWordSpans(w, { startMs: w.startMs, endMs: w.endMs });
      const resolved = spans.ok
        ? spans.words
        : args.style.bestEffort
          ? // DEV best-effort: a window with missing/broken word timing
            // still gets karaoke — char-proportional synthesis.
            synthesizeWordSpans(w.text, { startMs: w.startMs, endMs: w.endMs })
          : null;
      if (resolved && resolved.length > 0 && mapSpansToLines(fitted[i].lines, resolved) !== null) {
        fitted[i].wordSpans = resolved;
      }
    });
  }
  const windowChunks = chunkLyricWindows(fitted, (w) =>
    windowLayerCount(w, args.style.karaoke),
  );
  // render() guards windows non-empty; the max(1) keeps this total anyway
  // (an empty chunk yields an empty text source in a carved band).
  const chunkCount = Math.max(1, windowChunks.length);
  const layout = buildLyricLayout({
    canvasW: args.canvasW,
    canvasH: args.canvasH,
    position: args.style.position,
    textScale: args.style.textScale,
    chunkCount,
  });

  const songAssetId = asAssetId(slugifyAssetKeyFromPath(args.song.path));
  const assetEntries: Record<string, { kind: "file"; path: string; mediaType: MosaicMediaKind }> = {
    [songAssetId as unknown as string]: {
      kind: "file",
      path: args.song.path,
      mediaType: args.song.assetMediaType,
    },
  };

  let baseSource: MosaicSource;
  if (args.background) {
    const bgAssetId = asAssetId(slugifyAssetKeyFromPath(args.background.path));
    assetEntries[bgAssetId as unknown as string] = {
      kind: "file",
      path: args.background.path,
      mediaType: args.background.mediaType,
    };
    const bgShorter =
      args.background.mediaType === "video" &&
      typeof args.background.durationMs === "number" &&
      args.background.durationMs > 0 &&
      args.background.durationMs < args.durationMs;
    baseSource = {
      type: "media",
      mediaType: args.background.mediaType,
      assetId: bgAssetId,
      placement: { fit: "cover" },
      // A background clip shorter than the song loops instead of freezing.
      ...(bgShorter
        ? {
            playback: {
              clipStartMs: 0,
              clipDurationMs: args.background.durationMs,
              loopMode: "loop",
            },
          }
        : {}),
      audio: { enabled: false },
      editor: { owner: "template", label: "lyric:background" },
    } as MosaicSource;
  } else {
    baseSource = {
      type: "lavfi",
      color: args.style.backgroundColor,
      fitMode: "cover",
      editor: { owner: "template", label: "lyric:backdrop" },
    } as unknown as MosaicSource;
  }

  const slotMinSide = Math.min(layout.band.w, layout.band.h);
  const borderWidth = Math.min(0.05, 2.5 / Math.max(1, slotMinSide));
  const layerOpts = {
    align: args.style.align,
    revealStyle: args.style.revealStyle,
    bandH: layout.band.h,
    bandW: layout.band.w,
    baseFontPx: layout.fontSizePx,
    karaoke: args.style.karaoke,
    karaokeColor: args.style.karaokeColor,
  };
  const textSources: MosaicTextSource[] = [];
  for (let i = 0; i < chunkCount; i++) {
    textSources.push({
      type: "text",
      renderMode: { kind: "video" },
      visual: { backgroundColor: "none" },
      style: {
        fontSize: layout.fontSizePx,
        fontColor: args.style.textColor,
        borderColor: "#000000",
        borderWidth,
      },
      layers: buildLyricLayers(windowChunks[i] ?? [], layerOpts),
      editor: {
        owner: "template",
        label: chunkCount > 1 ? `lyric:lines-${i + 1}` : "lyric:lines",
      },
    } as MosaicTextSource);
  }

  const audioSource: MosaicSource = {
    type: "media",
    // MANDATORY even for real audio files: an mp3 with ID3 cover art probes
    // hasVideo:true and would otherwise enter the video composite — the
    // source-level declaration makes the engine take ONLY its audio
    // (background-audio-leaf law).
    mediaType: "audio",
    assetId: songAssetId,
    audio: { enabled: true, volume: 1 },
    editor: { owner: "template", label: "lyric:song" },
  } as MosaicSource;

  const slotSource = (slot: LyricSlot): MosaicSource =>
    slot.kind === "base" ? baseSource : slot.kind === "audio" ? audioSource : textSources[slot.chunk];

  return {
    kind: "mosaic_document",
    version: 1,
    m0: layout.m0,
    fps: args.fps,
    durationMs: args.durationMs,
    size: { width: Math.round(args.canvasW), height: Math.round(args.canvasH) },
    backgroundColor: args.style.backgroundColor,
    assets: assetEntries as unknown as MosaicAssetManifest,
    sources: layout.slotOrder.map(slotSource),
  } as unknown as MosaicDocument;
}
