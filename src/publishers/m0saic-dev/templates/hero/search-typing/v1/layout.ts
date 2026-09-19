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

import { measureText } from "@m0saic/template-utils";

import type { SearchTypingFrameMode } from "./schema";

/** Icon square side as a fraction of barH. */
export const ICON_FRAC = 0.42;
/** Icon ≤ this many em of the RESOLVED font — the magnifier must shrink
 *  with the text (gate-27 founder catch: at 1080² the metric-scaled icon
 *  hit 19.9× the shrink-fitted font — a colossal magnifier beside tiny
 *  words). 2.0 keeps the approved 1280×400 look byte-identical (1.88×). */
export const ICON_MAX_EM = 2;
/** Shrink-loop starting fontSize as a fraction of barH. */
export const FONT_START_FRAC = 0.32;
/** Shrink-loop floor (px); overflowing at the floor throws. */
export const MIN_FONT_PX = 14;
/** Width head-room: the app fits text wider than the CLI. */
export const FIT_SLACK = 0.08;
/** Shrink-loop step (5% down per iteration). */
export const SHRINK_STEP = 0.95;
/** Horizontal card padding as a fraction of barH. */
export const PAD_X_FRAC = 0.14;
/** Icon→label gap as a fraction of fontSize. */
export const ICON_GAP_FRAC = 0.45;
/** Gap between baseline+descent and the underline top (px). */
export const UNDERLINE_GAP_PX = 4;
/** Underline thickness (px) — exact-px thin line, never a weighted split. */
export const UNDERLINE_H_PX = 2;
/** Bar width px clamp. */
export const BAR_W_MIN_PX = 320;
export const BAR_W_MAX_PX = 960;
/** Bar height px clamp. */
export const BAR_H_MIN_PX = 64;
export const BAR_H_MAX_PX = 200;
/**
 * Recipe-1 cell pitch shared by layout and the assembly: card-mode bars are
 * authored ON this grid so the card's placed cell IS its visual rect (the
 * card paints its whole cell — a real background fill, no mask).
 */
export const SNAP_PX = 8;

export type PxRect = { x: number; y: number; w: number; h: number };

export type WordLayout = {
  word: string;
  /**
   * Cumulative advances from `wordX`: advances[i] is char i's left edge,
   * advances[length] the word's full width. Length = word.length + 1.
   */
  advances: number[];
  widthPx: number;
};

export type SearchBarLayout = {
  canvas: { w: number; h: number };
  /** Card rect, centered on the canvas, px-clamped. */
  bar: PxRect;
  /** Card corner radius, clamped to barH/2. */
  cornerRadiusPx: number;
  /** Horizontal card padding (px). */
  padXPx: number;
  /** Icon square (vertically centered); null when the icon is hidden. */
  icon: PxRect | null;
  /** Shrink-to-fit font size (px, 2-decimal). */
  fontSize: number;
  /** Label with its trailing separator space; "" when hidden. */
  labelText: string;
  labelX: number;
  labelWidthPx: number;
  /** Left origin shared by every word strip and every advance. */
  wordX: number;
  /** Widest word's width at the fitted size. */
  maxWordWidthPx: number;
  /** First-line baseline (float; glyphs.ts pins textToPath to it). */
  baselineY: number;
  ascent: number;
  descent: number;
  /** Cover-box band [glyphTop, glyphBottom) — clears underline + corners. */
  glyphTop: number;
  glyphBottom: number;
  /** Underline top edge (int px). */
  underlineY: number;
  underlineHeightPx: number;
  /** Static underline segment beneath the label (x0 == x1 when no label). */
  labelUnderline: { x0: number; x1: number };
  /**
   * Real-geometry zones (integer px, inside the bar): the cells the assembly
   * places so the document carries true bounding boxes. `labelZone` spans the
   * label glyphs + its underline row (null when the label is hidden);
   * `wordZone` spans every word's glyph ink + cover spans with AA margins;
   * `underlineZone` is the 2px grow-track band under the word zone.
   */
  labelZone: PxRect | null;
  wordZone: PxRect;
  underlineZone: PxRect;
  words: WordLayout[];
};

export type SearchBarLayoutInput = {
  canvasW: number;
  canvasH: number;
  words: string[];
  /** Raw label; the trailing separator space is added here. */
  label: string;
  /** "fill": the box IS the canvas (no clamps — the caller owns bounds);
   *  "card": px-clamped floating bar centered on the page. */
  frame: SearchTypingFrameMode;
  showIcon: boolean;
  /** Card-mode only; ignored under "fill". */
  barWidthFrac: number;
  /** Card-mode only; ignored under "fill". */
  barAspect: number;
  cornerRadiusPx: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Font-proportional ink pads. Roboto glyphs can ink OUTSIDE their advance
 * box, and the overhang scales with the em: worst left side bearing ≈
 * −0.05em ("ĩ", "j" −0.032em), right overshoot ≈ +0.065em ("ſ"), ring/cap
 * tops ≈ +0.02em above the ascender ("Å"). Zones and cover spans pad by
 * these so fill-mode hero sizes (~90–128px) neither clip ink at a snapped
 * cell edge nor leak it past the curtain.
 */
export function inkLeftPadPx(fontSize: number): number {
  return Math.max(2, Math.ceil(0.05 * fontSize) + 1);
}
export function inkRightPadPx(fontSize: number): number {
  return Math.max(3, Math.ceil(0.07 * fontSize) + 1);
}
export function inkTopPadPx(fontSize: number): number {
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
export function charAdvances(word: string, fontSize: number): number[] {
  const advances: number[] = [0];
  for (let i = 1; i < word.length; i++) {
    const prefix = measureText(word.slice(0, i), { fontSize }).width;
    const pair = measureText(word.slice(i - 1, i + 1), { fontSize }).width;
    const left = measureText(word[i - 1], { fontSize }).width;
    const right = measureText(word[i], { fontSize }).width;
    advances.push(prefix + (pair - left - right));
  }
  if (word.length > 0) {
    advances.push(measureText(word, { fontSize }).width);
  }
  return advances;
}

type FitMeasure = {
  labelWidthPx: number;
  maxWordWidthPx: number;
  iconGapPx: number;
  /** Font-coupled icon size at this trial font (≤ ICON_MAX_EM·size). */
  iconSizePx: number;
  requiredWidthPx: number;
};

export function computeLayout(input: SearchBarLayoutInput): SearchBarLayout {
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
  const snapDim = (value: number, axisMax: number): number =>
    Math.max(
      SNAP_PX,
      Math.min(Math.floor(axisMax / SNAP_PX) * SNAP_PX, Math.round(value / SNAP_PX) * SNAP_PX),
    );
  const rawBarW = isFill
    ? canvasW
    : Math.min(canvasW, clamp(Math.round(canvasW * input.barWidthFrac), BAR_W_MIN_PX, BAR_W_MAX_PX));
  const barW = isFill ? canvasW : snapDim(rawBarW, canvasW);
  const rawBarH = isFill
    ? canvasH
    : Math.min(canvasH, clamp(Math.round(barW * input.barAspect), BAR_H_MIN_PX, BAR_H_MAX_PX));
  const barH = isFill ? canvasH : snapDim(rawBarH, canvasH);
  const bar: PxRect = {
    x: isFill ? 0 : Math.floor((canvasW - barW) / 2 / SNAP_PX) * SNAP_PX,
    y: isFill ? 0 : Math.floor((canvasH - barH) / 2 / SNAP_PX) * SNAP_PX,
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
  const padXPx = Math.round(PAD_X_FRAC * metricH);
  // Metric ceiling for the icon; the em cap below couples it to the trial
  // font INSIDE the shrink loop, so icon and text shrink together (both
  // monotone in `size` — the loop stays convergent) and the freed overhead
  // lets constrained canvases resolve a LARGER font.
  const iconMetricPx = input.showIcon ? Math.round(ICON_FRAC * metricH) : 0;
  const labelText = input.label ? `${input.label} ` : "";

  const measureAt = (size: number): FitMeasure => {
    const labelWidthPx = labelText ? measureText(labelText, { fontSize: size }).width : 0;
    let maxWordWidthPx = 0;
    for (const word of input.words) {
      maxWordWidthPx = Math.max(maxWordWidthPx, measureText(word, { fontSize: size }).width);
    }
    const iconGapPx = input.showIcon ? Math.round(ICON_GAP_FRAC * size) : 0;
    const iconSizePx = input.showIcon
      ? Math.min(iconMetricPx, Math.round(ICON_MAX_EM * size))
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
  const fitWidthPx = barW * (1 - FIT_SLACK);
  let size = Math.max(MIN_FONT_PX, FONT_START_FRAC * metricH);
  let measure = measureAt(size);
  while (measure.requiredWidthPx > fitWidthPx && size > MIN_FONT_PX) {
    size = Math.max(MIN_FONT_PX, size * SHRINK_STEP);
    measure = measureAt(size);
  }
  if (measure.requiredWidthPx > fitWidthPx) {
    throw new Error(
      `search-typing layout: label + longest word need ${Math.ceil(measure.requiredWidthPx)}px ` +
        `but the ${barW}px bar fits ${Math.floor(fitWidthPx)}px even at the ${MIN_FONT_PX}px ` +
        `font floor — shorten the words/label or widen the bar`,
    );
  }
  // Round DOWN to 2 decimals so the rounded size still fits, then re-measure
  // once so every emitted width matches the emitted fontSize exactly.
  const fontSize = Math.floor(size * 100) / 100;
  measure = measureAt(fontSize);

  // Vertical: center the glyph block + underline as one group. A bar too
  // short to contain the group would emit out-of-bar coordinates — fail fast
  // instead, mirroring the horizontal overflow above.
  const { ascent, descent } = measureText("", { fontSize });
  const groupH = ascent + descent + UNDERLINE_GAP_PX + UNDERLINE_H_PX;
  if (groupH > barH) {
    throw new Error(
      `search-typing layout: the ${barH}px bar is too short for the ` +
        `${Math.ceil(groupH)}px glyph+underline group — render at a taller canvas`,
    );
  }
  const groupTop = bar.y + (barH - groupH) / 2;
  const baselineY = groupTop + ascent;
  const underlineY = Math.round(baselineY + descent + UNDERLINE_GAP_PX);
  const glyphTop = Math.max(bar.y + 1, Math.floor(baselineY - ascent) - inkTopPadPx(fontSize));
  const glyphBottom = underlineY - 1;

  // Horizontal zones.
  const icon: PxRect | null = input.showIcon
    ? {
        x: bar.x + padXPx,
        y: Math.round(bar.y + (barH - measure.iconSizePx) / 2),
        w: measure.iconSizePx,
        h: measure.iconSizePx,
      }
    : null;
  const labelX = bar.x + padXPx + measure.iconSizePx + measure.iconGapPx;
  const wordX = labelX + measure.labelWidthPx;

  const words: WordLayout[] = input.words.map((word) => {
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
  const wordZone: PxRect = {
    x: wordZoneX,
    y: glyphTop,
    w: Math.min(barRight, Math.ceil(wordX + maxWordWidthPx) + rsbPad + 2) - wordZoneX,
    h: glyphBottom - glyphTop,
  };
  const labelZoneX = Math.max(bar.x, Math.floor(labelX) - lsbPad);
  const labelZone: PxRect | null = labelText
    ? {
        x: labelZoneX,
        y: glyphTop,
        w: Math.ceil(wordX) + 1 - labelZoneX,
        h: underlineY + UNDERLINE_H_PX - glyphTop,
      }
    : null;
  const underlineZone: PxRect = {
    x: wordZone.x,
    y: underlineY,
    w: wordZone.w,
    h: UNDERLINE_H_PX,
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
    underlineHeightPx: UNDERLINE_H_PX,
    labelUnderline: { x0: labelX, x1: wordX },
    labelZone,
    wordZone,
    underlineZone,
    words,
  };
}
