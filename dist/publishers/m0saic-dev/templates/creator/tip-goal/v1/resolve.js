"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTipGoal = resolveTipGoal;
exports.formatAmount = formatAmount;
exports.resolveColor = resolveColor;
exports.resolveBackground = resolveBackground;
const schedule_1 = require("./schedule");
const layout_1 = require("./layout");
function resolveTipGoal(props, W, H, durationSec) {
    const warnings = [];
    const reduceMotion = props.reduceMotion === true;
    // ── Money semantics ──
    const goalAmount = clampNum(props.goalAmount, 100, 0.01, 100_000_000);
    if (typeof props.goalAmount === "number" && props.goalAmount <= 0) {
        return err("TG_GOAL", `goalAmount must be > 0 (got ${props.goalAmount}) — it is the amount that fills the bar.`);
    }
    const startAmount = clampWarn(clampNum(props.startAmount, 0, 0, 100_000_000), 0, goalAmount * 100, "startAmount", warnings);
    const prefix = typeof props.currency === "string" ? props.currency : "$";
    const userSuffix = typeof props.suffix === "string" ? props.suffix : "";
    const goalReadout = props.showGoal === true ? ` / ${prefix}${formatAmount(goalAmount)}` : "";
    const suffixText = `${userSuffix}${goalReadout}`;
    // ── Timeline ──
    const riseSec = clampNum(props.riseSec, 0.6, 0, 10);
    const riseEase = (0, schedule_1.sanitizeRiseEase)(props.riseEase);
    const schedule = (0, schedule_1.resolveSchedule)({
        schedule: props.schedule,
        tips: props.tips,
        auto: props.auto,
        startAmount,
        goalAmount,
        riseSec,
        riseEase,
    }, durationSec);
    if (!schedule.ok)
        return schedule;
    warnings.push(...schedule.warnings);
    // ── Look ──
    const barIn = props.bar ?? {};
    const bar = {
        placement: pickEnum(barIn.placement, ["bottom", "top", "center"], "bottom", "bar.placement", warnings),
        widthFrac: clampNum(barIn.widthFrac, 0.94, 0.1, 1),
        heightFrac: clampNum(barIn.heightFrac, 0.11, 0.02, 0.5),
        marginFrac: clampNum(barIn.marginFrac, 0.05, 0, 0.45),
        rounding: clampNum(barIn.rounding, 0.5, 0, 0.5),
        trackColor: resolveColor(barIn.trackColor, "#ECECEC"),
        fillColor: resolveColor(barIn.fillColor, "#8B5CF6"),
        trackImage: strOrUndef(barIn.trackImage),
        fillImage: strOrUndef(barIn.fillImage),
        tipFlash: barIn.tipFlash !== false,
        flashColor: resolveColor(barIn.flashColor, "#FFFFFF@0.4"),
    };
    const labelIn = props.label ?? {};
    const label = {
        placement: pickEnum(labelIn.placement, ["left", "right", "above", "none"], "left", "label.placement", warnings),
        widthFrac: clampNum(labelIn.widthFrac, 0.16, 0.04, 0.6),
        fontScale: clampNum(labelIn.fontScale, 1, 0.2, 3),
        color: resolveColor(labelIn.color, "#FFFFFF"),
        outlineColor: resolveColor(labelIn.outlineColor, "black@0.85"),
        outlineFrac: clampNum(labelIn.outlineFrac, 0.07, 0, 0.3),
        bold: labelIn.bold !== false,
    };
    // ── Placement hatches ──
    const m0Out = (0, layout_1.validateLayoutM0)(props.layoutM0, W, H);
    if (m0Out.kind === "error")
        return err(m0Out.code, m0Out.message);
    const layoutRect = m0Out.kind === "rect" ? m0Out.rect : undefined;
    const geomOut = (0, layout_1.validateGeometryOverride)(props.geometry);
    if (!geomOut.ok)
        return geomOut;
    warnings.push(...geomOut.warnings);
    return {
        ok: true,
        warnings,
        cfg: {
            durationSec,
            anchors: schedule.anchors,
            tipTimes: schedule.tipTimes,
            finalAmount: schedule.finalAmount,
            scheduleMode: schedule.mode,
            goalAmount,
            startAmount,
            prefix,
            suffixText,
            riseSec,
            riseEase,
            reduceMotion,
            background: resolveBackground(props.backgroundColor),
            sourceId: strOrUndef(props.sourceId),
            bar,
            label,
            layoutRect,
            geometryOverride: geomOut.value,
        },
    };
}
/** Integer display when whole; otherwise trimmed to at most 2 decimals. */
function formatAmount(v) {
    const rounded = Math.round(v * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}
// ── Small helpers ─────────────────────────────────────────────────────────
function err(code, message) {
    return { ok: false, code, message };
}
function clampNum(v, def, lo, hi) {
    const n = typeof v === "number" && Number.isFinite(v) ? v : def;
    return Math.max(lo, Math.min(hi, n));
}
function clampWarn(v, lo, hi, label, warnings) {
    if (v < lo || v > hi) {
        warnings.push(`${label} ${v} is outside [${lo}, ${hi}] — clamped.`);
    }
    return Math.max(lo, Math.min(hi, v));
}
function pickEnum(v, values, def, label, warnings) {
    if (v === undefined)
        return def;
    if (values.includes(v))
        return v;
    warnings.push(`${label} ${JSON.stringify(v)} unknown — using "${def}".`);
    return def;
}
/** A cleared color picker yields "" (not nullish) — resolve to the fallback. */
function resolveColor(v, fallback) {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? fallback : s;
}
function strOrUndef(v) {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? undefined : s;
}
/** Transparent when the color's alpha suffix is 0 (e.g. "black@0"). */
function resolveBackground(v) {
    const color = resolveColor(v, "#101014");
    if (color.toLowerCase() === "transparent")
        return { color, transparent: true };
    const alphaMatch = /@(\d*\.?\d+)\s*$/.exec(color);
    if (alphaMatch && Number(alphaMatch[1]) === 0)
        return { color, transparent: true };
    return { color, transparent: false };
}
