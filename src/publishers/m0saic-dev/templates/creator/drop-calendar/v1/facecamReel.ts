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

import type { MosaicTimeRangeMs, MosaicXfadeMode } from "@m0saic/types";
import { MOSAIC_XFADE_MODES_SET } from "@m0saic/types";
import { normalizeTimeRanges, parseTimeRangesValue } from "@m0saic/template-utils";

/** Clip cap — one pipeline step per clip (the engine stitches up to 80). */
export const MAX_FACECAM_CLIPS = 24;

export const DEFAULT_TRANSITION_SEC = 0.4;
const MIN_TRANSITION_SEC = 0.05;
const MAX_TRANSITION_SEC = 3;

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
export type FacecamReelOutcome = { reel?: FacecamReel; warnings: string[] };

/** Unknown/blank style → "fade" (the friendly default for talking heads). */
export function normalizeTransition(style: unknown): FacecamTransition {
  if (style === "cut") return "cut";
  return typeof style === "string" && MOSAIC_XFADE_MODES_SET.has(style)
    ? (style as MosaicXfadeMode)
    : "fade";
}

export function normalizeTransitionMs(sec: unknown): number {
  const n = typeof sec === "number" && Number.isFinite(sec) ? sec : DEFAULT_TRANSITION_SEC;
  return Math.round(Math.min(MAX_TRANSITION_SEC, Math.max(MIN_TRANSITION_SEC, n)) * 1000);
}

/**
 * Raw `facecamClips` prop → the reel. Recoverable problems (a JSON payload
 * that won't parse, a region outside the footage, more clips than the cap)
 * warn and degrade toward "play the whole facecam" rather than failing —
 * a bad range must never cost the user their calendar.
 */
export function resolveFacecamReel(
  raw: unknown,
  opts: {
    /** Probed facecam length; omitted = don't clamp (no probe available). */
    sourceDurationMs?: number;
    transitionStyle?: unknown;
    transitionSec?: unknown;
  } = {},
): FacecamReelOutcome {
  const warnings: string[] = [];
  if (raw === undefined || raw === null) return { warnings };
  if (Array.isArray(raw) && raw.length === 0) return { warnings };

  const parsed = parseTimeRangesValue(raw);
  if (!parsed.ok) {
    warnings.push(`Facecam clips ignored — ${parsed.error} Rendering the whole facecam.`);
    return { warnings };
  }
  let ranges: MosaicTimeRangeMs[] = parsed.ranges;
  if (ranges.length === 0) return { warnings };
  if (ranges.length > MAX_FACECAM_CLIPS) {
    warnings.push(
      `Facecam clips capped at ${MAX_FACECAM_CLIPS}; ${ranges.length - MAX_FACECAM_CLIPS} extra clip(s) dropped.`,
    );
    ranges = ranges.slice(0, MAX_FACECAM_CLIPS);
  }

  const sourceDurationMs =
    typeof opts.sourceDurationMs === "number" &&
    Number.isFinite(opts.sourceDurationMs) &&
    opts.sourceDurationMs > 0
      ? Math.round(opts.sourceDurationMs)
      : Number.MAX_SAFE_INTEGER;

  // Order is USER INTENT — never sorted (the wire contract's rule, and the
  // reel plays in the order the picker wrote).
  const kept: Array<{ startMs: number; endMs: number; label?: string }> = [];
  const verdicts = normalizeTimeRanges(ranges, sourceDurationMs);
  for (let i = 0; i < verdicts.length; i++) {
    const v = verdicts[i];
    if (!v.ok) {
      warnings.push(`Facecam clip #${i + 1} skipped — ${v.reason}.`);
      continue;
    }
    kept.push(
      v.label !== undefined
        ? { startMs: v.startMs, endMs: v.endMs, label: v.label }
        : { startMs: v.startMs, endMs: v.endMs },
    );
  }
  if (kept.length === 0) {
    warnings.push("No usable facecam clips; rendering the whole facecam.");
    return { warnings };
  }

  const transition = normalizeTransition(opts.transitionStyle);
  const transitionMs = normalizeTransitionMs(opts.transitionSec);

  const clips: FacecamClip[] = [];
  let outStartMs = 0;
  for (let i = 0; i < kept.length; i++) {
    const k = kept[i];
    const durationMs = k.endMs - k.startMs;
    const next = kept[i + 1];
    // Mirror the engine's clamp: the overlap can't exceed either neighbor.
    const overlapMs =
      transition === "cut" || next === undefined
        ? 0
        : Math.min(transitionMs, durationMs, next.endMs - next.startMs);
    clips.push({
      startMs: k.startMs,
      endMs: k.endMs,
      durationMs,
      outStartMs,
      overlapMs,
      ...(k.label !== undefined ? { label: k.label } : {}),
    });
    outStartMs += durationMs - overlapMs;
  }

  return { reel: { clips, totalMs: outStartMs, transition, transitionMs }, warnings };
}

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
export function mapFacecamWindow(
  reel: FacecamReel,
  startMs: number,
  endMs?: number,
): { startMs: number; endMs?: number } | undefined {
  const clip = reel.clips.find((c) => startMs >= c.startMs && startMs < c.endMs);
  if (clip === undefined) return undefined;
  const outStart = clip.outStartMs + (startMs - clip.startMs);
  if (endMs === undefined) return { startMs: outStart };
  const clampedEnd = Math.min(Math.max(endMs, startMs + 1), clip.endMs);
  return { startMs: outStart, endMs: clip.outStartMs + (clampedEnd - clip.startMs) };
}
