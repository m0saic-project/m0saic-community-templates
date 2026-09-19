/**
 * `resolveTipGoal` — the ONE pure function between props and rendering.
 *
 * Precedence:
 * - Amount timeline: schedule > tips > auto (see schedule.ts).
 * - Placement: geometry.* (per-field) > layoutM0 (whole band) > placement
 *   preset > default. (Applied in layout.ts; validated here.)
 *
 * Philosophy (the beat-hero contract): explicit broken intent → a `TG_*`
 * error; out-of-range numerics clamp; unset → default; degradable extras
 * degrade with a warning. Never throws.
 */
import type { RiseEase, TipGoalBarPlacement, TipGoalGeometryOverride, TipGoalLabelPlacement, TipGoalV1Props } from "./types";
import { type AmountAnchor, type ScheduleMode } from "./schedule";
import { type Rect } from "./layout";
export type ResolvedBar = {
    placement: TipGoalBarPlacement;
    widthFrac: number;
    heightFrac: number;
    marginFrac: number;
    rounding: number;
    trackColor: string;
    fillColor: string;
    trackImage?: string;
    fillImage?: string;
    tipFlash: boolean;
    flashColor: string;
};
export type ResolvedLabel = {
    placement: TipGoalLabelPlacement;
    widthFrac: number;
    fontScale: number;
    color: string;
    outlineColor: string;
    outlineFrac: number;
    bold: boolean;
};
export type ResolvedConfig = {
    durationSec: number;
    anchors: AmountAnchor[];
    tipTimes: number[];
    finalAmount: number;
    scheduleMode: ScheduleMode;
    goalAmount: number;
    startAmount: number;
    /** Literal before the counter number. */
    prefix: string;
    /** Literal after the counter number (user suffix + optional goal readout). */
    suffixText: string;
    riseSec: number;
    riseEase: RiseEase;
    reduceMotion: boolean;
    background: {
        color: string;
        transparent: boolean;
    };
    sourceId?: string;
    bar: ResolvedBar;
    label: ResolvedLabel;
    /** Whole-band placement from the validated layoutM0 hatch. */
    layoutRect?: Rect;
    geometryOverride: TipGoalGeometryOverride;
};
export type ResolveOutcome = {
    ok: true;
    cfg: ResolvedConfig;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
export declare function resolveTipGoal(props: TipGoalV1Props, W: number, H: number, durationSec: number): ResolveOutcome;
/** Integer display when whole; otherwise trimmed to at most 2 decimals. */
export declare function formatAmount(v: number): string;
/** A cleared color picker yields "" (not nullish) — resolve to the fallback. */
export declare function resolveColor(v: string | undefined, fallback: string): string;
/** Transparent when the color's alpha suffix is 0 (e.g. "black@0"). */
export declare function resolveBackground(v: string | undefined): {
    color: string;
    transparent: boolean;
};
