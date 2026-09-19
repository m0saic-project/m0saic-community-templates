"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KARAOKE_CENTER_EM = exports.MAX_LINES_PER_WINDOW = exports.LYRIC_PAD_X_FRAC = exports.LYRIC_CHAR_EM = exports.REVEAL_FADE_SEC = exports.LAYERS_PER_TEXT_SOURCE = void 0;
exports.resolveLyricStyle = resolveLyricStyle;
exports.computeLyricFontPx = computeLyricFontPx;
exports.maxCharsForWidth = maxCharsForWidth;
exports.fitLyricWindows = fitLyricWindows;
exports.autoTimeLyrics = autoTimeLyrics;
exports.bestEffortWindows = bestEffortWindows;
exports.synthesizeWordSpans = synthesizeWordSpans;
exports.chunkLyricWindows = chunkLyricWindows;
exports.mapSpansToLines = mapSpansToLines;
exports.windowLayerCount = windowLayerCount;
exports.buildLyricLayers = buildLyricLayers;
exports.computeLyricBandGeometry = computeLyricBandGeometry;
exports.buildLyricLayout = buildLyricLayout;
exports.buildLyricDocument = buildLyricDocument;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
/** Drawtext boundary budget per text source (R5's ~80, with headroom). */
exports.LAYERS_PER_TEXT_SOURCE = 60;
/** Alpha ramp length for the "fade" reveal (the dual-sub convention). */
exports.REVEAL_FADE_SEC = 0.18;
const POSITIONS = ["top", "middle", "bottom"];
const ALIGNS = ["left", "center", "right"];
const REVEALS = ["cut", "fade"];
const KARAOKES = ["off", "highlight", "dot"];
const pick = (value, allowed, fallback) => typeof value === "string" && allowed.includes(value)
    ? value
    : fallback;
const isColorString = (v) => typeof v === "string" && v.trim() !== "";
/** Resolve + clamp the style knobs (bad values fall back, never throw). */
function resolveLyricStyle(props) {
    const rawScale = typeof props.textScale === "number" && Number.isFinite(props.textScale) ? props.textScale : 1;
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
function computeLyricFontPx(canvasH, textScale) {
    return Math.max(14, Math.round(canvasH * 0.046 * textScale));
}
const sec = (ms) => (ms / 1000).toFixed(3);
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
exports.LYRIC_CHAR_EM = 0.72;
/** Horizontal text padding inside the band, each side (band-width fraction). */
exports.LYRIC_PAD_X_FRAC = 0.02;
/** The band is sized for this many stacked lines per window. */
exports.MAX_LINES_PER_WINDOW = 2;
/** Per-window shrink ladder; the last entry is the floor before truncation. */
const FONT_SCALE_LADDER = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
const MIN_LYRIC_FONT_PX = 10;
/** Character budget for one line of `fontPx` text inside `usablePx`. */
function maxCharsForWidth(usablePx, fontPx) {
    return Math.max(1, Math.floor(usablePx / (Math.max(1, fontPx) * exports.LYRIC_CHAR_EM)));
}
function fitLyricWindows(windows, args) {
    const usable = args.bandW * (1 - 2 * exports.LYRIC_PAD_X_FRAC);
    return windows.map((w) => {
        const authored = w.text.split("\n");
        for (const scale of FONT_SCALE_LADDER) {
            const fontPx = Math.max(MIN_LYRIC_FONT_PX, Math.round(args.fontSizePx * scale));
            const cap = maxCharsForWidth(usable, fontPx);
            const lines = authored.flatMap((l) => (0, template_utils_1.wrapText)(l, cap));
            if (lines.length <= exports.MAX_LINES_PER_WINDOW && lines.every((l) => l.length <= cap)) {
                return { startMs: w.startMs, endMs: w.endMs, lines, fontPx };
            }
        }
        const floorPx = Math.max(MIN_LYRIC_FONT_PX, Math.round(args.fontSizePx * FONT_SCALE_LADDER[FONT_SCALE_LADDER.length - 1]));
        const cap = maxCharsForWidth(usable, floorPx);
        const wrapped = authored.flatMap((l) => (0, template_utils_1.wrapText)(l, cap));
        const kept = wrapped.slice(0, exports.MAX_LINES_PER_WINDOW);
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
function autoTimeLyrics(texts, args) {
    const n = texts.length;
    if (n === 0)
        return [];
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
function bestEffortWindows(cues, opts) {
    const dur = Math.max(1, Math.round(opts.durationMs));
    const lead = Math.min(Math.max(0, Math.round(opts.leadInMs)), dur);
    const tailBound = Math.max(lead + 1, dur - Math.max(0, Math.round(opts.tailMs)));
    const inside = cues.filter((c) => !(typeof c.startMs === "number" && c.startMs >= dur));
    const starts = new Array(inside.length);
    let i = 0;
    let prevBound = lead;
    while (i < inside.length) {
        if (typeof inside[i].startMs === "number") {
            starts[i] = Math.max(0, inside[i].startMs);
            prevBound = starts[i];
            i++;
            continue;
        }
        // A run of guessable lines: find its end (the next timed anchor).
        let j = i;
        while (j < inside.length && typeof inside[j].startMs !== "number")
            j++;
        const nextBound = j < inside.length ? Math.max(0, inside[j].startMs) : tailBound;
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
    const windows = [];
    for (let k = 0; k < inside.length; k++) {
        const startMs = Math.min(starts[k], dur - 1);
        const nextStart = k + 1 < inside.length ? starts[k + 1] : dur;
        const explicit = inside[k].endMs;
        let endMs = typeof explicit === "number" && explicit > startMs ? Math.min(explicit, dur) : Math.min(nextStart, dur);
        // An inverted mis-tap can still produce a degenerate window — hold it
        // a beat instead of dropping the line (this mode never hides lines).
        if (endMs <= startMs)
            endMs = Math.min(startMs + 1000, dur);
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
function synthesizeWordSpans(text, window) {
    const tokens = text.trim().split(/\s+/).filter((t) => t !== "");
    if (tokens.length === 0)
        return [];
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
function chunkLyricWindows(windows, layerCountOf = (w) => w.lines.length) {
    const chunks = [];
    let current = [];
    let layers = 0;
    for (const w of windows) {
        const n = layerCountOf(w);
        if (layers > 0 && layers + n > exports.LAYERS_PER_TEXT_SOURCE) {
            chunks.push(current);
            current = [];
            layers = 0;
        }
        current.push(w);
        layers += n;
    }
    if (current.length > 0)
        chunks.push(current);
    return chunks;
}
/**
 * NEVER hand drawtext a newline: current ffmpeg builds render the LF itself
 * as a tofu box. Each fitted line is its own single-line layer, stacked
 * upward from the band bottom via per-line padding (the dual-sub idiom).
 */
function lineLayers(lines, hAlign, lineHFrac, overlay, style) {
    return lines.map((line, i) => ({
        content: { kind: "literal", text: line },
        placement: {
            hAlign,
            vAlign: "bottom",
            padding: { x: exports.LYRIC_PAD_X_FRAC, y: 0.06 + (lines.length - 1 - i) * lineHFrac },
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
exports.KARAOKE_CENTER_EM = 0.55;
/** Dot glyph scale relative to the line font. */
const DOT_FONT_FRAC = 0.6;
/** Left inset (band-width fraction) that centers an estimated line. */
function karaokePadX(lineChars, fontPx, bandW, align) {
    const lineFrac = Math.min(0.96, (lineChars * fontPx * exports.KARAOKE_CENTER_EM) / bandW);
    const padX = align === "left"
        ? exports.LYRIC_PAD_X_FRAC
        : align === "right"
            ? Math.max(exports.LYRIC_PAD_X_FRAC, 1 - exports.LYRIC_PAD_X_FRAC - lineFrac)
            : Math.max(exports.LYRIC_PAD_X_FRAC, (1 - lineFrac) / 2);
    return { padX, lineFrac };
}
/** Distribute a window's word spans across its wrapped visual lines.
 *  Returns null when the fit's tokens no longer match the spans (e.g.
 *  ellipsis truncation) — callers fall back to plain line rendering. */
function mapSpansToLines(lines, spans) {
    const perLine = [];
    let cursor = 0;
    for (const line of lines) {
        const count = line.trim().split(/\s+/).filter((t) => t !== "").length;
        perLine.push(spans.slice(cursor, cursor + count));
        cursor += count;
    }
    if (cursor !== spans.length)
        return null;
    return perLine;
}
/** Karaoke layers for ONE window (base lines + highlight prefixes or dot). */
function karaokeWindowLayers(w, spansPerLine, opts) {
    const layers = [];
    const lineHFrac = Math.round(w.fontPx * 1.3) / Math.max(1, opts.bandH);
    const style = w.fontPx !== opts.baseFontPx ? { fontSize: w.fontPx } : undefined;
    const lineWindow = {
        enable: `between(t,${sec(w.startMs)},${sec(w.endMs)})`,
        window: { startSec: Number(sec(w.startMs)), endSec: Number(sec(w.endMs)) },
        ...(opts.revealStyle === "fade"
            ? { alpha: `min(1,max(0,(t-${sec(w.startMs)})/${exports.REVEAL_FADE_SEC}))` }
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
            hAlign: "left",
            vAlign: "bottom",
            padding: { x: padX, y: padY },
            yExpr: `${Math.max(0, yTopPx)}`,
        };
        // Base line (textColor), left-anchored so the prefixes align exactly.
        layers.push({
            content: { kind: "literal", text: line },
            placement: anchor,
            overlay: lineWindow,
            ...(style ? { style } : {}),
        });
        if (spans.length === 0)
            return;
        const lineEndSec = sec(w.endMs);
        if (opts.mode === "highlight") {
            // One prefix per word: enabled from the word's start to the line
            // end (cumulative repaint), alpha ramping over the WORD's span.
            for (let k = 0; k < tokens.length; k++) {
                const span = spans[k];
                const durSec = Math.max(0.05, (span.endMs - span.startMs) / 1000);
                layers.push({
                    content: { kind: "literal", text: tokens.slice(0, k + 1).join(" ") },
                    placement: anchor,
                    overlay: {
                        enable: `between(t,${sec(span.startMs)},${lineEndSec})`,
                        window: { startSec: Number(sec(span.startMs)), endSec: Number(lineEndSec) },
                        alpha: `min(1,max(0,(t-${sec(span.startMs)})/${durSec.toFixed(3)}))`,
                    },
                    style: { ...(style ?? {}), fontColor: opts.karaokeColor },
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
                content: { kind: "literal", text: "●" },
                placement: {
                    hAlign: "left",
                    vAlign: "bottom",
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
                style: { fontSize: dotFont, fontColor: opts.karaokeColor },
            });
        }
    });
    return layers;
}
/** Layer count one window contributes (chunk budgeting must match what
 *  buildLyricLayers will actually emit). */
function windowLayerCount(w, mode) {
    if (mode === "off" || !w.wordSpans)
        return w.lines.length;
    // highlight: one prefix per word; dot: one dot per word.
    return w.lines.length + w.wordSpans.length;
}
/** One chunk's drawtext layers, each line gated to its window. */
function buildLyricLayers(windows, opts) {
    const layers = [];
    const karaokeMode = opts.karaoke ?? "off";
    for (const w of windows) {
        if (karaokeMode !== "off" && w.wordSpans && typeof opts.bandW === "number") {
            const spansPerLine = mapSpansToLines(w.lines, w.wordSpans);
            if (spansPerLine !== null) {
                layers.push(...karaokeWindowLayers(w, spansPerLine, {
                    mode: karaokeMode,
                    align: opts.align,
                    revealStyle: opts.revealStyle,
                    bandH: opts.bandH,
                    bandW: opts.bandW,
                    baseFontPx: opts.baseFontPx,
                    karaokeColor: opts.karaokeColor ?? "#FFC53D",
                }));
                continue;
            }
        }
        const startSec = Number(sec(w.startMs));
        const endSec = Number(sec(w.endMs));
        const overlay = {
            // The enable string and the structured window MUST describe the same
            // window (source.ts law) — both minted from the same rounded seconds.
            enable: `between(t,${sec(w.startMs)},${sec(w.endMs)})`,
            window: { startSec, endSec },
            ...(opts.revealStyle === "fade"
                ? { alpha: `min(1,max(0,(t-${sec(w.startMs)})/${exports.REVEAL_FADE_SEC}))` }
                : {}),
        };
        const lineHFrac = Math.round(w.fontPx * 1.3) / Math.max(1, opts.bandH);
        const style = w.fontPx !== opts.baseFontPx ? { fontSize: w.fontPx } : undefined;
        layers.push(...lineLayers(w.lines, opts.align, lineHFrac, overlay, style));
    }
    return layers;
}
const SNAP = 4;
const snap = (v) => Math.max(SNAP, Math.round(v / SNAP) * SNAP);
/** Chunk-independent band geometry — the fit stage needs it BEFORE chunking. */
function computeLyricBandGeometry(args) {
    const W = Math.round(args.canvasW);
    const H = Math.round(args.canvasH);
    const fontSizePx = computeLyricFontPx(H, args.textScale);
    const lineH = Math.round(fontSizePx * 1.3);
    const sideMargin = snap(W * 0.08);
    const bandW = W - 2 * sideMargin;
    const bandH = snap(2 * lineH + fontSizePx * 0.5);
    const safe = snap(H * 0.08);
    const bandY = args.position === "top"
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
function buildLyricLayout(args) {
    const W = Math.round(args.canvasW);
    const H = Math.round(args.canvasH);
    const { band, fontSizePx, lineHFrac } = computeLyricBandGeometry(args);
    const order = [{ kind: "base" }];
    for (let i = 0; i < args.chunkCount; i++)
        order.push({ kind: "lyrics", chunk: i });
    order.push({ kind: "audio" });
    const rects = order.map((slot, i) => ({
        ...(slot.kind === "lyrics" ? band : { x: 0, y: 0, w: W, h: H }),
        // Distinct ascending importance: base below, lyric chunks in order,
        // the (invisible) audio leaf on the very top overlay layer.
        importance: i,
    }));
    const placed = (0, dsl_stdlib_1.placeRects)({ rootW: W, rootH: H, rects });
    const slotOrder = [];
    for (const layer of placed.layers) {
        const sorted = [...layer.rectIndices].sort((a, b) => rects[a].y - rects[b].y || rects[a].x - rects[b].x || a - b);
        for (const idx of sorted)
            slotOrder.push(order[idx]);
    }
    return {
        m0: String(placed.m0),
        slotOrder,
        band,
        fontSizePx,
        lineHFrac,
    };
}
/** Assemble the full lyric-video document (deterministic, JSON-safe). */
function buildLyricDocument(args) {
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
            const spans = (0, template_utils_1.resolveWordSpans)(w, { startMs: w.startMs, endMs: w.endMs });
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
    const windowChunks = chunkLyricWindows(fitted, (w) => windowLayerCount(w, args.style.karaoke));
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
    const songAssetId = (0, types_1.asAssetId)((0, template_utils_1.slugifyAssetKeyFromPath)(args.song.path));
    const assetEntries = {
        [songAssetId]: {
            kind: "file",
            path: args.song.path,
            mediaType: args.song.assetMediaType,
        },
    };
    let baseSource;
    if (args.background) {
        const bgAssetId = (0, types_1.asAssetId)((0, template_utils_1.slugifyAssetKeyFromPath)(args.background.path));
        assetEntries[bgAssetId] = {
            kind: "file",
            path: args.background.path,
            mediaType: args.background.mediaType,
        };
        const bgShorter = args.background.mediaType === "video" &&
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
        };
    }
    else {
        baseSource = {
            type: "lavfi",
            color: args.style.backgroundColor,
            fitMode: "cover",
            editor: { owner: "template", label: "lyric:backdrop" },
        };
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
    const textSources = [];
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
        });
    }
    const audioSource = {
        type: "media",
        // MANDATORY even for real audio files: an mp3 with ID3 cover art probes
        // hasVideo:true and would otherwise enter the video composite — the
        // source-level declaration makes the engine take ONLY its audio
        // (background-audio-leaf law).
        mediaType: "audio",
        assetId: songAssetId,
        audio: { enabled: true, volume: 1 },
        editor: { owner: "template", label: "lyric:song" },
    };
    const slotSource = (slot) => slot.kind === "base" ? baseSource : slot.kind === "audio" ? audioSource : textSources[slot.chunk];
    return {
        kind: "mosaic_document",
        version: 1,
        m0: layout.m0,
        fps: args.fps,
        durationMs: args.durationMs,
        size: { width: Math.round(args.canvasW), height: Math.round(args.canvasH) },
        backgroundColor: args.style.backgroundColor,
        assets: assetEntries,
        sources: layout.slotOrder.map(slotSource),
    };
}
