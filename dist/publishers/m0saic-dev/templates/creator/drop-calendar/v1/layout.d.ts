/**
 * Layout — every rect the calendar paints, computed as integer pixels for
 * the exact render canvas (the beat-hero / scene-highlight resolution-baked
 * head-template style, laundered into real m0 cells by placeRects in
 * compose).
 *
 * Structure (all inside the card region):
 *
 *   paper (the sheet)
 *   └─ panel (the table's ink slab — grid lines are this showing through)
 *      ├─ masthead row  ("OCTOBER 2026")
 *      ├─ header row    (7 weekday cells, lattice columns)
 *      └─ week rows     (N×7 day cells, lattice columns)
 *
 * The lattice rounds each boundary independently (X_k = round(x0 + k·unit))
 * so line thickness never accumulates drift, and cells are inset from the
 * lattice lines by the line width — the ink slab showing between cells IS
 * the table grid.
 */
import type { StageArea } from "./platforms";
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type Aspect = "DESKTOP" | "SQUARE" | "TALL";
export declare function selectAspect(width: number, height: number): Aspect;
export type Regions = {
    facecam?: Rect;
    /** Where the TABLE (masthead + grid + list) lays out — inside the safe area. */
    card: Rect;
    /**
     * Where the SHEET paints. On tall (social) canvases the sheet bleeds edge
     * to edge so the calendar IS the video — the platform's chrome then sits
     * on sheet, not on an empty stage — while the table stays inside the safe
     * area. Absent = the sheet is the card (the poster look with a margin).
     */
    paper?: Rect;
};
export type FacecamCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export declare const FACECAM_CORNERS: FacecamCorner[];
/** Picture-in-picture facecam on tall canvases: which corner, how wide. */
export type FacecamPip = {
    corner: FacecamCorner;
    /** Width as a fraction of the canvas width. */
    sizeFrac: number;
};
/**
 * Top-level regions. With a facecam: side-by-side on desktop/square (portrait
 * video left, calendar right); on tall canvases the CALENDAR is the video —
 * the card fills the safe area exactly as it does without a facecam — and the
 * facecam is a picture-in-picture in the corner the user picked, inside the
 * safe area and nudged clear of the action rail (the top corners are
 * rail-free on TikTok / Shorts / Reels; the rail starts at 45 %). Default
 * corner: top-left. The card otherwise fills
 * the platform's SAFE area minus a margin, and never overlaps the rail.
 */
export declare function computeRegions(W: number, H: number, hasFacecam: boolean, aspect: Aspect, stage?: StageArea, pip?: FacecamPip, 
/** The drawn facecam rect (escape hatch): exactly where the facecam goes. */
facecamOverride?: Rect): Regions;
export type CardGeometry = {
    paper: Rect;
    /** The ink slab behind masthead + table; grid lines are it showing through. */
    panel: Rect;
    masthead: Rect;
    /** 7 header cells, left to right. */
    headerCells: Rect[];
    /** Day cells, row-major `[row][col]`. */
    dayCells: Rect[][];
    /** The table area (header + weeks) — the spotlight centers on this. */
    table: Rect;
    /**
     * Drops-list rows under the table (portrait / square reflow: titles leave
     * the cramped cells and line up here). Empty when the layout keeps titles
     * in their cells.
     */
    listRows: Rect[];
    listFontPx: number;
    /** Grid line thickness, px. */
    linePx: number;
    mastheadFontPx: number;
    headerFontPx: number;
    dayNumFontPx: number;
};
/** Fit a single ALL-CAPS line: font from height cap and width budget. */
export declare function fitCapsFontPx(text: string, rect: Rect, heightCap: number, em: number): number;
export declare function computeCardGeometry(card: Rect, weekRows: number, mastheadText: string, 
/** Rows to reserve for the drops list under the table (0 = none). */
listRowCount?: number, 
/** Where the sheet paints; defaults to the card (see `Regions.paper`). */
paperRect?: Rect): CardGeometry;
/** A centered square spotlight over the table area. */
/**
 * The teaser zoom: a square of `sizeFrac` × the table's short side, centred
 * on the table — horizontally AND vertically. It is the hero of the short-
 * form composition (founder 2026-09-15: title on top, facecam as host
 * commentary in the upper left, the zoomed promo centred in the calendar,
 * legend at the bottom) and never yields to the facecam; the facecam paints
 * above it instead (see `Z` in compose) and the creator sizes / places the
 * facecam so the two read as layers.
 */
export declare function spotlightRect(table: Rect, sizeFrac: number): Rect;
/** The 4 edge bars of a highlight ring just inside `r`. */
export declare function ringRects(r: Rect, thickness: number): Rect[];
