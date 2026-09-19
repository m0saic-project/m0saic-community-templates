/**
 * Layout — every rect the story paints, as integer pixels for the exact
 * render canvas (laundered into real m0 cells by `placeInsetPieces` in
 * compose). The card is designed for a 9:16 story: sizes are fractions of a
 * 1080×1920 design column scaled by `S = min(W/1080, H/1920)`, anchored to
 * the top of the canvas and centred horizontally, so a wider canvas shows
 * the same column with stage colour either side and the screenshot slot
 * still runs to the bottom edge.
 *
 * Stack (fractions of the scaled design height D):
 *
 *   0.075  ┌ headline row 1 — the small line ("NEW") + the badge
 *          ├ headline row 2 — the big line ("VIDEO")
 *   +0.032 ├ boxed call-to-action
 *   +0.014 ├ three down arrows (their cell holds the bob)
 *   +0.030 ├ link pill
 *   0.51   └ screenshot slot — full width, to the bottom edge
 *
 * Text is measured with the bundled Roboto Bold (`measureText`, the same
 * metrics `textToPath` draws with), so the cells hug the ink exactly and the
 * same numbers hold on every machine. Pure; no engine imports.
 */
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** The design column the fractions below are authored against. */
export declare const DESIGN_W = 1080;
export declare const DESIGN_H = 1920;
/**
 * Roboto's cap height (OS/2 sCapHeight 1456 / 2048 upm) — the sticker is all
 * caps, so cells are sized to the cap box, not the full em box.
 */
export declare const CAP_HEIGHT_EM = 0.711;
/** Sticker outline radii, as fractions of the font size (halo ⊃ stroke). */
export declare const HALO_EM = 0.105;
export declare const STROKE_EM = 0.055;
/** Bundled Roboto Bold — the one face every line draws with. */
export declare function boldFontPath(): string | undefined;
/** Advance width of `text` at `fontSize` in the bold face. */
export declare function textWidth(text: string, fontSize: number): number;
/** Font ascent at `fontSize` (baseline = cap-top + cap height = top + ascent). */
export declare function fontAscent(fontSize: number): number;
/** One line of glyph-mask text, positioned. */
export type TextLine = {
    text: string;
    fontSize: number;
    /** Advance width at `fontSize`, px. */
    width: number;
    /** The cell the glyphs (plus any outline) paint in. */
    cell: Rect;
    /** Baseline, canvas px (integer). */
    baselineY: number;
    /** Outline radii, px (0 = plain glyphs). */
    haloPx: number;
    strokePx: number;
};
export type StoryLayout = {
    /** Design scale: S = min(W / 1080, H / 1920). */
    scale: number;
    /** The scaled design column (top-anchored, centred). */
    stage: Rect;
    /** Small headline line; absent for a single-word headline. */
    headlineTop?: TextLine;
    headlineMain: TextLine;
    /** Badge slot (w:h = 1.4); absent when the badge is "none" and no image. */
    badge?: Rect;
    ctaBox: Rect;
    /** Frame thickness of the CTA box, px. */
    ctaStrokePx: number;
    ctaText: TextLine;
    /** Three arrow cells (each holds the arrow ink at its top plus the bob). */
    arrows: Rect[];
    /** Arrow ink height inside its cell, px. */
    arrowInkH: number;
    /** Continuous bob amplitude, px. */
    arrowBobPx: number;
    pill: Rect;
    /** Chain-link glyph square inside the pill. */
    pillIcon: Rect;
    pillText: TextLine;
    /** The screenshot slot. */
    media: Rect;
    /** True when `media` is the default slot (no rect was drawn). */
    mediaIsDefault: boolean;
};
export type LayoutInput = {
    headlineTop: string;
    headlineMain: string;
    cta: string;
    linkText: string;
    hasBadge: boolean;
    /** A drawn screenshot rect (already resolved to this canvas), if any. */
    mediaOverride?: Rect;
};
/**
 * A sticker line at a known cap-top and centre: the cell hugs the cap box
 * plus the outline radius (and a descender allowance when the text needs
 * one). `baselineY` is where `textToPath` pins the glyphs.
 */
export declare function stickerLine(text: string, fontSize: number, centerX: number, capTop: number, outline: boolean): TextLine;
export declare function computeStoryLayout(W: number, H: number, input: LayoutInput): StoryLayout;
