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
import { keyframeExpr, type Keyframe } from "@m0saic/template-utils";

export type Box = { x: number; y: number; w: number; h: number };
export type Stop = { index: number; note: string; departSec: number; arriveSec: number; leaveSec: number };
export type WalkPlan = { buildSec: number; stops: Stop[]; pullBackSec: number; endSec: number };

const INTRO_HOLD = 1.0;
const TRAVEL = 1.1;
export const PULL_BACK = 1.2;
const END_HOLD = 2.5;
/** A note longer than this will not fit two lines on the card. */
export const MAX_NOTE = 140;
/** The camera never zooms past this - the board is supersampled to match. */
export const MAX_ZOOM = 2;

/** Reading time: ~18 chars/s plus a beat to find the tile, 3-8s. */
export const dwellSec = (note: string): number => Math.min(8, Math.max(3, 1.5 + note.length / 18));

/** The walk after the board has built: one stop per noted tile, in tile order. */
export function planWalk(buildSec: number, entries: Array<{ index: number; note: string }>): WalkPlan {
  let t = buildSec + INTRO_HOLD;
  const stops = entries.map((e) => {
    const departSec = t;
    const arriveSec = departSec + TRAVEL;
    const leaveSec = arriveSec + dwellSec(e.note);
    t = leaveSec;
    return { ...e, departSec, arriveSec, leaveSec };
  });
  return { buildSec, stops, pullBackSec: t, endSec: t + PULL_BACK + END_HOLD };
}

// ── Framing ────────────────────────────────────────────────────────────

/** Which edge of the screen the note card sits on for a stop. */
export type CardSide = "bottom" | "top";
export type Framing = { zoom: number; focusX: number; focusY: number; card: CardSide };
export const FULL: Framing = { zoom: 1, focusX: 0.5, focusY: 0.5, card: "bottom" };

/** The note card's top edge and height, as frame fractions, per side. */
export const NOTE_CARD: Record<CardSide, { y: number; h: number }> = {
  bottom: { y: 0.79, h: 0.155 },
  top: { y: 0.05, h: 0.155 },
};
/** Where a focused tile may sit on screen (frame fractions): clear of the card. */
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
 * (frame - window) - the inverse of the engine's crop. The crop can never
 * pan past the source's edge, so a tile near the bottom cannot be lifted
 * above a bottom card: it gets the card at the TOP instead.
 */
export function frameOn(r: Box, W: number, H: number): Framing {
  const below = frameIn(r, W, H, "bottom");
  return screenBox(r, below, W, H).y1 <= SAFE.bottom.y1 * H + 0.5 ? below : frameIn(r, W, H, "top");
}

/**
 * One camera for the whole walk: full view through the build, then ease to
 * each stop and hold, then ease back to the full view and hold. `T` maps
 * planned seconds to clip seconds (the pinned-clip squeeze).
 */
export function walkCamera(plan: WalkPlan, rects: Box[], W: number, H: number, T: (sec: number) => number): MosaicCamera {
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
    const f = frameOn(rects[s.index], W, H);
    key(T(s.arriveSec), f);
    key(T(s.leaveSec), f);
  }
  key(T(plan.pullBackSec + PULL_BACK), FULL);
  const opts = { ease: "easeInOut" as const };
  return { zoom: keyframeExpr(zoom, opts), focusX: keyframeExpr(fx, opts), focusY: keyframeExpr(fy, opts) };
}
