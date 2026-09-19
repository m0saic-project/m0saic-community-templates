"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLASH_SEC = exports.MIN_STEP_SEC = exports.MAX_ANCHORS = exports.MAX_TIPS = void 0;
exports.round3 = round3;
exports.fmt3 = fmt3;
exports.sanitizeRiseEase = sanitizeRiseEase;
exports.resolveSchedule = resolveSchedule;
exports.anchorsFromTips = anchorsFromTips;
exports.generateAutoTips = generateAutoTips;
exports.splitTotal = splitTotal;
exports.buildFillXExpr = buildFillXExpr;
exports.buildCounterTextExpr = buildCounterTextExpr;
exports.escapeDrawtextLiteral = escapeDrawtextLiteral;
exports.buildTipFlashGate = buildTipFlashGate;
exports.evalAnchors = evalAnchors;
const template_utils_1 = require("@m0saic/template-utils");
/** Tip ceiling — each tip is two anchors + one flash gate term. */
exports.MAX_TIPS = 180;
/** Anchor ceiling (schedule mode) — keyframeExpr terms stay parser-safe. */
exports.MAX_ANCHORS = 400;
/** Minimum spacing nudge between generated anchor times, seconds. */
exports.MIN_STEP_SEC = 0.02;
/** Tip-flash gate length, seconds. */
exports.FLASH_SEC = 0.25;
const RISE_EASES = ["linear", "easeOut", "smoothstep", "easeInOut"];
const CURVES = ["steady", "big-finish", "fast-start"];
function round3(x) {
    return Math.round(x * 1000) / 1000;
}
function fmt3(x) {
    return x.toFixed(3);
}
function sanitizeRiseEase(v, def = "easeOut") {
    return typeof v === "string" && RISE_EASES.includes(v)
        ? v
        : def;
}
/**
 * Resolve the amount timeline. Precedence: schedule > tips > auto. A present
 * but EMPTY schedule/tips array falls through (an empty rows table is "unset",
 * not "flat-line the bar").
 */
function resolveSchedule(input, durationSec) {
    const warnings = [];
    const { startAmount, goalAmount, riseSec, riseEase } = input;
    if (input.schedule !== undefined && input.schedule !== null) {
        if (!Array.isArray(input.schedule)) {
            return err("TG_SCHEDULE_PARSE", "Schedule must be an array like [{ atSec, amount, ease? }].");
        }
        if (input.schedule.length > 0) {
            return anchorsFromSchedule(input.schedule, warnings);
        }
    }
    if (input.tips !== undefined && input.tips !== null) {
        if (!Array.isArray(input.tips)) {
            return err("TG_TIPS_PARSE", "Tips must be an array like [{ atSec, amount }].");
        }
        if (input.tips.length > 0) {
            const tips = sanitizeTips(input.tips, warnings);
            if (tips.length === 0) {
                return err("TG_TIPS_PARSE", "Every Tips row was invalid — each needs a finite atSec and a nonzero finite amount.");
            }
            return anchorsFromTips(tips, startAmount, riseSec, riseEase, durationSec, "tips", warnings);
        }
    }
    const auto = generateAutoTips(input.auto ?? {}, startAmount, goalAmount, durationSec, warnings);
    return anchorsFromTips(auto, startAmount, riseSec, riseEase, durationSec, "auto", warnings);
}
function sanitizeTips(rows, warnings) {
    const tips = [];
    let dropped = 0;
    for (const row of rows) {
        const r = row;
        const atSec = typeof r?.atSec === "number" && Number.isFinite(r.atSec) ? r.atSec : null;
        const amount = typeof r?.amount === "number" && Number.isFinite(r.amount) && r.amount !== 0
            ? r.amount
            : null;
        if (atSec === null || amount === null) {
            dropped += 1;
            continue;
        }
        tips.push({ atSec: Math.max(0, atSec), amount });
    }
    if (dropped > 0) {
        warnings.push(`${dropped} Tips row(s) were invalid and skipped.`);
    }
    return tips;
}
/**
 * Tips (deltas) → anchors: hold at the running total until each tip, then
 * ease to the new total over `riseSec` (auto-shortened when the next tip
 * crowds in; 0 = an instant step). Totals clamp at 0 so refunds can't dip
 * the board negative.
 */
function anchorsFromTips(tips, startAmount, riseSec, riseEase, durationSec, mode, warnings) {
    if (tips.length > exports.MAX_TIPS) {
        return err("TG_TOO_DENSE", `${tips.length} tips exceed the ${exports.MAX_TIPS}-tip budget — thin the list or use the Schedule prop with fewer keys.`);
    }
    const sorted = [...tips].sort((a, b) => a.atSec - b.atSec);
    const late = sorted.filter((tp) => tp.atSec > durationSec).length;
    if (late > 0) {
        warnings.push(`${late} tip(s) land after the clip ends (${fmt3(durationSec)}s) and won't be seen.`);
    }
    const anchors = [{ t: 0, v: Math.max(0, startAmount) }];
    const tipTimes = [];
    let running = Math.max(0, startAmount);
    let lastEnd = 0;
    for (let i = 0; i < sorted.length; i++) {
        const tStart = round3(Math.max(sorted[i].atSec, lastEnd + exports.MIN_STEP_SEC));
        const nextAt = i + 1 < sorted.length ? sorted[i + 1].atSec : Infinity;
        const maxRise = Math.max(0.001, nextAt - tStart - exports.MIN_STEP_SEC);
        const rise = round3(Math.max(0.001, Math.min(riseSec, maxRise)));
        anchors.push({ t: tStart, v: running, ease: riseEase });
        running = Math.max(0, round3(running + sorted[i].amount));
        anchors.push({ t: round3(tStart + rise), v: running });
        tipTimes.push(tStart);
        lastEnd = tStart + rise;
    }
    return { ok: true, anchors, tipTimes, finalAmount: running, mode, warnings };
}
/** Agent absolute keys → anchors (sorted; invalid rows dropped with a warning). */
function anchorsFromSchedule(rows, warnings) {
    if (rows.length > exports.MAX_ANCHORS) {
        return err("TG_TOO_DENSE", `${rows.length} schedule keys exceed the ${exports.MAX_ANCHORS}-key budget.`);
    }
    const keys = [];
    let dropped = 0;
    for (const row of rows) {
        const r = row;
        const atSec = typeof r?.atSec === "number" && Number.isFinite(r.atSec) ? r.atSec : null;
        const amount = typeof r?.amount === "number" && Number.isFinite(r.amount) ? r.amount : null;
        if (atSec === null || amount === null) {
            dropped += 1;
            continue;
        }
        const ease = r?.ease === undefined ? "linear" : sanitizeRiseEase(r.ease, "linear");
        keys.push({ t: round3(Math.max(0, atSec)), v: Math.max(0, amount), ease });
    }
    if (dropped > 0) {
        warnings.push(`${dropped} schedule key(s) were invalid and skipped.`);
    }
    if (keys.length === 0) {
        return err("TG_SCHEDULE_PARSE", "Every schedule key was invalid — each needs finite atSec and amount.");
    }
    keys.sort((a, b) => a.t - b.t);
    // Flash cue: every key where the total steps UP from the previous key.
    const tipTimes = [];
    for (let i = 1; i < keys.length; i++) {
        if (keys[i].v > keys[i - 1].v)
            tipTimes.push(keys[i - 1].t);
    }
    return {
        ok: true,
        anchors: keys,
        tipTimes,
        finalAmount: keys[keys.length - 1].v,
        mode: "schedule",
        warnings,
    };
}
/**
 * The seeded tip fabricator: `tipCount` tips inside
 * [startDelaySec, finishFrac*duration], summing exactly to
 * `goalAmount - startAmount`. Times come from normalized random gaps bent by
 * the curve exponent (big-finish densifies late, fast-start early); amounts
 * from squared-random weights (mostly small, the odd whale) with the curve
 * biasing bigger tips toward its dense end. Integer amounts (each >= 1)
 * whenever the total allows — donation realism.
 */
function generateAutoTips(auto, startAmount, goalAmount, durationSec, warnings) {
    const seed = Math.max(0, Math.round(numOr(auto.seed, 1)));
    const requested = Math.round(numOr(auto.tipCount, 12));
    const tipCount = Math.max(1, Math.min(exports.MAX_TIPS, requested));
    if (requested !== tipCount && Number.isFinite(requested)) {
        warnings.push(`Auto tip count ${requested} clamped to ${tipCount}.`);
    }
    const curve = typeof auto.curve === "string" && CURVES.includes(auto.curve)
        ? auto.curve
        : "big-finish";
    const startDelay = Math.max(0, Math.min(numOr(auto.startDelaySec, 1.5), Math.max(0, durationSec - 1)));
    const finishFrac = Math.max(0.1, Math.min(1, numOr(auto.finishFrac, 0.9)));
    const windowEnd = Math.max(startDelay + 0.5, finishFrac * durationSec);
    const total = goalAmount - Math.max(0, startAmount);
    if (!(total > 0)) {
        warnings.push(`Start amount (${startAmount}) already meets the goal (${goalAmount}) — the bar holds flat.`);
        return [];
    }
    let n = tipCount;
    if (total < n)
        n = Math.max(1, Math.floor(total));
    const rng = (0, template_utils_1.mulberry32)(seed);
    // Times: cumulative random gaps, normalized, bent by the curve exponent.
    const gaps = Array.from({ length: n }, () => 0.35 + rng());
    const cum = [];
    let acc = 0;
    for (const g of gaps) {
        acc += g;
        cum.push(acc);
    }
    const exp = curve === "big-finish" ? 0.72 : curve === "fast-start" ? 1.6 : 1;
    const span = windowEnd - startDelay;
    const times = cum.map((c) => round3(startDelay + Math.pow(c / acc, exp) * span));
    // Amounts: skew-small weights, curve-biased, summed exactly to `total`.
    const weights = times.map((t) => {
        const u = span > 0 ? (t - startDelay) / span : 0;
        let w = 0.3 + rng() * rng() * 2.2;
        if (curve === "big-finish")
            w *= 0.55 + u;
        else if (curve === "fast-start")
            w *= 1.55 - u;
        return w;
    });
    const amounts = splitTotal(total, weights);
    return times.map((atSec, i) => ({ atSec, amount: amounts[i] }));
}
/**
 * Split `total` across `weights.length` tips. Integer totals >= n get an
 * integer largest-remainder split with a floor of 1 per tip; otherwise
 * proportional amounts rounded to cents with the residue folded into the
 * last tip.
 */
function splitTotal(total, weights) {
    const n = weights.length;
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;
    const ideal = weights.map((w) => (total * w) / sumW);
    if (Number.isInteger(total) && total >= n) {
        const base = ideal.map((v) => Math.max(1, Math.floor(v)));
        let used = base.reduce((a, b) => a + b, 0);
        // The floor-of-1 can overshoot; shave the largest entries back down to 1+.
        const order = ideal
            .map((v, i) => ({ frac: v - Math.floor(v), i }))
            .sort((a, b) => b.frac - a.frac);
        let guard = 0;
        while (used > total && guard < 10000) {
            const big = base.indexOf(Math.max(...base));
            if (base[big] <= 1)
                break;
            base[big] -= 1;
            used -= 1;
            guard += 1;
        }
        for (let k = 0; used < total; k = (k + 1) % n) {
            base[order[k % order.length].i] += 1;
            used += 1;
        }
        return base;
    }
    const cents = ideal.map((v) => Math.round(v * 100) / 100);
    const sum = cents.reduce((a, b) => a + b, 0);
    cents[n - 1] = Math.max(0, Math.round((cents[n - 1] + total - sum) * 100) / 100);
    return cents;
}
// ── Expression builders ───────────────────────────────────────────────────
/**
 * The fill slide: `-(w*(1-frac(t)))` where frac is the amount timeline over
 * the goal, clamped to [0,1] per anchor (overshoot pins the bar full; the
 * counter keeps counting).
 */
function buildFillXExpr(anchors, goalAmount) {
    const keys = anchors.map((a) => ({
        t: a.t,
        v: Math.min(1, Math.max(0, a.v / goalAmount)),
        ...(a.ease !== undefined ? { ease: a.ease } : {}),
    }));
    const raw = (0, template_utils_1.keyframeExpr)(keys, { ease: "linear", precision: 5 });
    return `-(w*(1-(${(0, template_utils_1.rebalanceAdditiveChains)(raw)})))`;
}
/**
 * The counter: literal prefix/suffix around a drawtext `%{eif\:…\:d}` whose
 * expression is the full amount timeline (commas escaped for drawtext
 * expansion; `+0.5` rounds — eif:d truncates).
 */
function buildCounterTextExpr(anchors, prefix, suffix) {
    const raw = (0, template_utils_1.keyframeExpr)(anchors.map((a) => ({ t: a.t, v: a.v, ...(a.ease !== undefined ? { ease: a.ease } : {}) })), { ease: "linear", precision: 4 });
    const escaped = (0, template_utils_1.rebalanceAdditiveChains)(raw).replace(/,/g, "\\,");
    return `${escapeDrawtextLiteral(prefix)}%{eif\\:(${escaped})+0.5\\:d}${escapeDrawtextLiteral(suffix)}`;
}
/** In drawtext expansion=normal, `%`, `{`, `}` are control chars. */
function escapeDrawtextLiteral(s) {
    return s.replace(/%/g, "\\%").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}
/** Explicit union gate over the tip times (the beat-hero gate shape). */
function buildTipFlashGate(tipTimes, durSec = exports.FLASH_SEC) {
    if (tipTimes.length === 0)
        return undefined;
    const terms = tipTimes.map((b) => `between(t,${fmt3(round3(b))},${fmt3(round3(b + durSec))})`);
    return {
        enable: (0, template_utils_1.rebalanceAdditiveChains)(terms.join("+")),
        window: {
            startSec: round3(Math.min(...tipTimes)),
            endSec: round3(Math.max(...tipTimes) + durSec),
        },
    };
}
// ── Reference model (tests) ───────────────────────────────────────────────
/**
 * Evaluate the anchor timeline at `t` with keyframeExpr semantics: hold
 * before the first key, ease between adjacent keys (the ease on the key
 * being LEFT; default linear), hold after the last.
 */
function evalAnchors(anchors, t) {
    if (anchors.length === 0)
        return 0;
    if (t < anchors[0].t)
        return anchors[0].v;
    for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i];
        const b = anchors[i + 1];
        if (t >= a.t && t < b.t) {
            const dur = Math.max(1e-4, b.t - a.t);
            const u = Math.min(1, Math.max(0, (t - a.t) / dur));
            return a.v + (b.v - a.v) * applyEase(a.ease ?? "linear", u);
        }
    }
    return anchors[anchors.length - 1].v;
}
function applyEase(ease, u) {
    switch (ease) {
        case "smoothstep":
        case "easeInOut":
            return u * u * (3 - 2 * u);
        case "easeOut":
            return 1 - (1 - u) * (1 - u);
        case "linear":
        default:
            return u;
    }
}
function numOr(v, def) {
    return typeof v === "number" && Number.isFinite(v) ? v : def;
}
function err(code, message) {
    return { ok: false, code, message };
}
