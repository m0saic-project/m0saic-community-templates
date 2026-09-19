"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TRANSITION_SEC = exports.MAX_FACECAM_CLIPS = void 0;
exports.normalizeTransition = normalizeTransition;
exports.normalizeTransitionMs = normalizeTransitionMs;
exports.resolveFacecamReel = resolveFacecamReel;
exports.mapFacecamWindow = mapFacecamWindow;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
/** Clip cap — one pipeline step per clip (the engine stitches up to 80). */
exports.MAX_FACECAM_CLIPS = 24;
exports.DEFAULT_TRANSITION_SEC = 0.4;
const MIN_TRANSITION_SEC = 0.05;
const MAX_TRANSITION_SEC = 3;
/** Unknown/blank style → "fade" (the friendly default for talking heads). */
function normalizeTransition(style) {
    if (style === "cut")
        return "cut";
    return typeof style === "string" && types_1.MOSAIC_XFADE_MODES_SET.has(style)
        ? style
        : "fade";
}
function normalizeTransitionMs(sec) {
    const n = typeof sec === "number" && Number.isFinite(sec) ? sec : exports.DEFAULT_TRANSITION_SEC;
    return Math.round(Math.min(MAX_TRANSITION_SEC, Math.max(MIN_TRANSITION_SEC, n)) * 1000);
}
/**
 * Raw `facecamClips` prop → the reel. Recoverable problems (a JSON payload
 * that won't parse, a region outside the footage, more clips than the cap)
 * warn and degrade toward "play the whole facecam" rather than failing —
 * a bad range must never cost the user their calendar.
 */
function resolveFacecamReel(raw, opts = {}) {
    const warnings = [];
    if (raw === undefined || raw === null)
        return { warnings };
    if (Array.isArray(raw) && raw.length === 0)
        return { warnings };
    const parsed = (0, template_utils_1.parseTimeRangesValue)(raw);
    if (!parsed.ok) {
        warnings.push(`Facecam clips ignored — ${parsed.error} Rendering the whole facecam.`);
        return { warnings };
    }
    let ranges = parsed.ranges;
    if (ranges.length === 0)
        return { warnings };
    if (ranges.length > exports.MAX_FACECAM_CLIPS) {
        warnings.push(`Facecam clips capped at ${exports.MAX_FACECAM_CLIPS}; ${ranges.length - exports.MAX_FACECAM_CLIPS} extra clip(s) dropped.`);
        ranges = ranges.slice(0, exports.MAX_FACECAM_CLIPS);
    }
    const sourceDurationMs = typeof opts.sourceDurationMs === "number" &&
        Number.isFinite(opts.sourceDurationMs) &&
        opts.sourceDurationMs > 0
        ? Math.round(opts.sourceDurationMs)
        : Number.MAX_SAFE_INTEGER;
    // Order is USER INTENT — never sorted (the wire contract's rule, and the
    // reel plays in the order the picker wrote).
    const kept = [];
    const verdicts = (0, template_utils_1.normalizeTimeRanges)(ranges, sourceDurationMs);
    for (let i = 0; i < verdicts.length; i++) {
        const v = verdicts[i];
        if (!v.ok) {
            warnings.push(`Facecam clip #${i + 1} skipped — ${v.reason}.`);
            continue;
        }
        kept.push(v.label !== undefined
            ? { startMs: v.startMs, endMs: v.endMs, label: v.label }
            : { startMs: v.startMs, endMs: v.endMs });
    }
    if (kept.length === 0) {
        warnings.push("No usable facecam clips; rendering the whole facecam.");
        return { warnings };
    }
    const transition = normalizeTransition(opts.transitionStyle);
    const transitionMs = normalizeTransitionMs(opts.transitionSec);
    const clips = [];
    let outStartMs = 0;
    for (let i = 0; i < kept.length; i++) {
        const k = kept[i];
        const durationMs = k.endMs - k.startMs;
        const next = kept[i + 1];
        // Mirror the engine's clamp: the overlap can't exceed either neighbor.
        const overlapMs = transition === "cut" || next === undefined
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
function mapFacecamWindow(reel, startMs, endMs) {
    const clip = reel.clips.find((c) => startMs >= c.startMs && startMs < c.endMs);
    if (clip === undefined)
        return undefined;
    const outStart = clip.outStartMs + (startMs - clip.startMs);
    if (endMs === undefined)
        return { startMs: outStart };
    const clampedEnd = Math.min(Math.max(endMs, startMs + 1), clip.endMs);
    return { startMs: outStart, endMs: clip.outStartMs + (clampedEnd - clip.startMs) };
}
