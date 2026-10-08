/**
 * The guided walkthrough: which headlines carry a note, when the camera
 * reaches and leaves each one, and the camera that does it. Pure — rects and
 * seconds in, expressions out — so the timeline is testable without a render.
 *
 * Timeline (seconds, before any squeeze for a short clip):
 *
 *   0 ── build ── BUILD_SEC ── hold ── stop 1 ── stop 2 … ── pull back ── hold
 *
 * Each stop is TRAVEL seconds of camera move, then a dwell long enough to
 * read its note (dwellSec). The note card shows while the camera is settled.
 */
import type { MosaicCamera } from "@m0saic/types";
/** Every headline a note can sit on, in walkthrough (reading) order. */
export declare const FOCUS_KEYS: readonly ["closedWon", "winRate", "slipped", "openPipeline", "byMonth", "byRegion", "slippedList", "topRegion", "topRep", "biggestOpen"];
export type FocusKey = (typeof FOCUS_KEYS)[number];
export type Notes = Partial<Record<FocusKey, string>>;
/** On-screen names, ASCII (the note card's label). */
export declare const FOCUS_LABELS: Record<FocusKey, string>;
/** The dashboard's build schedule ends here. */
export declare const BUILD_SEC = 6.4;
/** Without notes the build takes the first ~45% of the clip; the rest holds. */
export declare const PLAIN_SEC = 18;
/** A note longer than this will not fit two lines on the card. */
export declare const MAX_NOTE = 140;
/** The camera never zooms past this — the dashboard is supersampled to match. */
export declare const MAX_ZOOM = 2;
/** Reading time: ~18 chars/s plus a beat to find the headline, 3-8s. */
export declare const dwellSec: (note: string) => number;
/** The notes that are set, in walkthrough order. Never throws (hosts call it per edit). */
export declare function noteStops(notes: unknown): Array<{
    key: FocusKey;
    note: string;
}>;
export type Stop = {
    key: FocusKey;
    note: string;
    departSec: number;
    arriveSec: number;
    leaveSec: number;
};
export type WalkPlan = {
    stops: Stop[];
    pullBackSec: number;
    endSec: number;
};
export declare function planWalk(entries: Array<{
    key: FocusKey;
    note: string;
}>): WalkPlan;
/** The clip length the notes ask for, rounded up to 0.1s. */
export declare function plannedDurationMs(notes: unknown): number;
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** Which edge of the screen the note card sits on for a stop. */
export type CardSide = "bottom" | "top";
export type Framing = {
    zoom: number;
    focusX: number;
    focusY: number;
    card: CardSide;
};
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
 * (frame - window) — the inverse of the engine's crop (x = (iw - w) * focusX
 * after a zoom x scale). The crop can never pan past the source's edge, so a
 * headline near the bottom cannot be lifted above a bottom card: it gets the
 * card at the TOP instead.
 */
export declare function frameOn(r: Box, W: number, H: number): Framing;
/**
 * One camera for the whole walk: full view through the build, then
 * ease to each stop and hold, then ease back to the full view and hold.
 * `T` maps planned seconds to clip seconds (the short-clip squeeze).
 */
export declare function walkCamera(plan: WalkPlan, rects: Record<FocusKey, Box>, W: number, H: number, T: (sec: number) => number): MosaicCamera;
