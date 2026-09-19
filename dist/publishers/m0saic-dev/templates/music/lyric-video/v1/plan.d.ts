import type { MosaicDocument, MosaicMediaKind, MosaicTextLayer, MosaicTimedWord } from "@m0saic/types";
import { type WordSpan } from "@m0saic/template-utils";
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
export declare const LAYERS_PER_TEXT_SOURCE = 60;
/** Alpha ramp length for the "fade" reveal (the dual-sub convention). */
export declare const REVEAL_FADE_SEC = 0.18;
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
/** Resolve + clamp the style knobs (bad values fall back, never throw). */
export declare function resolveLyricStyle(props: {
    position?: unknown;
    align?: unknown;
    textScale?: unknown;
    textColor?: unknown;
    backgroundColor?: unknown;
    revealStyle?: unknown;
    karaoke?: unknown;
    karaokeColor?: unknown;
    bestEffortTiming?: unknown;
}): LyricStyle;
/** Base lyric font size in px: ~4.6% of canvas height × textScale. */
export declare function computeLyricFontPx(canvasH: number, textScale: number): number;
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
export declare const LYRIC_CHAR_EM = 0.72;
/** Horizontal text padding inside the band, each side (band-width fraction). */
export declare const LYRIC_PAD_X_FRAC = 0.02;
/** The band is sized for this many stacked lines per window. */
export declare const MAX_LINES_PER_WINDOW = 2;
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
export declare function maxCharsForWidth(usablePx: number, fontPx: number): number;
export declare function fitLyricWindows(windows: LyricWindow[], args: {
    bandW: number;
    fontSizePx: number;
}): FittedLyricWindow[];
/**
 * Even auto-timing for a fully-UNTIMED lyric set (the zero-input face):
 * lines spread contiguously across [leadInMs, durationMs - tailMs]. The
 * pads are LITERAL user knobs — no silence detection, no guessing; both
 * default to 0 (lyrics start immediately and run to the very end). A pad
 * pair that leaves less than 1ms per line is ignored entirely.
 */
export declare function autoTimeLyrics(texts: string[], args: {
    durationMs: number;
    leadInMs: number;
    tailMs: number;
}): LyricWindow[];
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
export declare function bestEffortWindows(cues: Array<{
    text: string;
    startMs?: number;
    endMs?: number;
    words?: MosaicTimedWord[];
}>, opts: {
    durationMs: number;
    leadInMs: number;
    tailMs: number;
}): LyricWindow[];
/** Char-proportional word spans across the first ~85% of a line's window
 *  (the review-script demo law, canonicalized for `bestEffortTiming`). */
export declare function synthesizeWordSpans(text: string, window: {
    startMs: number;
    endMs: number;
}): WordSpan[];
/**
 * Chunk fitted windows so each chunk's total LAYER count (one per visual
 * line) stays ≤ {@link LAYERS_PER_TEXT_SOURCE}; a window's lines never
 * straddle a chunk boundary. Chunking depends only on line counts, so the
 * layout can size itself off the chunk count before any layer exists.
 */
export declare function chunkLyricWindows(windows: FittedLyricWindow[], layerCountOf?: (w: FittedLyricWindow) => number): FittedLyricWindow[][];
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
export declare const KARAOKE_CENTER_EM = 0.55;
/** Distribute a window's word spans across its wrapped visual lines.
 *  Returns null when the fit's tokens no longer match the spans (e.g.
 *  ellipsis truncation) — callers fall back to plain line rendering. */
export declare function mapSpansToLines(lines: readonly string[], spans: readonly WordSpan[]): WordSpan[][] | null;
/** Layer count one window contributes (chunk budgeting must match what
 *  buildLyricLayers will actually emit). */
export declare function windowLayerCount(w: FittedLyricWindow, mode: LyricKaraokeMode): number;
/** One chunk's drawtext layers, each line gated to its window. */
export declare function buildLyricLayers(windows: FittedLyricWindow[], opts: {
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
}): MosaicTextLayer[];
export type LyricSlot = {
    kind: "base";
} | {
    kind: "lyrics";
    chunk: number;
} | {
    kind: "audio";
};
export type LyricLayout = {
    m0: string;
    /** Slot ids in m0 F-slot (source array) order. */
    slotOrder: LyricSlot[];
    band: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    fontSizePx: number;
    lineHFrac: number;
};
export type LyricBandGeometry = {
    band: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    fontSizePx: number;
    lineHFrac: number;
};
/** Chunk-independent band geometry — the fit stage needs it BEFORE chunking. */
export declare function computeLyricBandGeometry(args: {
    canvasW: number;
    canvasH: number;
    position: LyricPosition;
    textScale: number;
}): LyricBandGeometry;
/**
 * Real-geometry layout: full-frame base (importance 0), one band rect per
 * text chunk (identical rects, ascending importance → deterministic layer
 * split), and a full-frame audio leaf on top.
 */
export declare function buildLyricLayout(args: {
    canvasW: number;
    canvasH: number;
    position: LyricPosition;
    textScale: number;
    chunkCount: number;
}): LyricLayout;
export type LyricDocumentArgs = {
    canvasW: number;
    canvasH: number;
    fps: number;
    /** Authored output duration (already resolved — follow-the-song, D6). */
    durationMs: number;
    song: {
        path: string;
        assetMediaType: MosaicMediaKind;
    };
    background?: {
        path: string;
        mediaType: "video" | "image";
        durationMs?: number;
    };
    windows: LyricWindow[];
    style: LyricStyle;
};
/** Assemble the full lyric-video document (deterministic, JSON-safe). */
export declare function buildLyricDocument(args: LyricDocumentArgs): MosaicDocument;
