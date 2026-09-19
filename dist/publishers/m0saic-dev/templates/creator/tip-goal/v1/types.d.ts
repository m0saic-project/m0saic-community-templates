import type { MosaicTemplatePropDefinition } from "@m0saic/types";
/**
 * Tip Goal props — a streamer-style donation/tip progress bar attachable to
 * any video: a rounded track fills toward a goal while a currency counter
 * ticks up. The GENERATOR owns the timeline — the amount rises exactly when
 * the schedule says it does, so the overlay can seed the "donations are
 * already coming in" look on pre-cut footage, or mirror a real tracker.
 *
 * Canonical timing is an absolute amount timeline ("anchors"): the seeded
 * auto generator and the human tips rows both AUTHOR that anchor list; the
 * agent `schedule` prop writes it directly. Precedence:
 * schedule > tips > auto.
 */
export type RiseEase = "linear" | "easeOut" | "smoothstep" | "easeInOut";
export type TipGoalCurve = "steady" | "big-finish" | "fast-start";
export type TipGoalBarPlacement = "bottom" | "top" | "center";
export type TipGoalLabelPlacement = "left" | "right" | "above" | "none";
/** One human tip row: a DELTA added to the running total at `atSec`. */
export type TipGoalTip = {
    atSec: number;
    /** Amount added (negative = refund). */
    amount: number;
};
/**
 * One agent schedule key: the ABSOLUTE running total at `atSec`. The value
 * eases from each key to the next (`ease` shapes the segment leaving the
 * key; default linear), holds before the first and after the last — so
 * steps are authored by doubling keys at the same time.
 */
export type TipGoalAnchor = {
    atSec: number;
    amount: number;
    ease?: RiseEase;
};
export type TipGoalAuto = {
    /** Seed for the tip generator (mulberry32). Default 1. */
    seed?: number;
    /** How many tips to fabricate. Default 12. */
    tipCount?: number;
    /** Pacing shape: steady, cluster-late (big-finish), or cluster-early. */
    curve?: TipGoalCurve;
    /** Quiet lead-in before the first tip, seconds. Default 1.5. */
    startDelaySec?: number;
    /** Fraction of the clip where the goal lands. Default 0.9. */
    finishFrac?: number;
};
export type TipGoalBar = {
    placement?: TipGoalBarPlacement;
    /** Widget width as a fraction of canvas width. Default 0.94. */
    widthFrac?: number;
    /** Widget height as a fraction of canvas height. Default 0.11. */
    heightFrac?: number;
    /** Vertical edge margin as a fraction of canvas height. Default 0.05. */
    marginFrac?: number;
    /** Corner rounding, 0..0.5 (0.5 = pill). Default 0.5. */
    rounding?: number;
    trackColor?: string;
    fillColor?: string;
    /** Replace the drawn track with an image (stretched cover). */
    trackImage?: string;
    /** Replace the drawn fill with an image (e.g. gradient art); it slides. */
    fillImage?: string;
    /** Flash the bar briefly on each tip. Default true. */
    tipFlash?: boolean;
    /** Flash color (supports alpha). Default #FFFFFF@0.4. */
    flashColor?: string;
};
export type TipGoalLabel = {
    placement?: TipGoalLabelPlacement;
    /** Label zone width as a fraction of widget width (left/right). Default 0.16. */
    widthFrac?: number;
    /** Multiplier on the auto-fit font size. Default 1. */
    fontScale?: number;
    color?: string;
    outlineColor?: string;
    /** Outline width as a fraction of font size (0 = none). Default 0.07. */
    outlineFrac?: number;
    /** Bold counter. Default true. */
    bold?: boolean;
};
/** Agent exact-pixel geometry overrides (output-canvas px), merged per-field. */
export type TipGoalGeometryOverride = {
    barRect?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    labelRect?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    fontSizePx?: number;
};
export type TipGoalV1Props = {
    /** The video/image the overlay attaches to. Empty → standalone demo. */
    sourceId?: string;
    /** Canvas background when no source is set; alpha-0 → transparent overlay. */
    backgroundColor?: string;
    reduceMotion?: boolean;
    /** Amount that fills the bar completely. Default 100. */
    goalAmount?: number;
    /** Running total at t=0. Default 0. */
    startAmount?: number;
    /** Literal prefix before the number. Default "$". */
    currency?: string;
    /** Literal appended after the number. Default "". */
    suffix?: string;
    /** Append " / <currency><goal>" after the counter. Default false. */
    showGoal?: boolean;
    /** Seconds each tip animates from the old total to the new. Default 0.6. */
    riseSec?: number;
    /** Easing of each rise. Default "easeOut". */
    riseEase?: RiseEase;
    auto?: TipGoalAuto;
    /** Human tip rows (deltas). Wins over Auto. */
    tips?: TipGoalTip[];
    /** Agent absolute amount keyframes. Wins over Tips and Auto. */
    schedule?: TipGoalAnchor[];
    bar?: TipGoalBar;
    label?: TipGoalLabel;
    /**
     * ESCAPE HATCH: an m0 layout for the intended canvas resolving to exactly
     * ONE rect — the widget band (wide, w >= 2h). Overrides the placement
     * preset; the label/bar split still happens inside it.
     */
    layoutM0?: string;
    /** Agent per-field pixel overrides; wins over layoutM0 + presets. */
    geometry?: TipGoalGeometryOverride;
    /** Dev-only layout contract: draw the contract wireframe + assert the
     *  counter fits its slot. Default false. */
    debugLayout?: boolean;
};
export declare const TipGoalPropsSchema: Record<keyof TipGoalV1Props, MosaicTemplatePropDefinition>;
