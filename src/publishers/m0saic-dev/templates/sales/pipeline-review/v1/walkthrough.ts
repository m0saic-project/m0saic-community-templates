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
import { keyframeExpr, type Keyframe } from "@m0saic/template-utils";

import { asciiPunct } from "./deals";

/** Every headline a note can sit on, in walkthrough (reading) order. */
export const FOCUS_KEYS = [
  "closedWon",
  "winRate",
  "slipped",
  "openPipeline",
  "byMonth",
  "byRegion",
  "slippedList",
  "topRegion",
  "topRep",
  "biggestOpen",
] as const;
export type FocusKey = (typeof FOCUS_KEYS)[number];
export type Notes = Partial<Record<FocusKey, string>>;

/** On-screen names, ASCII (the note card's label). */
export const FOCUS_LABELS: Record<FocusKey, string> = {
  closedWon: "CLOSED WON",
  winRate: "WIN RATE",
  slipped: "SLIPPED",
  openPipeline: "OPEN PIPELINE",
  byMonth: "WON BY MONTH",
  byRegion: "WON BY REGION",
  slippedList: "NEEDS A NEW CLOSE DATE",
  topRegion: "TOP REGION",
  topRep: "TOP REP",
  biggestOpen: "BIGGEST OPEN DEAL",
};

/** The dashboard's build schedule ends here. */
export const BUILD_SEC = 6.4;
/** Without notes the build takes the first ~45% of the clip; the rest holds. */
export const PLAIN_SEC = 18;
const INTRO_HOLD = 1.0;
const TRAVEL = 1.1;
const PULL_BACK = 1.2;
const END_HOLD = 2.5;
/** A note longer than this will not fit two lines on the card. */
export const MAX_NOTE = 140;
/** The camera never zooms past this — the dashboard is supersampled to match. */
export const MAX_ZOOM = 2;

/** Reading time: ~18 chars/s plus a beat to find the headline, 3-8s. */
export const dwellSec = (note: string): number => Math.min(8, Math.max(3, 1.5 + note.length / 18));

/** The notes that are set, in walkthrough order. Never throws (hosts call it per edit). */
export function noteStops(notes: unknown): Array<{ key: FocusKey; note: string }> {
  const n = notes && typeof notes === "object" ? (notes as Record<string, unknown>) : {};
  return FOCUS_KEYS.flatMap((key) => {
    const note = typeof n[key] === "string" ? asciiPunct(n[key] as string).replace(/\s+/g, " ").trim() : "";
    return note ? [{ key, note }] : [];
  });
}

export type Stop = { key: FocusKey; note: string; departSec: number; arriveSec: number; leaveSec: number };
export type WalkPlan = { stops: Stop[]; pullBackSec: number; endSec: number };

export function planWalk(entries: Array<{ key: FocusKey; note: string }>): WalkPlan {
  let t = BUILD_SEC + INTRO_HOLD;
  const stops = entries.map((e) => {
    const departSec = t;
    const arriveSec = departSec + TRAVEL;
    const leaveSec = arriveSec + dwellSec(e.note);
    t = leaveSec;
    return { ...e, departSec, arriveSec, leaveSec };
  });
  return { stops, pullBackSec: t, endSec: t + PULL_BACK + END_HOLD };
}

/** The clip length the notes ask for, rounded up to 0.1s. */
export function plannedDurationMs(notes: unknown): number {
  const entries = noteStops(notes);
  const sec = entries.length > 0 ? planWalk(entries).endSec : PLAIN_SEC;
  return Math.ceil(sec * 10) * 100;
}

// ── Framing ────────────────────────────────────────────────────────────

export type Box = { x: number; y: number; w: number; h: number };
/** Which edge of the screen the note card sits on for a stop. */
export type CardSide = "bottom" | "top";
export type Framing = { zoom: number; focusX: number; focusY: number; card: CardSide };
const FULL: Framing = { zoom: 1, focusX: 0.5, focusY: 0.5, card: "bottom" };

/** The note card's top edge and height, as frame fractions, per side. */
export const NOTE_CARD: Record<CardSide, { y: number; h: number }> = {
  bottom: { y: 0.79, h: 0.155 },
  top: { y: 0.05, h: 0.155 },
};
/** Where a focused headline may sit on screen (frame fractions): clear of the card. */
const SAFE: Record<CardSide, { x0: number; x1: number; y0: number; y1: number }> = {
  bottom: { x0: 0.05, x1: 0.95, y0: 0.04, y1: 0.76 },
  top: { x0: 0.05, x1: 0.95, y0: 0.24, y1: 0.96 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where `r` lands on screen under a framing (frame px). */
export function screenBox(r: Box, f: Framing, W: number, H: number): { x0: number; y0: number; x1: number; y1: number } {
  const left = f.focusX * (W - W / f.zoom);
  const top = f.focusY * (H - H / f.zoom);
  return { x0: (r.x - left) * f.zoom, y0: (r.y - top) * f.zoom, x1: (r.x + r.w - left) * f.zoom, y1: (r.y + r.h - top) * f.zoom };
}

function frameIn(r: Box, W: number, H: number, card: CardSide): Framing {
  const band = SAFE[card];
  const zoom = clamp(Math.min(((band.x1 - band.x0) * W) / r.w, ((band.y1 - band.y0) * H) / r.h), 1, MAX_ZOOM);
  if (zoom <= 1.001) return { ...FULL, card };
  const vw = W / zoom;
  const vh = H / zoom;
  const left = clamp(r.x + r.w / 2 - ((band.x0 + band.x1) / 2) * vw, 0, W - vw);
  const top = clamp(r.y + r.h / 2 - ((band.y0 + band.y1) / 2) * vh, 0, H - vh);
  return { zoom: Number(zoom.toFixed(4)), focusX: left / (W - vw), focusY: top / (H - vh), card };
}

/**
 * Zoom + focus that put `r` (in the W x H source space) as large as fits
 * clear of the note card, centred in that band. focus = window top-left /
 * (frame - window) — the inverse of the engine's crop (x = (iw - w) * focusX
 * after a zoom x scale). The crop can never pan past the source's edge, so a
 * headline near the bottom cannot be lifted above a bottom card: it gets the
 * card at the TOP instead.
 */
export function frameOn(r: Box, W: number, H: number): Framing {
  const below = frameIn(r, W, H, "bottom");
  return screenBox(r, below, W, H).y1 <= SAFE.bottom.y1 * H + 0.5 ? below : frameIn(r, W, H, "top");
}

/**
 * One camera for the whole walk: full view through the build, then
 * ease to each stop and hold, then ease back to the full view and hold.
 * `T` maps planned seconds to clip seconds (the short-clip squeeze).
 */
export function walkCamera(plan: WalkPlan, rects: Record<FocusKey, Box>, W: number, H: number, T: (sec: number) => number): MosaicCamera {
  const zoom: Keyframe[] = [];
  const fx: Keyframe[] = [];
  const fy: Keyframe[] = [];
  const key = (t: number, f: Framing) => {
    zoom.push({ t, v: f.zoom });
    fx.push({ t, v: f.focusX });
    fy.push({ t, v: f.focusY });
  };
  key(T(plan.stops[0].departSec), FULL);
  for (const s of plan.stops) {
    const f = frameOn(rects[s.key], W, H);
    key(T(s.arriveSec), f);
    key(T(s.leaveSec), f);
  }
  key(T(plan.pullBackSec + PULL_BACK), FULL);
  const opts = { ease: "easeInOut" as const };
  return { zoom: keyframeExpr(zoom, opts), focusX: keyframeExpr(fx, opts), focusY: keyframeExpr(fy, opts) };
}
