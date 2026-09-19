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
export declare const SLIDE_SEC = 0.5;
export declare const RISE_SEC = 0.45;
export declare const DROP_SEC = 0.55;
export declare const ARROW_RISE_SEC = 0.3;
export declare const POP_SEC = 0.5;
/** One bob period (down and back), seconds. */
export declare const BOB_PERIOD_SEC = 1.1;
export declare const STORY_TIMELINE: StoryTimeline;
/**
 * The poster moment: every piece has arrived AND the arrows are at the rest
 * point of their bob (the first bob period boundary after the pill settles),
 * so the still hosts cut from here is the composed card, not a mid-bob.
 */
export declare const SETTLED_AT_SEC: number;
/**
 * Overshooting 0→1 progress (Penner's back-out, c1 = 1.70158): passes 1 by
 * ~10 % before settling — the drop-and-bounce of a slapped-on sticker.
 */
export declare function easeOutBackExpr(atSec: number, durSec: number): string;
/** Slides in along x from `fromDx` px (negative = from the left). */
export declare function slideInX(atSec: number, durSec: number, fromDx: number): MosaicOverlayExpr;
/** Drops in along y from `fromDy` px above (negative) with an overshoot. */
export declare function dropIn(atSec: number, durSec: number, fromDy: number): MosaicOverlayExpr;
/** Fades in while drifting up `driftPx` (the `rise` entrance, in pixels). */
export declare function riseIn(atSec: number, durSec: number, driftPx: number): MosaicOverlayExpr;
/** A quick fade plus an overshooting rise from `driftPx` below — a pop. */
export declare function popIn(atSec: number, durSec: number, driftPx: number): MosaicOverlayExpr;
/**
 * A continuous downward bob of `ampPx` starting at `atSec` (0 there, so it
 * joins the entrance without a jump), as a y term to ADD to an entrance.
 */
export declare function bobTerm(atSec: number, ampPx: number, periodSec?: number): string;
/** An arrow's motion: its rise-in plus the shared bob. */
export declare function arrowMotion(atSec: number, driftPx: number, bobAt: number, ampPx: number): MosaicOverlayExpr;
