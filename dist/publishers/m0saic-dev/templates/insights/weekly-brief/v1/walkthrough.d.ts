/**
 * The guided walkthrough: which tiles carry a note, when the camera reaches
 * and leaves each one, and the camera that does it. Pure - rects and seconds
 * in, expressions out - so the timeline is testable without a render.
 *
 * Ported from `@pipeline-report/sales/pipeline-review/v1` (walkthrough.ts in
 * m0saic-templates-reference/pipeline-report), keyed by tile index instead of
 * a fixed set of headlines; the framing maths and the card-side rule are the
 * same.
 *
 * Timeline (planned seconds, before any squeeze for a pinned clip):
 *
 *   0 ── build ── buildSec ── hold ── stop 1 ── stop 2 … ── pull back ── hold
 *
 * Each stop is TRAVEL seconds of camera move, then a dwell long enough to
 * read its note. The note card shows while the camera is settled.
 */
import type { MosaicCamera } from "@m0saic/types";
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type Stop = {
    index: number;
    note: string;
    departSec: number;
    arriveSec: number;
    leaveSec: number;
};
export type WalkPlan = {
    buildSec: number;
    stops: Stop[];
    pullBackSec: number;
    endSec: number;
};
export declare const PULL_BACK = 1.2;
/** A note longer than this will not fit two lines on the card. */
export declare const MAX_NOTE = 140;
/** The camera never zooms past this - the board is supersampled to match. */
export declare const MAX_ZOOM = 2;
/** Reading time: ~18 chars/s plus a beat to find the tile, 3-8s. */
export declare const dwellSec: (note: string) => number;
/** The walk after the board has built: one stop per noted tile, in tile order. */
export declare function planWalk(buildSec: number, entries: Array<{
    index: number;
    note: string;
}>): WalkPlan;
/** Which edge of the screen the note card sits on for a stop. */
export type CardSide = "bottom" | "top";
export type Framing = {
    zoom: number;
    focusX: number;
    focusY: number;
    card: CardSide;
};
export declare const FULL: Framing;
/** The note card's top edge and height, as frame fractions, per side. */
export declare const NOTE_CARD: Record<CardSide, {
    y: number;
    h: number;
}>;
/** Where `r` lands on screen under a framing (frame px). */
export declare function screenBox(r: Box, f: Framing, W: number, H: number): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
/**
 * Zoom + focus that put `r` (in the W x H source space) as large as fits
 * clear of the note card, centred in that band. focus = window top-left /
 * (frame - window) - the inverse of the engine's crop. The crop can never
 * pan past the source's edge, so a tile near the bottom cannot be lifted
 * above a bottom card: it gets the card at the TOP instead.
 */
export declare function frameOn(r: Box, W: number, H: number): Framing;
/**
 * One camera for the whole walk: full view through the build, then ease to
 * each stop and hold, then ease back to the full view and hold. `T` maps
 * planned seconds to clip seconds (the pinned-clip squeeze).
 */
export declare function walkCamera(plan: WalkPlan, rects: Box[], W: number, H: number, T: (sec: number) => number): MosaicCamera;
