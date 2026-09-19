/**
 * Schedule — the amount timeline. Every input mode (auto generator, human
 * tips rows, agent schedule keys) resolves to one ascending ANCHOR list
 * `{ t, v, ease? }` = "the running total is v at t". From it:
 *
 *   - the counter text: one drawtext expr layer,
 *     `$%{eif\:(<keyframe sum>)+0.5\:d}` (the alpine count-up idiom, but the
 *     value is the full piecewise timeline, not a single ramp);
 *   - the fill motion: `xExpr = -(w*(1-(<frac keyframe sum>)))` — the slide
 *     IS the grow (the alpine progress-card mechanism), clipped by the bar
 *     child document;
 *   - the tip flash: an explicit `between` union gate (the beat-hero gate
 *     shape).
 *
 * Anchors compile via `keyframeExpr` (flat gated sums, parser-safe) and are
 * rebalanced before use; drawtext copies get their commas escaped (`\,`).
 */
import { type EaseName } from "@m0saic/template-utils";
import type { RiseEase, TipGoalAuto, TipGoalTip } from "./types";
/** Tip ceiling — each tip is two anchors + one flash gate term. */
export declare const MAX_TIPS = 180;
/** Anchor ceiling (schedule mode) — keyframeExpr terms stay parser-safe. */
export declare const MAX_ANCHORS = 400;
/** Minimum spacing nudge between generated anchor times, seconds. */
export declare const MIN_STEP_SEC = 0.02;
/** Tip-flash gate length, seconds. */
export declare const FLASH_SEC = 0.25;
export type AmountAnchor = {
    t: number;
    v: number;
    ease?: EaseName;
};
export type ScheduleMode = "schedule" | "tips" | "auto";
export type ScheduleOutcome = {
    ok: true;
    anchors: AmountAnchor[];
    /** Rise-start times — the flash gate + tests key off these. */
    tipTimes: number[];
    finalAmount: number;
    mode: ScheduleMode;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
export declare function round3(x: number): number;
export declare function fmt3(x: number): string;
export declare function sanitizeRiseEase(v: unknown, def?: RiseEase): RiseEase;
/**
 * Resolve the amount timeline. Precedence: schedule > tips > auto. A present
 * but EMPTY schedule/tips array falls through (an empty rows table is "unset",
 * not "flat-line the bar").
 */
export declare function resolveSchedule(input: {
    schedule?: unknown;
    tips?: unknown;
    auto?: TipGoalAuto | undefined;
    startAmount: number;
    goalAmount: number;
    riseSec: number;
    riseEase: RiseEase;
}, durationSec: number): ScheduleOutcome;
/**
 * Tips (deltas) → anchors: hold at the running total until each tip, then
 * ease to the new total over `riseSec` (auto-shortened when the next tip
 * crowds in; 0 = an instant step). Totals clamp at 0 so refunds can't dip
 * the board negative.
 */
export declare function anchorsFromTips(tips: TipGoalTip[], startAmount: number, riseSec: number, riseEase: RiseEase, durationSec: number, mode: ScheduleMode, warnings: string[]): ScheduleOutcome;
/**
 * The seeded tip fabricator: `tipCount` tips inside
 * [startDelaySec, finishFrac*duration], summing exactly to
 * `goalAmount - startAmount`. Times come from normalized random gaps bent by
 * the curve exponent (big-finish densifies late, fast-start early); amounts
 * from squared-random weights (mostly small, the odd whale) with the curve
 * biasing bigger tips toward its dense end. Integer amounts (each >= 1)
 * whenever the total allows — donation realism.
 */
export declare function generateAutoTips(auto: TipGoalAuto, startAmount: number, goalAmount: number, durationSec: number, warnings: string[]): TipGoalTip[];
/**
 * Split `total` across `weights.length` tips. Integer totals >= n get an
 * integer largest-remainder split with a floor of 1 per tip; otherwise
 * proportional amounts rounded to cents with the residue folded into the
 * last tip.
 */
export declare function splitTotal(total: number, weights: number[]): number[];
/**
 * The fill slide: `-(w*(1-frac(t)))` where frac is the amount timeline over
 * the goal, clamped to [0,1] per anchor (overshoot pins the bar full; the
 * counter keeps counting).
 */
export declare function buildFillXExpr(anchors: AmountAnchor[], goalAmount: number): string;
/**
 * The counter: literal prefix/suffix around a drawtext `%{eif\:…\:d}` whose
 * expression is the full amount timeline (commas escaped for drawtext
 * expansion; `+0.5` rounds — eif:d truncates).
 */
export declare function buildCounterTextExpr(anchors: AmountAnchor[], prefix: string, suffix: string): string;
/** In drawtext expansion=normal, `%`, `{`, `}` are control chars. */
export declare function escapeDrawtextLiteral(s: string): string;
export type FlashGate = {
    enable: string;
    window: {
        startSec: number;
        endSec: number;
    };
};
/** Explicit union gate over the tip times (the beat-hero gate shape). */
export declare function buildTipFlashGate(tipTimes: number[], durSec?: number): FlashGate | undefined;
/**
 * Evaluate the anchor timeline at `t` with keyframeExpr semantics: hold
 * before the first key, ease between adjacent keys (the ease on the key
 * being LEFT; default linear), hold after the last.
 */
export declare function evalAnchors(anchors: AmountAnchor[], t: number): number;
