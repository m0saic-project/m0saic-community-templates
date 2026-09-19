"use strict";
/**
 * Layout — placement presets → integer pixel rects for the widget band and
 * its label/bar split, plus the strictly-validated m0 escape hatch and the
 * per-field pixel overrides (the beat-hero layout discipline: minimums clamp
 * on tiny canvases; below hard floors the caller maps to a
 * TG_CANVAS_TOO_SMALL error mosaic; an explicitly authored layout that can't
 * be honored errors rather than silently rendering elsewhere).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.computeTipGoalGeometry = computeTipGoalGeometry;
exports.validateLayoutM0 = validateLayoutM0;
exports.validateGeometryOverride = validateGeometryOverride;
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
/**
 * Geometry from the canvas + look (+ the layoutM0 whole-band replacement and
 * per-field pixel overrides). `sampleText` is the widest string the counter
 * will show — the font auto-fit sizes against it.
 */
function computeTipGoalGeometry(W, H, look, sampleText, rectOverride, override) {
    const warnings = [];
    // ── Widget band ──
    let widget;
    if (rectOverride) {
        widget = clampRect(rectOverride, W, H);
    }
    else {
        const wW = clamp(Math.round(look.widthFrac * W), 64, W);
        const wH = clamp(Math.round(look.heightFrac * H), 24, H);
        const margin = Math.round(look.marginFrac * H);
        const x = Math.round((W - wW) / 2);
        const y = look.placement === "top"
            ? margin
            : look.placement === "center"
                ? Math.round((H - wH) / 2)
                : H - wH - margin;
        widget = clampRect({ x, y, w: wW, h: wH }, W, H);
    }
    // ── Label / bar split inside the band ──
    let labelRect;
    let barRect;
    if (look.labelPlacement === "none") {
        barRect = widget;
    }
    else if (look.labelPlacement === "above") {
        const labelH = clamp(Math.round(widget.h * 0.5), 18, Math.max(18, widget.h - 16));
        const gap = Math.round(widget.h * 0.06);
        labelRect = { x: widget.x, y: widget.y, w: widget.w, h: labelH };
        barRect = {
            x: widget.x,
            y: widget.y + labelH + gap,
            w: widget.w,
            h: Math.max(1, widget.h - labelH - gap),
        };
    }
    else {
        const labelW = clamp(Math.round(look.labelWidthFrac * widget.w), 40, Math.round(widget.w * 0.5));
        const gap = Math.round(widget.w * 0.015);
        const barW = Math.max(1, widget.w - labelW - gap);
        if (look.labelPlacement === "right") {
            barRect = { x: widget.x, y: widget.y, w: barW, h: widget.h };
            labelRect = { x: widget.x + barW + gap, y: widget.y, w: labelW, h: widget.h };
        }
        else {
            labelRect = { x: widget.x, y: widget.y, w: labelW, h: widget.h };
            barRect = { x: widget.x + labelW + gap, y: widget.y, w: barW, h: widget.h };
        }
    }
    // ── Per-field pixel overrides ──
    if (override?.barRect)
        barRect = clampRect(override.barRect, W, H);
    if (override?.labelRect)
        labelRect = clampRect(override.labelRect, W, H);
    // ── Floors ──
    if (barRect.w < 48 || barRect.h < 10) {
        return {
            ok: false,
            code: "TG_CANVAS_TOO_SMALL",
            message: `The bar (${barRect.w}x${barRect.h}px) is below the 48x10px floor — ` +
                `grow the canvas, the widget fractions, or the Geometry rects.`,
        };
    }
    if (labelRect && (labelRect.w < 24 || labelRect.h < 14)) {
        warnings.push(`The counter zone (${labelRect.w}x${labelRect.h}px) is below the 24x14px floor — counter hidden.`);
        labelRect = undefined;
    }
    // ── Counter font auto-fit ──
    let fontPx = 0;
    if (labelRect) {
        const units = Math.max(1, (0, template_utils_1.textEmUnits)(sampleText));
        const heightCap = look.labelPlacement === "above" ? labelRect.h * 0.78 : labelRect.h * 0.62;
        const widthCap = (labelRect.w * 0.94) / (units * 0.62);
        fontPx = Math.round(clamp(Math.min(heightCap, widthCap) * look.fontScale, 10, 480));
    }
    if (override?.fontSizePx !== undefined && Number.isFinite(override.fontSizePx)) {
        fontPx = Math.round(clamp(override.fontSizePx, 8, 600));
    }
    return { ok: true, geom: { barRect, labelRect, fontPx }, warnings };
}
function clampRect(r, W, H) {
    const w = clamp(Math.round(r.w), 1, W);
    const h = clamp(Math.round(r.h), 1, H);
    const x = clamp(Math.round(r.x), 0, W - w);
    const y = clamp(Math.round(r.y), 0, H - h);
    return { x, y, w, h };
}
/**
 * Validate the `layoutM0` escape hatch: normalize (strip `#` comments and
 * blank lines; empty → unset), parse at the ctx canvas, require exactly ONE
 * rendered rect shaped like a widget band (wide: w >= 2h, h >= 20). Every
 * failure is a hard error.
 */
function validateLayoutM0(raw, W, H) {
    const normalized = String(raw ?? "")
        .split(/\r?\n/)
        .map((line) => line.replace(/#.*$/, "").trim())
        .filter((line) => line.length > 0)
        .join("");
    if (normalized === "")
        return { kind: "unset" };
    let frames;
    try {
        const result = (0, dsl_1.parseM0StringComplete)(normalized, W, H);
        frames = result.ok
            ? result.ir.renderFrames
            : (0, dsl_1.parseM0StringToRenderFrames)(normalized, W, H);
    }
    catch (err) {
        return {
            kind: "error",
            code: "TG_M0_PARSE",
            message: `Layout (m0) is not a valid m0 string: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    if (!frames || frames.length === 0) {
        return {
            kind: "error",
            code: "TG_M0_PARSE",
            message: "Layout (m0) parsed to no rendered rect.",
        };
    }
    if (frames.length !== 1) {
        return {
            kind: "error",
            code: "TG_M0_COUNT",
            message: `Layout (m0) must resolve to exactly ONE rect (got ${frames.length}) — ` +
                `carve the box with '-' null tiles.`,
        };
    }
    const f = frames[0];
    const rect = {
        x: Math.round(f.x),
        y: Math.round(f.y),
        w: Math.round(f.width),
        h: Math.round(f.height),
    };
    if (!(rect.w >= 2 * rect.h && rect.h >= 20)) {
        return {
            kind: "error",
            code: "TG_M0_SHAPE",
            message: `Layout (m0) rect is ${rect.w}x${rect.h} — the widget needs a wide band (w >= 2*h, h >= 20).`,
        };
    }
    return { kind: "rect", rect };
}
const RECT_KEYS = ["barRect", "labelRect"];
/** Parse the agent `geometry` prop. Unknown keys ignored (forward compat). */
function validateGeometryOverride(raw) {
    if (raw === undefined || raw === null)
        return { ok: true, value: {}, warnings: [] };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return {
            ok: false,
            code: "TG_GEOMETRY_PARSE",
            message: "Geometry (px) must be an object like { barRect: {x,y,w,h}, ... }.",
        };
    }
    const obj = raw;
    const value = {};
    const warnings = [];
    for (const key of RECT_KEYS) {
        const r = obj[key];
        if (r === undefined)
            continue;
        if (typeof r !== "object" ||
            r === null ||
            !isFiniteNum(r.x) ||
            !isFiniteNum(r.y) ||
            !isFiniteNum(r.w) ||
            !isFiniteNum(r.h)) {
            return {
                ok: false,
                code: "TG_GEOMETRY",
                message: `geometry.${key} must be {x,y,w,h} with finite numbers.`,
            };
        }
        const rect = r;
        if (rect.w <= 0 || rect.h <= 0) {
            return {
                ok: false,
                code: "TG_GEOMETRY",
                message: `geometry.${key} must have positive w/h (got ${rect.w}x${rect.h}).`,
            };
        }
        value[key] = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    }
    const fs = obj.fontSizePx;
    if (fs !== undefined) {
        if (isFiniteNum(fs))
            value.fontSizePx = fs;
        else
            warnings.push("geometry.fontSizePx is not a finite number — ignored.");
    }
    return { ok: true, value, warnings };
}
function isFiniteNum(v) {
    return typeof v === "number" && Number.isFinite(v);
}
