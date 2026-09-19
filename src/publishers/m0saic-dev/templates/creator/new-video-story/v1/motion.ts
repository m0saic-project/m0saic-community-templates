/**
 * Motion — the story's choreography as ffmpeg overlay expressions
 * (`xExpr` / `yExpr` / `alpha` / `enable`), one bundle per piece. Every
 * distance is a PIXEL LITERAL, not a tile-local `W`/`H` fraction: pieces that
 * move together (a sticker line's halo + stroke + fill, the pill's body +
 * glyph + text) have different cell sizes, and a fraction of each cell would
 * pull them apart. Pixel literals also let the app preview evaluate the same
 * expression in canvas space.
 *
 * The timeline (seconds from the start of the render):
 *
 *   0.00  screenshot rises in
 *   0.15  small headline line slides in from the left
 *   0.25  big headline line slides in from the right
 *   0.55  badge drops in from above with an overshoot
 *   0.85  CTA box rises in
 *   1.15  arrows cascade in (0.15 s apart), then bob forever
 *   1.65  link pill pops up (fade + overshoot from below)
 *
 * All exprs read absolute `t`; `enable` gates and `window` lifetimes let the
 * engine skip a piece's upstream work while it is off-canvas. Functions used
 * (min, max, pow, cos, gte, PI) are in both ffmpeg's evaluator and the
 * preview's subset.
 */

import type { MosaicOverlayExpr } from "@m0saic/types";
import { easingExpr, progressExpr } from "@m0saic/template-utils";

export type StoryTimeline = {
  mediaAt: number;
  headlineTopAt: number;
  headlineMainAt: number;
  badgeAt: number;
  ctaAt: number;
  arrowsAt: [number, number, number];
  pillAt: number;
  /** When the arrows start bobbing (after the last one has arrived). */
  bobAt: number;
};

export const SLIDE_SEC = 0.5;
export const RISE_SEC = 0.45;
export const DROP_SEC = 0.55;
export const ARROW_RISE_SEC = 0.3;
export const POP_SEC = 0.5;
/** One bob period (down and back), seconds. */
export const BOB_PERIOD_SEC = 1.1;

export const STORY_TIMELINE: StoryTimeline = {
  mediaAt: 0,
  headlineTopAt: 0.15,
  headlineMainAt: 0.25,
  badgeAt: 0.55,
  ctaAt: 0.85,
  arrowsAt: [1.15, 1.3, 1.45],
  pillAt: 1.65,
  bobAt: 1.45 + ARROW_RISE_SEC,
};

/**
 * The poster moment: every piece has arrived AND the arrows are at the rest
 * point of their bob (the first bob period boundary after the pill settles),
 * so the still hosts cut from here is the composed card, not a mid-bob.
 */
export const SETTLED_AT_SEC = (() => {
  const settled = STORY_TIMELINE.pillAt + POP_SEC;
  const k = Math.ceil((settled - STORY_TIMELINE.bobAt) / BOB_PERIOD_SEC);
  return Math.round((STORY_TIMELINE.bobAt + k * BOB_PERIOD_SEC) * 1000) / 1000;
})();

const f3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/** Eased 0→1 progress over `[atSec, atSec + durSec]` (ease-out). */
function easeOut(atSec: number, durSec: number): string {
  return easingExpr("easeOut", progressExpr(atSec, durSec));
}

/**
 * Overshooting 0→1 progress (Penner's back-out, c1 = 1.70158): passes 1 by
 * ~10 % before settling — the drop-and-bounce of a slapped-on sticker.
 */
export function easeOutBackExpr(atSec: number, durSec: number): string {
  const u = `(${progressExpr(atSec, durSec)})`;
  return `(1+2.70158*pow(${u}-1,3)+1.70158*pow(${u}-1,2))`;
}

/** Slides in along x from `fromDx` px (negative = from the left). */
export function slideInX(atSec: number, durSec: number, fromDx: number): MosaicOverlayExpr {
  return {
    xExpr: `(1-${easeOut(atSec, durSec)})*${f3(fromDx)}`,
    enable: `gte(t,${f3(atSec)})`,
    startAtSec: atSec,
    window: { startSec: atSec },
  };
}

/** Drops in along y from `fromDy` px above (negative) with an overshoot. */
export function dropIn(atSec: number, durSec: number, fromDy: number): MosaicOverlayExpr {
  return {
    yExpr: `(1-${easeOutBackExpr(atSec, durSec)})*${f3(fromDy)}`,
    enable: `gte(t,${f3(atSec)})`,
    startAtSec: atSec,
    window: { startSec: atSec },
  };
}

/** Fades in while drifting up `driftPx` (the `rise` entrance, in pixels). */
export function riseIn(atSec: number, durSec: number, driftPx: number): MosaicOverlayExpr {
  const p = easeOut(atSec, durSec);
  return {
    alpha: p,
    yExpr: `(1-${p})*${f3(driftPx)}`,
    startAtSec: atSec,
    window: { startSec: atSec },
  };
}

/** A quick fade plus an overshooting rise from `driftPx` below — a pop. */
export function popIn(atSec: number, durSec: number, driftPx: number): MosaicOverlayExpr {
  const fade = progressExpr(atSec, Math.max(0.05, durSec * 0.45));
  return {
    alpha: fade,
    yExpr: `(1-${easeOutBackExpr(atSec, durSec)})*${f3(driftPx)}`,
    startAtSec: atSec,
    window: { startSec: atSec },
  };
}

/**
 * A continuous downward bob of `ampPx` starting at `atSec` (0 there, so it
 * joins the entrance without a jump), as a y term to ADD to an entrance.
 */
export function bobTerm(atSec: number, ampPx: number, periodSec = BOB_PERIOD_SEC): string {
  return `gte(t,${f3(atSec)})*${f3(ampPx)}*(0.5-0.5*cos(2*PI*(t-${f3(atSec)})/${f3(periodSec)}))`;
}

/** An arrow's motion: its rise-in plus the shared bob. */
export function arrowMotion(atSec: number, driftPx: number, bobAt: number, ampPx: number): MosaicOverlayExpr {
  const rise = riseIn(atSec, ARROW_RISE_SEC, driftPx);
  return { ...rise, yExpr: `(${rise.yExpr})+${bobTerm(bobAt, ampPx)}` };
}
