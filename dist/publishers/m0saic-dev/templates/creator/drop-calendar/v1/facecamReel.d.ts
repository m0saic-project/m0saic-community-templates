/**
 * Facecam reel — the picked regions of the facecam, resolved to a play order.
 *
 * The `picker: "time-ranges"` prop (the highlight-clips scrubber) hands us
 * source-relative `[startMs, endMs)` regions of the facecam file — the same
 * wire contract `@m0saic/media/highlights/v1` uses. ONE region trims the
 * facecam to that span; SEVERAL become a reel: one pipeline step per region,
 * joined by an xfade, so a talking-head can be cut down to only the moments
 * that matter without leaving the template.
 *
 * The overlap math mirrors the engine's concat model exactly (`out = A + B − d`
 * with `d` clamped to the shorter neighbor — buildMosaicPlanFromFile's
 * `resolveXfadeBoundaries`), because two other things read these numbers:
 *
 * - the render duration — a reel with no host duration IS the render length;
 * - the talk track — cues are stamped against the FULL facecam in the cue
 *   studio, so every cue time is a SOURCE time that has to be carried onto
 *   the cut timeline (see {@link mapFacecamWindow}).
 *
 * Pure and deterministic: props in, numbers out. No probing, no clock.
 */
import type { MosaicXfadeMode } from "@m0saic/types";
/** Clip cap — one pipeline step per clip (the engine stitches up to 80). */
export declare const MAX_FACECAM_CLIPS = 24;
export declare const DEFAULT_TRANSITION_SEC = 0.4;
/** A hard cut, or any of the engine's 58 xfade kernels. */
export type FacecamTransition = "cut" | MosaicXfadeMode;
export type FacecamClip = {
    /** Source-relative bounds of the picked region (ms). */
    startMs: number;
    endMs: number;
    durationMs: number;
    /** Where this clip opens on the REEL's timeline (ms). */
    outStartMs: number;
    /** Crossfade overlap with the NEXT clip (0 on a cut and on the last clip). */
    overlapMs: number;
    label?: string;
};
export type FacecamReel = {
    clips: FacecamClip[];
    /** Reel length: Σ clip durations − Σ transition overlaps. */
    totalMs: number;
    transition: FacecamTransition;
    /** Authored overlap, ms — per-boundary clamping lives on the clip. */
    transitionMs: number;
};
/** No `reel` = play the whole facecam (the pre-clips behavior). */
export type FacecamReelOutcome = {
    reel?: FacecamReel;
    warnings: string[];
};
/** Unknown/blank style → "fade" (the friendly default for talking heads). */
export declare function normalizeTransition(style: unknown): FacecamTransition;
export declare function normalizeTransitionMs(sec: unknown): number;
/**
 * Raw `facecamClips` prop → the reel. Recoverable problems (a JSON payload
 * that won't parse, a region outside the footage, more clips than the cap)
 * warn and degrade toward "play the whole facecam" rather than failing —
 * a bad range must never cost the user their calendar.
 */
export declare function resolveFacecamReel(raw: unknown, opts?: {
    /** Probed facecam length; omitted = don't clamp (no probe available). */
    sourceDurationMs?: number;
    transitionStyle?: unknown;
    transitionSec?: unknown;
}): FacecamReelOutcome;
/**
 * Carry a cue's SOURCE-time window (what the cue studio stamped against the
 * full facecam) onto the reel's output timeline.
 *
 * Returns undefined when the cue lands in footage the user cut out — that
 * moment isn't in the render, so the caller drops the cue. An end that ran
 * past its clip's out-point clamps to the cut: the highlight ends when the
 * footage does. Overlapping clips resolve to the FIRST clip containing the
 * start (the picker allows overlaps; the reel plays them in order).
 */
export declare function mapFacecamWindow(reel: FacecamReel, startMs: number, endMs?: number): {
    startMs: number;
    endMs?: number;
} | undefined;
