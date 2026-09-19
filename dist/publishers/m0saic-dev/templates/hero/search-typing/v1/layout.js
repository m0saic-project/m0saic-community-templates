"use strict";
/**
 * Search-bar geometry — bar rect, left→right zones, shrink-to-fit fontSize,
 * and per-word cumulative character advances.
 *
 * Aspect-agnostic: the bar is a width-fraction of the canvas with px clamps,
 * so the same props work as a banner, a square social card, or a wide hero.
 * Zones inside the bar, left→right: padX · icon square (0.42·barH) · gap ·
 * label (with its trailing separator space) · word origin. The label's
 * trailing space IS the label→word gap, so measures and glyph positions share
 * one origin (`wordX`) — the cover-box spans in boxes.ts and the word-strip
 * masks in glyphs.ts must never disagree about where char i starts.
 *
 * Fit strategy (plan D9): required inner width at a candidate fontSize =
 * padX + icon + gap + labelW + max(wordW) + padX. Start at 0.32·barH and step
 * down 5% until it fits inside barW·(1−8%) — the slack absorbs the app fitting
 * text wider than the CLI — or the 14px floor. Even the floor overflowing is a
 * fail-fast throw (the renderer maps it to an error mosaic).
 *
 * Vertical: the glyph block (ascent+descent) plus the underline gap+bar is
 * centered as ONE group in the bar, so the underline never pushes the text
 * visually off-center. Cover boxes span only [glyphTop, glyphBottom) — clear
 * of the underline and of the card's rounded corners (the band sits at
 * mid-height where corner arcs cannot intrude for any radius ≤ barH/2).
 *
 * Pure measurement module: uses the bundled-font `measureText` (the same
 * metrics `textToPath` emits) and nothing else. Deterministic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SNAP_PX = exports.BAR_H_MAX_PX = exports.BAR_H_MIN_PX = exports.BAR_W_MAX_PX = exports.BAR_W_MIN_PX = exports.UNDERLINE_H_PX = exports.UNDERLINE_GAP_PX = exports.ICON_GAP_FRAC = exports.PAD_X_FRAC = exports.SHRINK_STEP = exports.FIT_SLACK = exports.MIN_FONT_PX = exports.FONT_START_FRAC = exports.ICON_MAX_EM = exports.ICON_FRAC = void 0;
exports.inkLeftPadPx = inkLeftPadPx;
exports.inkRightPadPx = inkRightPadPx;
exports.inkTopPadPx = inkTopPadPx;
exports.charAdvances = charAdvances;
exports.computeLayout = computeLayout;
const template_utils_1 = require("@m0saic/template-utils");
/** Icon square side as a fraction of barH. */
exports.ICON_FRAC = 0.42;
/** Icon ≤ this many em of the RESOLVED font — the magnifier must shrink
 *  with the text (gate-27 founder catch: at 1080² the metric-scaled icon
 *  hit 19.9× the shrink-fitted font — a colossal magnifier beside tiny
 *  words). 2.0 keeps the approved 1280×400 look byte-identical (1.88×). */
exports.ICON_MAX_EM = 2;
/** Shrink-loop starting fontSize as a fraction of barH. */
exports.FONT_START_FRAC = 0.32;
/** Shrink-loop floor (px); overflowing at the floor throws. */
exports.MIN_FONT_PX = 14;
/** Width head-room: the app fits text wider than the CLI. */
exports.FIT_SLACK = 0.08;
/** Shrink-loop step (5% down per iteration). */
exports.SHRINK_STEP = 0.95;
/** Horizontal card padding as a fraction of barH. */
exports.PAD_X_FRAC = 0.14;
/** Icon→label gap as a fraction of fontSize. */
exports.ICON_GAP_FRAC = 0.45;
/** Gap between baseline+descent and the underline top (px). */
exports.UNDERLINE_GAP_PX = 4;
/** Underline thickness (px) — exact-px thin line, never a weighted split. */
exports.UNDERLINE_H_PX = 2;
/** Bar width px clamp. */
exports.BAR_W_MIN_PX = 320;
exports.BAR_W_MAX_PX = 960;
/** Bar height px clamp. */
exports.BAR_H_MIN_PX = 64;
exports.BAR_H_MAX_PX = 200;
/**
 * Recipe-1 cell pitch shared by layout and the assembly: card-mode bars are
 * authored ON this grid so the card's placed cell IS its visual rect (the
 * card paints its whole cell — a real background fill, no mask).
 */
exports.SNAP_PX = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/**
 * Font-proportional ink pads. Roboto glyphs can ink OUTSIDE their advance
 * box, and the overhang scales with the em: worst left side bearing ≈
 * −0.05em ("ĩ", "j" −0.032em), right overshoot ≈ +0.065em ("ſ"), ring/cap
 * tops ≈ +0.02em above the ascender ("Å"). Zones and cover spans pad by
 * these so fill-mode hero sizes (~90–128px) neither clip ink at a snapped
 * cell edge nor leak it past the curtain.
 */
function inkLeftPadPx(fontSize) {
    return Math.max(2, Math.ceil(0.05 * fontSize) + 1);
}
function inkRightPadPx(fontSize) {
    return Math.max(3, Math.ceil(0.07 * fontSize) + 1);
}
function inkTopPadPx(fontSize) {
    return Math.max(1, Math.ceil(0.025 * fontSize));
}
/**
 * True glyph origins for `word` at `fontSize` in the FULL-WORD kerned layout
 * `textToPath` draws: advances[i] is char i's x-origin, advances[length] the
 * word's width. A bare prefix measurement misses the kern pair SPANNING the
 * prefix boundary — Roboto pairs like "LT" kern by −7.8px at hero sizes, far
 * past any 1px overlap — so each boundary adds its pair kern, recovered as
 * `measure(pair) − measure(left) − measure(right)` (a two-char measure
 * includes the pair's kern; the singles don't).
 *
 * The char model is UTF-16 code units (one keystroke per unit) — parseProps
 * rejects surrogate pairs and combining marks so unit === visible glyph and
 * the advances stay strictly increasing.
 */
function charAdvances(word, fontSize) {
    const advances = [0];
    for (let i = 1; i < word.length; i++) {
        const prefix = (0, template_utils_1.measureText)(word.slice(0, i), { fontSize }).width;
        const pair = (0, template_utils_1.measureText)(word.slice(i - 1, i + 1), { fontSize }).width;
        const left = (0, template_utils_1.measureText)(word[i - 1], { fontSize }).width;
        const right = (0, template_utils_1.measureText)(word[i], { fontSize }).width;
        advances.push(prefix + (pair - left - right));
    }
    if (word.length > 0) {
        advances.push((0, template_utils_1.measureText)(word, { fontSize }).width);
    }
    return advances;
}
function computeLayout(input) {
    const canvasW = Math.max(1, Math.round(input.canvasW));
    const canvasH = Math.max(1, Math.round(input.canvasH));
    if (input.words.length === 0) {
        throw new Error("search-typing layout: words must be non-empty");
    }
    // Bar rect. "fill": the box is the canvas, unclamped — nested callers own
    // the bounds. "card": width-fraction with px clamps, capped to the canvas,
    // centered on the page — then authored ON the SNAP_PX grid so the placed
    // cell IS the visual card (a real bg fill paints the whole cell; snapping
    // shifts edges ≤4px and centering ≤7px, imperceptible on a floating bar).
    const isFill = input.frame === "fill";
    const snapDim = (value, axisMax) => Math.max(exports.SNAP_PX, Math.min(Math.floor(axisMax / exports.SNAP_PX) * exports.SNAP_PX, Math.round(value / exports.SNAP_PX) * exports.SNAP_PX));
    const rawBarW = isFill
        ? canvasW
        : Math.min(canvasW, clamp(Math.round(canvasW * input.barWidthFrac), exports.BAR_W_MIN_PX, exports.BAR_W_MAX_PX));
    const barW = isFill ? canvasW : snapDim(rawBarW, canvasW);
    const rawBarH = isFill
        ? canvasH
        : Math.min(canvasH, clamp(Math.round(barW * input.barAspect), exports.BAR_H_MIN_PX, exports.BAR_H_MAX_PX));
    const barH = isFill ? canvasH : snapDim(rawBarH, canvasH);
    const bar = {
        x: isFill ? 0 : Math.floor((canvasW - barW) / 2 / exports.SNAP_PX) * exports.SNAP_PX,
        y: isFill ? 0 : Math.floor((canvasH - barH) / 2 / exports.SNAP_PX) * exports.SNAP_PX,
        w: barW,
        h: barH,
    };
    const cornerRadiusPx = clamp(Math.round(input.cornerRadiusPx), 0, Math.floor(barH / 2));
    // Metric base for the horizontal furniture (pads, icon, start font). On a
    // bar-shaped box this IS barH — but fill mode hands the whole canvas to
    // the bar, and on a PORTRAIT canvas barH-scaled pads+icon alone exceed
    // the width (720×1280: (0.14·2+0.42)·1280 ≈ 900px of fixed overhead in a
    // 720px bar → even the 14px font floor could never fit and DEFAULTS
    // error-carded). Cap the metric base at 0.6·barW, and only when the bar
    // is TALLER than wide — landscape (1280×400) and square (1080²) layouts
    // stay byte-identical to the approved look.
    const metricH = barH > barW ? Math.min(barH, Math.round(barW * 0.6)) : barH;
    const padXPx = Math.round(exports.PAD_X_FRAC * metricH);
    // Metric ceiling for the icon; the em cap below couples it to the trial
    // font INSIDE the shrink loop, so icon and text shrink together (both
    // monotone in `size` — the loop stays convergent) and the freed overhead
    // lets constrained canvases resolve a LARGER font.
    const iconMetricPx = input.showIcon ? Math.round(exports.ICON_FRAC * metricH) : 0;
    const labelText = input.label ? `${input.label} ` : "";
    const measureAt = (size) => {
        const labelWidthPx = labelText ? (0, template_utils_1.measureText)(labelText, { fontSize: size }).width : 0;
        let maxWordWidthPx = 0;
        for (const word of input.words) {
            maxWordWidthPx = Math.max(maxWordWidthPx, (0, template_utils_1.measureText)(word, { fontSize: size }).width);
        }
        const iconGapPx = input.showIcon ? Math.round(exports.ICON_GAP_FRAC * size) : 0;
        const iconSizePx = input.showIcon
            ? Math.min(iconMetricPx, Math.round(exports.ICON_MAX_EM * size))
            : 0;
        return {
            labelWidthPx,
            maxWordWidthPx,
            iconGapPx,
            iconSizePx,
            requiredWidthPx: padXPx + iconSizePx + iconGapPx + labelWidthPx + maxWordWidthPx + padXPx,
        };
    };
    // D9 shrink loop: 5% steps down to the 14px floor, 8% slack. The start is
    // floored at MIN_FONT_PX too: a canvas-capped bar below the plan's px
    // clamps must not quietly emit a sub-floor font — it fits at 14px or throws.
    const fitWidthPx = barW * (1 - exports.FIT_SLACK);
    let size = Math.max(exports.MIN_FONT_PX, exports.FONT_START_FRAC * metricH);
    let measure = measureAt(size);
    while (measure.requiredWidthPx > fitWidthPx && size > exports.MIN_FONT_PX) {
        size = Math.max(exports.MIN_FONT_PX, size * exports.SHRINK_STEP);
        measure = measureAt(size);
    }
    if (measure.requiredWidthPx > fitWidthPx) {
        throw new Error(`search-typing layout: label + longest word need ${Math.ceil(measure.requiredWidthPx)}px ` +
            `but the ${barW}px bar fits ${Math.floor(fitWidthPx)}px even at the ${exports.MIN_FONT_PX}px ` +
            `font floor — shorten the words/label or widen the bar`);
    }
    // Round DOWN to 2 decimals so the rounded size still fits, then re-measure
    // once so every emitted width matches the emitted fontSize exactly.
    const fontSize = Math.floor(size * 100) / 100;
    measure = measureAt(fontSize);
    // Vertical: center the glyph block + underline as one group. A bar too
    // short to contain the group would emit out-of-bar coordinates — fail fast
    // instead, mirroring the horizontal overflow above.
    const { ascent, descent } = (0, template_utils_1.measureText)("", { fontSize });
    const groupH = ascent + descent + exports.UNDERLINE_GAP_PX + exports.UNDERLINE_H_PX;
    if (groupH > barH) {
        throw new Error(`search-typing layout: the ${barH}px bar is too short for the ` +
            `${Math.ceil(groupH)}px glyph+underline group — render at a taller canvas`);
    }
    const groupTop = bar.y + (barH - groupH) / 2;
    const baselineY = groupTop + ascent;
    const underlineY = Math.round(baselineY + descent + exports.UNDERLINE_GAP_PX);
    const glyphTop = Math.max(bar.y + 1, Math.floor(baselineY - ascent) - inkTopPadPx(fontSize));
    const glyphBottom = underlineY - 1;
    // Horizontal zones.
    const icon = input.showIcon
        ? {
            x: bar.x + padXPx,
            y: Math.round(bar.y + (barH - measure.iconSizePx) / 2),
            w: measure.iconSizePx,
            h: measure.iconSizePx,
        }
        : null;
    const labelX = bar.x + padXPx + measure.iconSizePx + measure.iconGapPx;
    const wordX = labelX + measure.labelWidthPx;
    const words = input.words.map((word) => {
        const advances = charAdvances(word, fontSize);
        return { word, advances, widthPx: advances[advances.length - 1] };
    });
    const maxWordWidthPx = measure.maxWordWidthPx;
    // Real-geometry zones, padded by the font-proportional ink overhangs so
    // no glyph ink clips at a snapped cell edge, clamped inside the bar.
    const barRight = bar.x + bar.w;
    const lsbPad = inkLeftPadPx(fontSize);
    const rsbPad = inkRightPadPx(fontSize);
    const wordZoneX = Math.max(bar.x, Math.floor(wordX) - lsbPad - 1);
    const wordZone = {
        x: wordZoneX,
        y: glyphTop,
        w: Math.min(barRight, Math.ceil(wordX + maxWordWidthPx) + rsbPad + 2) - wordZoneX,
        h: glyphBottom - glyphTop,
    };
    const labelZoneX = Math.max(bar.x, Math.floor(labelX) - lsbPad);
    const labelZone = labelText
        ? {
            x: labelZoneX,
            y: glyphTop,
            w: Math.ceil(wordX) + 1 - labelZoneX,
            h: underlineY + exports.UNDERLINE_H_PX - glyphTop,
        }
        : null;
    const underlineZone = {
        x: wordZone.x,
        y: underlineY,
        w: wordZone.w,
        h: exports.UNDERLINE_H_PX,
    };
    return {
        canvas: { w: canvasW, h: canvasH },
        bar,
        cornerRadiusPx,
        padXPx,
        icon,
        fontSize,
        labelText,
        labelX,
        labelWidthPx: measure.labelWidthPx,
        wordX,
        maxWordWidthPx: measure.maxWordWidthPx,
        baselineY,
        ascent,
        descent,
        glyphTop,
        glyphBottom,
        underlineY,
        underlineHeightPx: exports.UNDERLINE_H_PX,
        labelUnderline: { x0: labelX, x1: wordX },
        labelZone,
        wordZone,
        underlineZone,
        words,
    };
}
