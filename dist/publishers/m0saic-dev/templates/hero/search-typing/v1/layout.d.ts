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
import type { SearchTypingFrameMode } from "./schema";
/** Icon square side as a fraction of barH. */
export declare const ICON_FRAC = 0.42;
/** Icon ≤ this many em of the RESOLVED font — the magnifier must shrink
 *  with the text (gate-27 founder catch: at 1080² the metric-scaled icon
 *  hit 19.9× the shrink-fitted font — a colossal magnifier beside tiny
 *  words). 2.0 keeps the approved 1280×400 look byte-identical (1.88×). */
export declare const ICON_MAX_EM = 2;
/** Shrink-loop starting fontSize as a fraction of barH. */
export declare const FONT_START_FRAC = 0.32;
/** Shrink-loop floor (px); overflowing at the floor throws. */
export declare const MIN_FONT_PX = 14;
/** Width head-room: the app fits text wider than the CLI. */
export declare const FIT_SLACK = 0.08;
/** Shrink-loop step (5% down per iteration). */
export declare const SHRINK_STEP = 0.95;
/** Horizontal card padding as a fraction of barH. */
export declare const PAD_X_FRAC = 0.14;
/** Icon→label gap as a fraction of fontSize. */
export declare const ICON_GAP_FRAC = 0.45;
/** Gap between baseline+descent and the underline top (px). */
export declare const UNDERLINE_GAP_PX = 4;
/** Underline thickness (px) — exact-px thin line, never a weighted split. */
export declare const UNDERLINE_H_PX = 2;
/** Bar width px clamp. */
export declare const BAR_W_MIN_PX = 320;
export declare const BAR_W_MAX_PX = 960;
/** Bar height px clamp. */
export declare const BAR_H_MIN_PX = 64;
export declare const BAR_H_MAX_PX = 200;
/**
 * Recipe-1 cell pitch shared by layout and the assembly: card-mode bars are
 * authored ON this grid so the card's placed cell IS its visual rect (the
 * card paints its whole cell — a real background fill, no mask).
 */
export declare const SNAP_PX = 8;
export type PxRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
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
    canvas: {
        w: number;
        h: number;
    };
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
    labelUnderline: {
        x0: number;
        x1: number;
    };
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
/**
 * Font-proportional ink pads. Roboto glyphs can ink OUTSIDE their advance
 * box, and the overhang scales with the em: worst left side bearing ≈
 * −0.05em ("ĩ", "j" −0.032em), right overshoot ≈ +0.065em ("ſ"), ring/cap
 * tops ≈ +0.02em above the ascender ("Å"). Zones and cover spans pad by
 * these so fill-mode hero sizes (~90–128px) neither clip ink at a snapped
 * cell edge nor leak it past the curtain.
 */
export declare function inkLeftPadPx(fontSize: number): number;
export declare function inkRightPadPx(fontSize: number): number;
export declare function inkTopPadPx(fontSize: number): number;
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
export declare function charAdvances(word: string, fontSize: number): number[];
export declare function computeLayout(input: SearchBarLayoutInput): SearchBarLayout;
