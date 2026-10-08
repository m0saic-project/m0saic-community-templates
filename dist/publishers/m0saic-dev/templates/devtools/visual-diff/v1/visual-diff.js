"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualDiffV1 = exports.DIFF_REMOVED = exports.DIFF_THEME_COLORS = exports.DIFF_THEMES = exports.DIFF_PLATFORM_KEYS = exports.DIFF_PLATFORMS = exports.DIFF_MAX_LABELS_PER_SIDE = exports.DIFF_MAX_STOPS = exports.DIFF_MAX_SEC = exports.DIFF_MIN_SEC = void 0;
exports.diffBeats = diffBeats;
exports.captionOf = captionOf;
exports.toPage = toPage;
exports.layoutVisualDiff = layoutVisualDiff;
exports.visualDiffContract = visualDiffContract;
exports.resolveDiffs = resolveDiffs;
exports.diffStops = diffStops;
exports.plannedDiffDurationMs = plannedDiffDurationMs;
const types_1 = require("@m0saic/types");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
const template_utils_1 = require("@m0saic/template-utils");
const layout_1 = require("./layout");
const text_1 = require("./text");
const walkthrough_1 = require("./walkthrough");
const capture_1 = require("./capture");
const sample_captures_1 = require("./sample-captures");
const ID = "@m0saic-dev/devtools/visual-diff/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;
exports.DIFF_MIN_SEC = 6;
exports.DIFF_MAX_SEC = 30;
exports.DIFF_MAX_STOPS = 6;
exports.DIFF_MAX_LABELS_PER_SIDE = 48;
exports.DIFF_PLATFORMS = {
    /** 16:9 at full size - a PR comment's player, a review call. */
    pr: { width: 1920, height: 1080 },
    /** 16:9 at 720p - a lighter file for a chat message. */
    chat: { width: 1280, height: 720 },
    /** 1:1 - the two windows stack. */
    square: { width: 1080, height: 1080 },
    /** 9:16 - a phone; the two windows stack. */
    mobile: { width: 1080, height: 1920 },
};
exports.DIFF_PLATFORM_KEYS = Object.keys(exports.DIFF_PLATFORMS);
exports.DIFF_THEMES = ["light", "dark"];
exports.DIFF_THEME_COLORS = {
    light: { background: "#f6f7f9", ink: "#161a22" },
    dark: { background: "#0f1218", ink: "#eef1f6" },
};
/** Removals are red on every theme; the sign and the word carry it too. */
exports.DIFF_REMOVED = "#e5484d";
const NOTE_HINT = "The reviewer's note for this change: shown on its card while the camera is on it.";
/** Generic on purpose: this repo is public, so the defaults name no real company, product or person. */
const DEFAULTS = {
    platform: "pr",
    brandName: "Northwind Engineering",
    title: "PR #4821 - Tighten the plan card",
    baseLabel: "main",
    headLabel: "this PR",
    statusLabel: "65 of 67 E2E tests passed - 1 page changed",
    tolerancePx: 2,
    maxStops: 4,
    notes: [
        "Intended: the upgrade button meets the 40 px touch target.",
        "Intended, same change.",
        "New alerts row. Design signed off in #design-review.",
        "Not intended - the member avatar picked up the button size. Fix before merge.",
    ],
    showLabels: true,
    theme: "light",
    accent: "#6d5ae6",
    durationSec: 10,
};
const propsSchema = (0, template_utils_1.definePropsSchema)({
    platform: { type: "string", required: false, meta: { constraints: { oneOf: [...exports.DIFF_PLATFORM_KEYS] } } },
    brandName: { type: "string", required: false },
    brandLogo: { type: "media[]", required: false, meta: { control: { multiple: false, picker: "file", accept: ["image", "video"] } } },
    title: { type: "string", required: false },
    baseLabel: { type: "string", required: false },
    headLabel: { type: "string", required: false },
    before: { type: "json", required: false },
    after: { type: "json", required: false },
    statusLabel: { type: "string", required: false },
    tolerancePx: { type: "number", required: false, meta: { constraints: { min: 0, max: 32 } } },
    maxStops: { type: "number", required: false, meta: { constraints: { min: 1, max: exports.DIFF_MAX_STOPS } } },
    notes: { type: "string[]", required: false, meta: { constraints: { maxItems: exports.DIFF_MAX_STOPS } } },
    showLabels: { type: "boolean", required: false },
    theme: { type: "string", required: false, meta: { constraints: { oneOf: [...exports.DIFF_THEMES] } } },
    accent: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.accent } } },
    background: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
    ink: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
    durationSec: { type: "number", required: false, meta: { constraints: { min: exports.DIFF_MIN_SEC, max: exports.DIFF_MAX_SEC } } },
    debugLayout: { type: "boolean", required: false },
});
/** The board is static; the marks land from 12%, one per stagger; the walk starts after the last. */
function diffBeats(totalSec, markCount) {
    const D = round3(totalSec);
    const rise = round3(Math.min(0.4, 0.05 * D));
    const stagger = round3(Math.min(0.3, 0.04 * D));
    const cut1 = round3(0.12 * D);
    const cut2 = round3(Math.min(0.6 * D, cut1 + (markCount + 1) * stagger + rise + 0.4));
    return { total: D, cuts: [cut1, cut2], rise, stagger };
}
/** "4 visual differences - 31 elements shifted" */
function captionOf(diffs) {
    const primary = diffs.filter((d) => d.primary).length;
    const shifted = diffs.length - primary;
    const a = primary === 0 ? "No visual differences" : `${primary} visual difference${primary === 1 ? "" : "s"}`;
    return shifted > 0 ? `${a} - ${shifted} element${shifted === 1 ? "" : "s"} shifted` : a;
}
/** Map a capture rect into a window's page area. */
function toPage(win, r) {
    return {
        x: Math.round(win.origin.x + r.x * win.scale),
        y: Math.round(win.origin.y + r.y * win.scale),
        w: Math.max(1, Math.round(r.w * win.scale)),
        h: Math.max(1, Math.round(r.h * win.scale)),
    };
}
function layoutVisualDiff(copy, W, H) {
    const S = Math.min(W, H);
    const stacked = W / H < 1.2;
    const margin = Math.round(0.045 * S);
    const gap = Math.round(0.018 * S);
    const x0 = margin;
    const cw = W - 2 * margin;
    const clamp = (r) => {
        const x = Math.max(0, Math.min(W - 1, Math.round(r.x)));
        const y = Math.max(0, Math.min(H - 1, Math.round(r.y)));
        return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w))), h: Math.max(1, Math.min(H - y, Math.round(r.h))) };
    };
    const at = (fit, rect) => ({ fit, rect });
    // ── chrome row ──
    const rowH = Math.max(10, Math.round(0.034 * S));
    const wmFit = (0, text_1.fitText)(copy.brandName.toUpperCase(), (0, text_1.budget)(Math.round(cw * 0.5)), rowH, Math.round(0.024 * S), 8, 1, "bold");
    const logo = copy.hasLogo ? clamp({ x: x0, y: Math.round(0.03 * S), w: Math.round(Math.min(cw * 0.45, 0.36 * W)), h: Math.round(0.07 * S) }) : null;
    const wmY = logo ? logo.y + Math.round((logo.h - wmFit.h) / 2) : Math.round(0.038 * S);
    const wordmark = at(wmFit, clamp({ x: x0, y: wmY, w: Math.round(cw * 0.5), h: wmFit.h }));
    const kickerFit = (0, text_1.fitText)("VISUAL DIFF", (0, text_1.budget)(Math.round(cw * 0.4)), rowH, Math.round(0.022 * S), 8, 1, "regular");
    const kicker = at(kickerFit, clamp({ x: x0 + cw - Math.round(cw * 0.4), y: wmY + Math.round((wmFit.h - kickerFit.h) / 2), w: Math.round(cw * 0.4), h: kickerFit.h }));
    const chromeBottom = logo ? logo.y + logo.h : wordmark.rect.y + wordmark.rect.h;
    // ── title, status, caption ──
    let y = chromeBottom + Math.round(0.028 * S);
    const titleFit = (0, text_1.fitText)(copy.title, (0, text_1.budget)(cw), 0.09 * H, Math.round(0.044 * S), 10, 1, "bold");
    const title = at(titleFit, clamp({ x: x0, y, w: cw, h: titleFit.h }));
    y += titleFit.h + Math.round(gap * 0.5);
    const subPx = Math.round(0.022 * S);
    const captionFit = (0, text_1.fitText)(copy.captionText, (0, text_1.budget)(Math.round(cw * 0.55)), subPx * 1.6, subPx, 8, 1, "bold");
    const statusFit = copy.statusLabel ? (0, text_1.fitText)(copy.statusLabel, (0, text_1.budget)(Math.round(cw * 0.42)), subPx * 1.6, subPx, 8, 1, "regular") : null;
    const caption = at(captionFit, clamp({ x: x0, y, w: Math.round(cw * 0.55), h: captionFit.h }));
    const status = statusFit ? at(statusFit, clamp({ x: x0 + cw - Math.round(cw * 0.42), y, w: Math.round(cw * 0.42), h: statusFit.h })) : null;
    y += Math.max(captionFit.h, statusFit?.h ?? 0) + Math.round(0.03 * S);
    // ── the two windows ──
    const barH = Math.max(3, Math.round(0.006 * S));
    const bar = { x: 0, y: H - barH, w: W, h: barH };
    const bottom = H - barH - Math.round(0.04 * S);
    const chromeH = Math.round(0.03 * S);
    const window = (frame, labelText, capture) => {
        const labelFit = (0, text_1.fitText)(labelText, (0, text_1.budget)(Math.round(frame.w * 0.6)), chromeH, Math.round(0.016 * S), 7, 1, "regular");
        const dotD = Math.max(4, Math.round(chromeH * 0.34));
        const dots = [0, 1, 2].map((i) => clamp({ x: frame.x + Math.round(chromeH * 0.4) + i * Math.round(dotD * 1.7), y: frame.y + Math.round((chromeH - dotD) / 2), w: dotD, h: dotD }));
        const label = at(labelFit, clamp({ x: dots[2].x + dots[2].w + Math.round(chromeH * 0.4), y: frame.y + Math.round((chromeH - labelFit.h) / 2), w: Math.round(frame.w * 0.6), h: labelFit.h }));
        const page = clamp({ x: frame.x, y: frame.y + chromeH, w: frame.w, h: frame.h - chromeH });
        const scale = Math.min(page.w / capture.viewport.w, page.h / capture.viewport.h);
        const origin = { x: page.x + (page.w - capture.viewport.w * scale) / 2, y: page.y };
        return { frame, bar: clamp({ x: frame.x, y: frame.y, w: frame.w, h: chromeH }), dots, label, page, scale, origin };
    };
    // The windows hug the captures: as wide as the band allows, as tall as the
    // page at that width (plus the chrome bar), and the pair sits centred in
    // the room left - no empty page below a short capture.
    const aspect = Math.max(copy.before.viewport.w / copy.before.viewport.h, copy.after.viewport.w / copy.after.viewport.h);
    let before;
    let after;
    if (stacked) {
        const avail = bottom - y - gap;
        let h = Math.floor(avail / 2);
        const w = Math.min(cw, Math.round((h - chromeH) * aspect));
        h = Math.min(h, Math.round(w / aspect) + chromeH);
        const top = y + Math.round((avail - (2 * h)) / 2);
        const x = x0 + Math.round((cw - w) / 2);
        before = window(clamp({ x, y: top, w, h }), copy.baseLabel, copy.before);
        after = window(clamp({ x, y: top + h + gap, w, h }), copy.headLabel, copy.after);
    }
    else {
        const w = Math.floor((cw - gap) / 2);
        const avail = bottom - y;
        const h = Math.min(avail, Math.round(w / aspect) + chromeH);
        const top = y + Math.round((avail - h) / 2);
        before = window(clamp({ x: x0, y: top, w, h }), copy.baseLabel, copy.before);
        after = window(clamp({ x: x0 + w + gap, y: top, w, h }), copy.headLabel, copy.after);
    }
    return { W, H, stacked, wordmark, logo, kicker, title, status, caption, before, after, bar };
}
/** What the geometry promises. The wireframe rects are data, not promises. */
function visualDiffContract(L) {
    const out = [];
    const fits = (label, fit) => {
        if (fit)
            out.push((0, layout_1.textFitsMeasured)(label, fit.lines.join("\n"), fit.px, fit.width));
    };
    if (!L.logo)
        fits("wordmark", L.wordmark.fit);
    fits("kicker", L.kicker.fit);
    fits("title", L.title.fit);
    fits("status", L.status?.fit);
    fits("caption", L.caption.fit);
    fits("window-before-label", L.before.label.fit);
    fits("window-after-label", L.after.label.fit);
    out.push({ label: L.logo ? "logo" : "wordmark", within: { yFrac: [0, 0.2] } });
    out.push({ label: "progress", minWidthFrac: 0.98, within: { yFrac: [0.9, 1] } });
    return out;
}
exports.VisualDiffV1 = (0, template_utils_1.defineMosaicTemplate)({
    id: (0, types_1.asTemplateId)(ID),
    capabilities: { tier: "core" },
    outputHints: {
        ...exports.DIFF_PLATFORMS[DEFAULTS.platform],
        fps: 30,
        durationMs: plannedDiffDurationMs({ durationSec: DEFAULTS.durationSec, before: sample_captures_1.SAMPLE_BEFORE, after: sample_captures_1.SAMPLE_AFTER, tolerancePx: DEFAULTS.tolerancePx, maxStops: DEFAULTS.maxStops }),
        format: { kind: "video", container: "mp4" },
        note: "The canvas follows the platform knob (pr 1920x1080 by default; square and mobile stack the two windows); an explicit -w/-h wins. The board holds for durationSec, then the camera visits each change; an explicit --durationMs squeezes or holds it.",
    },
    resolveOutputHints: (props) => {
        const key = typeof props?.platform === "string" ? props.platform.trim().toLowerCase() : "";
        const dims = exports.DIFF_PLATFORMS[(key in exports.DIFF_PLATFORMS ? key : DEFAULTS.platform)];
        return { ...dims, durationMs: plannedDiffDurationMs(props) };
    },
    propsSchema,
    defaultProps: {
        platform: DEFAULTS.platform,
        brandName: DEFAULTS.brandName,
        brandLogo: [],
        title: DEFAULTS.title,
        baseLabel: DEFAULTS.baseLabel,
        headLabel: DEFAULTS.headLabel,
        before: sample_captures_1.SAMPLE_BEFORE,
        after: sample_captures_1.SAMPLE_AFTER,
        statusLabel: DEFAULTS.statusLabel,
        tolerancePx: DEFAULTS.tolerancePx,
        maxStops: DEFAULTS.maxStops,
        notes: [...DEFAULTS.notes],
        showLabels: DEFAULTS.showLabels,
        theme: DEFAULTS.theme,
        accent: DEFAULTS.accent,
        durationSec: DEFAULTS.durationSec,
        debugLayout: false,
    },
    bindings: { unbound: { background: "canvas", ink: "theme", durationSec: "timing", tolerancePx: "geometry", maxStops: "timing", before: "a capture file, pasted in the panel", after: "a capture file, pasted in the panel" } },
    render,
});
exports.default = exports.VisualDiffV1;
/* ── input ── */
function numberOr(v, fallback, min, max) {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
function pickText(value, fallback, name) {
    if (value === undefined || value === null)
        return fallback;
    if (typeof value !== "string")
        throw new Error(`${ID}: ${name} must be a string.`);
    return (0, text_1.cleanCopy)(value);
}
function pickColor(value, fallback, name) {
    const s = typeof value === "string" ? value.trim() : "";
    if (s.length === 0)
        return fallback;
    if (!HEX.test(s))
        throw new Error(`${ID}: ${name} ${JSON.stringify(value)} must be #rrggbb.`);
    return s;
}
function pickInt(value, fallback, min, max, name) {
    if (value === undefined || value === null)
        return fallback;
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
        throw new Error(`${ID}: ${name} must be a whole number from ${min} to ${max}. Got ${JSON.stringify(value)}.`);
    }
    return n;
}
function pickChoice(value, choices, fallback, name) {
    if (value === undefined || value === null || value === "")
        return fallback;
    const s = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!choices.includes(s))
        throw new Error(`${ID}: ${name} must be one of ${choices.join(", ")}. Got ${JSON.stringify(value)}.`);
    return s;
}
function pickNotes(value) {
    if (value === undefined || value === null)
        return [...DEFAULTS.notes];
    if (!Array.isArray(value))
        throw new Error(`${ID}: notes must be an array of up to ${exports.DIFF_MAX_STOPS} lines.`);
    if (value.length > exports.DIFF_MAX_STOPS)
        throw new Error(`${ID}: notes carries at most ${exports.DIFF_MAX_STOPS} lines (got ${value.length}).`);
    return value.map((v, i) => {
        const s = pickText(v, "", `notes[${i}]`);
        if (s.length > walkthrough_1.MAX_NOTE)
            throw new Error(`${ID}: notes[${i}] is ${s.length} characters; keep a note to ${walkthrough_1.MAX_NOTE} so it fits two lines on the card.`);
        return s;
    });
}
function pickMedia(value, name) {
    if (value === undefined || value === null)
        return "";
    if (!Array.isArray(value))
        throw new Error(`${ID}: ${name} must be an array of zero or one path.`);
    const refs = value.map((v) => String(v).trim()).filter(Boolean);
    if (refs.length > 1)
        throw new Error(`${ID}: ${name} accepts zero or one file (got ${refs.length}).`);
    return refs[0] ?? "";
}
const ASSET_ID_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
function mediaKindOf(ctx, assetId, ref) {
    const known = ctx.media?.[assetId];
    if (known?.kind === "video" || known?.kind === "image")
        return known.kind;
    return VIDEO_EXT.test(ref) ? "video" : "image";
}
/** The differences the props describe, in reading order. Throws with the field named. */
function resolveDiffs(props) {
    const before = (0, capture_1.parseCapture)(props?.before ?? sample_captures_1.SAMPLE_BEFORE, "before");
    const after = (0, capture_1.parseCapture)(props?.after ?? sample_captures_1.SAMPLE_AFTER, "after");
    const tolerancePx = pickInt(props?.tolerancePx, DEFAULTS.tolerancePx, 0, 32, "tolerancePx");
    const maxStops = pickInt(props?.maxStops, DEFAULTS.maxStops, 1, exports.DIFF_MAX_STOPS, "maxStops");
    return { before, after, diffs: (0, capture_1.diffCaptures)(before, after, tolerancePx), tolerancePx, maxStops };
}
/** The stops: the primary changes, in reading order, up to maxStops. */
function diffStops(diffs, maxStops) {
    return diffs.filter((d) => d.primary).slice(0, maxStops);
}
function buildSecOf(T, markCount) {
    return round3(T.cuts[0] + (markCount + 1) * T.stagger + T.rise + 0.6);
}
/** The clip length the props ask for (ms). Never throws - junk falls back to the knob. */
function plannedDiffDurationMs(props) {
    const baseSec = numberOr(props?.durationSec, DEFAULTS.durationSec, exports.DIFF_MIN_SEC, exports.DIFF_MAX_SEC);
    try {
        const { diffs, maxStops } = resolveDiffs(props);
        const stops = diffStops(diffs, maxStops);
        if (stops.length === 0)
            return baseSec * 1000;
        const notes = pickNotes(props?.notes);
        const T = diffBeats(baseSec, diffs.filter((d) => d.primary).length);
        const entries = stops.map((d, i) => ({ index: i, note: notes[i] || d.summary }));
        return Math.ceil((0, walkthrough_1.planWalk)(buildSecOf(T, stops.length), entries).endSec * 10) * 100;
    }
    catch {
        return baseSec * 1000;
    }
}
/* ── colour ── */
function rgb(c) {
    const n = parseInt(String(c).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    const ch = (x, y) => Math.round(x * t + y * (1 - t));
    return `#${((1 << 24) + (ch(ar, br) << 16) + (ch(ag, bg) << 8) + ch(ab, bb)).toString(16).slice(1)}`;
}
function luminance(c) {
    const [r, g, b] = rgb(c);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function onColor(fill, a, b) {
    const l = luminance(fill);
    return Math.abs(luminance(a) - l) >= Math.abs(luminance(b) - l) ? a : b;
}
function round3(n) {
    return Math.round(n * 1000) / 1000;
}
/* ── sources ── */
function textSource(fit, color, label, overlay, hAlign = "left") {
    return (0, template_utils_1.tag)({
        type: "text",
        rasterizer: "svg",
        renderMode: { kind: "image" },
        layers: [{ content: { kind: "literal", text: fit.lines.join("\n") }, style: { fontSize: fit.px, fontColor: color, ...(fit.face === "bold" ? { fontWeight: "bold" } : {}) }, placement: { hAlign, vAlign: "middle" } }],
        ...(overlay ? { overlay } : {}),
        editor: { owner: "template" },
    }, label);
}
/** An outlined rectangle as ONE tile: the colour shows only through a stroked ring mask. */
function outlineTile(color, w, h, strokePx, overlay) {
    const i = strokePx / 2;
    return (0, template_utils_1.makeColorTile)(color, {
        mask: { kind: "inline-mask", localPath: "", bounds: { x: 0, y: 0, width: w, height: h }, strokes: [{ d: `M${i} ${i} H${w - i} V${h - i} H${i} Z`, width: strokePx }] },
        ...(overlay ? { overlay } : {}),
    });
}
/** An m0c file: this side's layout with every area's label keyed by stable key, the capture and the diff in `custom`. */
function m0cSidecar(side, capture, diffs, title) {
    const pieces = capture.rects.map((r) => ({
        rect: { x: r.x, y: r.y, w: r.w, h: r.h, importance: 1 + r.d },
        source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)("#000000"), r.label),
    }));
    const placed = (0, template_utils_1.placeInsetPieces)({ rootW: capture.viewport.w, rootH: capture.viewport.h, pieces });
    const doc = { kind: "mosaic_document", version: 1, m0: (0, dsl_stdlib_1.toM0String)(placed.m0, `${ID}:${side}`), assets: {}, sources: placed.sources };
    const { resolvedLabels } = (0, template_utils_1.checkLayout)(doc, { canvasW: capture.viewport.w, canvasH: capture.viewport.h, constraints: [] });
    const labels = {};
    for (const [key, text] of Object.entries(resolvedLabels))
        labels[key] = { text };
    const file = {
        format: "m0c",
        version: 1,
        created: "1970-01-01T00:00:00.000Z",
        app: "demo-lab",
        appVersion: null,
        meta: { title: `${title} - ${side}`, source: capture.source || null, note: `${side === "before" ? "The baseline" : "The change"}: every captured area as a cell, labelled. custom.diff holds what differs between the two sides.` },
        size: { width: capture.viewport.w, height: capture.viewport.h },
        m0: String(doc.m0),
        labels,
        derive: { background: null },
        masks: null,
        custom: {
            capture: { viewport: capture.viewport, rects: capture.rects.map(({ index: _i, ...r }) => r) },
            diff: diffs.map((d) => ({ kind: d.kind, primary: d.primary, label: d.label, path: d.path, before: d.before ? { x: d.before.x, y: d.before.y, w: d.before.w, h: d.before.h } : null, after: d.after ? { x: d.after.x, y: d.after.y, w: d.after.w, h: d.after.h } : null, dx: d.dx, dy: d.dy, dw: d.dw, dh: d.dh, summary: d.summary })),
        },
    };
    return { kind: "text", ext: "m0c", content: JSON.stringify(file, null, 2) + "\n" };
}
async function render(props, ctx) {
    const brandName = pickText(props.brandName, DEFAULTS.brandName, "brandName");
    if (!brandName)
        throw new Error(`${ID}: brandName is required.`);
    const title = pickText(props.title, DEFAULTS.title, "title");
    if (!title)
        throw new Error(`${ID}: title is required - the clip is about a change.`);
    const logoRef = pickMedia(props.brandLogo, "brandLogo");
    pickChoice(props.platform, exports.DIFF_PLATFORM_KEYS, DEFAULTS.platform, "platform");
    const { before, after, diffs, maxStops } = resolveDiffs(props);
    const notes = pickNotes(props.notes);
    const showLabels = props.showLabels !== false;
    const copy = {
        brandName,
        hasLogo: logoRef.length > 0,
        title,
        baseLabel: pickText(props.baseLabel, DEFAULTS.baseLabel, "baseLabel") || DEFAULTS.baseLabel,
        headLabel: pickText(props.headLabel, DEFAULTS.headLabel, "headLabel") || DEFAULTS.headLabel,
        statusLabel: pickText(props.statusLabel, DEFAULTS.statusLabel, "statusLabel"),
        captionText: captionOf(diffs),
        before,
        after,
    };
    const theme = exports.DIFF_THEME_COLORS[pickChoice(props.theme, exports.DIFF_THEMES, DEFAULTS.theme, "theme")];
    const accent = pickColor(props.accent, DEFAULTS.accent, "accent");
    const bg = pickColor(props.background, theme.background, "background");
    const ink = pickColor(props.ink, theme.ink, "ink");
    const dim = mix(ink, bg, 0.6);
    const light = luminance(bg) > 0.5;
    const page = light ? "#ffffff" : mix(ink, bg, 0.05);
    const chrome = mix(ink, bg, light ? 0.1 : 0.14);
    const wire = mix(ink, page, 0.3);
    const wireSoft = mix(ink, page, 0.1);
    const removed = exports.DIFF_REMOVED;
    const consequence = mix(accent, page, 0.35);
    const assets = {};
    const logoId = logoRef ? (0, types_1.asAssetId)(ASSET_ID_RE.test(logoRef) ? logoRef : "brand-logo") : undefined;
    const logoKind = logoId ? mediaKindOf(ctx, String(logoId), logoRef) : "image";
    if (logoId)
        assets[logoId] = { kind: "file", path: logoRef, mediaType: logoKind };
    // Timing: the board at the knob's pace; the walk appended; a pin squeezes through S.
    const baseSec = pickInt(props.durationSec, DEFAULTS.durationSec, exports.DIFF_MIN_SEC, exports.DIFF_MAX_SEC, "durationSec");
    const primaries = diffs.filter((d) => d.primary);
    const stops = diffStops(diffs, maxStops);
    const T = diffBeats(baseSec, primaries.length);
    const [cut1] = T.cuts;
    const plan = stops.length > 0 ? (0, walkthrough_1.planWalk)(buildSecOf(T, stops.length), stops.map((d, i) => ({ index: i, note: notes[i] || d.summary }))) : undefined;
    const plannedSec = plan ? plan.endSec : baseSec;
    const pinned = (0, template_utils_1.resolvePinnedDurationMs)(ctx);
    // Unpinned: the planned length to the tenth, exactly as the hint states it.
    const durationMs = pinned !== undefined ? Math.round(pinned) : Math.ceil(plannedSec * 10) * 100;
    const k = Math.min(1, durationMs / 1000 / plannedSec);
    const S = (sec) => round3(sec * k);
    const arrive = (startSec, step, kind = "fade") => (0, template_utils_1.entrance)({ kind, durationMs: S(T.rise) * 1000, atSec: S(startSec + step * T.stagger), ease: "easeOut" });
    const W = Math.max(1, Math.round(ctx.target.width));
    const H = Math.max(1, Math.round(ctx.target.height));
    /** The board at a canvas of its own: 1x for the plain clip, MAX_ZOOM x under the camera. */
    const buildBoard = (Wb, Hb, withBar) => {
        const L = layoutVisualDiff(copy, Wb, Hb);
        const Sb = Math.min(Wb, Hb);
        const pieces = [];
        const piece = (rect, importance, source) => pieces.push({ rect: { ...rect, importance }, source });
        // ── chrome ──
        if (L.logo && logoId) {
            piece(L.logo, 1, (0, template_utils_1.bindProp)((0, template_utils_1.tag)({ type: "media", mediaType: logoKind, assetId: logoId, placement: { fit: "contain", hAlign: "left", vAlign: "middle" }, ...(logoKind === "video" ? { loopMode: "loop", audio: { enabled: false } } : {}), editor: { owner: "template" } }, "logo"), "brandLogo", 0));
        }
        else {
            piece(L.wordmark.rect, 1, (0, template_utils_1.bindProps)(textSource(L.wordmark.fit, ink, "wordmark", undefined), [{ propKey: "brandName" }, { propKey: "brandLogo", index: 0 }]));
        }
        piece(L.kicker.rect, 1, textSource(L.kicker.fit, dim, "kicker", undefined, "right"));
        if (withBar)
            piece(L.bar, 1, (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { overlay: { xExpr: `-W*(1-min(1,t/${durationMs / 1000}))` } }), "progress"), "accent"));
        piece(L.title.rect, 2, (0, template_utils_1.bindProp)(textSource(L.title.fit, ink, "title", undefined), "title"));
        if (L.status)
            piece(L.status.rect, 2, (0, template_utils_1.bindProp)(textSource(L.status.fit, dim, "status", undefined, "right"), "statusLabel"));
        piece(L.caption.rect, 2, textSource(L.caption.fit, primaries.length ? accent : dim, "caption", arrive(cut1, 0, "rise")));
        // ── the two windows: chrome bar, page, every area outlined and labelled ──
        const sides = [
            { side: "before", win: L.before, capture: before, labelProp: "baseLabel" },
            { side: "after", win: L.after, capture: after, labelProp: "headLabel" },
        ];
        const labelPx = Math.max(7, Math.round(0.011 * Sb));
        for (const { side, win, capture, labelProp } of sides) {
            piece(win.frame, 1, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(chrome, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.06 } } }), `window-${side}`));
            win.dots.forEach((d, i) => piece(d, 2, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(["#ff5f57", "#febc2e", "#28c840"][i], { mask: { kind: "inline-mask", ...(0, dsl_stdlib_1.circleMask)(d.w, d.h) } }), `window-${side}-dot-${i}`)));
            piece(win.label.rect, 2, (0, template_utils_1.bindProp)(textSource(win.label.fit, dim, `window-${side}-label`, undefined), labelProp));
            // The page. The capture it draws is a file pasted in the panel (bindings.unbound), not a canvas handle.
            piece(win.page, 2, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(page), `page-${side}`));
            // Areas, static, deepest last so a child's outline sits on its parent's.
            const ordered = [...capture.rects].sort((a, b) => a.d - b.d);
            let labelsLeft = showLabels ? exports.DIFF_MAX_LABELS_PER_SIDE : 0;
            const labelled = new Set();
            if (labelsLeft) {
                // Name the biggest areas first - a label needs room, and the big ones are
                // the ones a person asks about. Two labels in one corner: the smaller
                // (more specific) area keeps its name, the container yields.
                const picked = [];
                for (const r of [...capture.rects].sort((a, b) => b.w * b.h - a.w * a.h)) {
                    if (labelsLeft === 0)
                        break;
                    const pr = toPage(win, r);
                    if (r.k === "text" || pr.h < labelPx * 2.2 || pr.w < labelPx * 7)
                        continue;
                    const box = { x: pr.x, y: pr.y, w: Math.min(pr.w, labelPx * 14), h: Math.round(labelPx * 1.8) };
                    const clash = picked.find((p) => p.box.x < box.x + box.w && box.x < p.box.x + p.box.w && p.box.y < box.y + box.h && box.y < p.box.y + p.box.h);
                    if (clash) {
                        picked.splice(picked.indexOf(clash), 1);
                        labelled.delete(clash.index);
                        labelsLeft++;
                    }
                    picked.push({ index: r.index, box });
                    labelled.add(r.index);
                    labelsLeft--;
                }
            }
            for (const r of ordered) {
                const pr = toPage(win, r);
                const stroke = Math.max(1, Math.round(Sb * 0.0012));
                if (r.k === "text")
                    piece(pr, 3 + r.d, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(wireSoft), `area-${side}-${r.index}`));
                else if (r.k === "divider")
                    piece(pr, 3 + r.d, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(wire), `area-${side}-${r.index}`));
                else
                    piece(pr, 3 + r.d, (0, template_utils_1.tag)(outlineTile(r.k === "control" ? mix(accent, page, 0.6) : wire, pr.w, pr.h, stroke), `area-${side}-${r.index}`));
                if (labelled.has(r.index)) {
                    const text = `${r.label} - ${r.w}x${r.h}`;
                    const fit = (0, text_1.fitText)(text, (0, text_1.budget)(pr.w - 2 * stroke - 4), labelPx * 1.6, labelPx, 7, 1, "regular");
                    piece({ x: pr.x + stroke + 3, y: pr.y + stroke + 2, w: pr.w - 2 * stroke - 6, h: fit.h }, 40, textSource(fit, dim, `label-${side}-${r.index}`, undefined));
                }
            }
        }
        // ── the marks: consequences faintly, primaries in the accent and numbered, removals in red on main ──
        const stroke2 = Math.max(2, Math.round(Sb * 0.0025));
        let n = 0;
        for (const d of diffs) {
            if (!d.primary) {
                // Static on purpose: thirty shifted elements each with motion would be thirty overlay layers.
                if (d.after) {
                    const pr = toPage(L.after, d.after);
                    piece(pr, 60, (0, template_utils_1.tag)(outlineTile(consequence, pr.w, pr.h, Math.max(1, Math.round(stroke2 / 2))), `shift-${d.path}`));
                }
                continue;
            }
            const step = 1 + n;
            const motion = arrive(cut1, step, "fade");
            const color = d.kind === "removed" ? removed : accent;
            if (d.after) {
                const pr = toPage(L.after, d.after);
                piece(pr, 70, (0, template_utils_1.tag)(outlineTile(color, pr.w, pr.h, stroke2, motion), `change-${n}`));
                // The number, in a pill at the corner, inside when it fits.
                const badgeFit = (0, text_1.fitText)(String(n + 1), 60, Math.round(0.02 * Sb), Math.round(0.014 * Sb), 7, 1, "bold");
                const bw = badgeFit.h + Math.round(badgeFit.px * 0.6);
                const bh = badgeFit.h;
                const badge = { x: pr.x + pr.w - bw - stroke2, y: pr.y + stroke2, w: bw, h: bh };
                piece(badge, 71, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(color, { effects: { rounding: { cornerStyle: "pill" } }, overlay: motion }), `badge-${n}`));
                piece(badge, 72, textSource(badgeFit, onColor(color, page, ink), `badge-${n}-text`, motion, "center"));
            }
            if (d.before) {
                const pb = toPage(L.before, d.before);
                piece(pb, 70, (0, template_utils_1.tag)(outlineTile(color, pb.w, pb.h, d.kind === "removed" ? stroke2 : Math.max(1, Math.round(stroke2 * 0.6)), motion), `was-${n}`));
            }
            n++;
        }
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: Wb, rootH: Hb, pieces });
        return { L, m0: placed.m0, sources: placed.sources };
    };
    const label = `Visual Diff - ${copy.title}`;
    const sidecars = {
        before: m0cSidecar("before", before, diffs, copy.title),
        after: m0cSidecar("after", after, diffs, copy.title),
        diff: { title: copy.title, tolerancePx: pickInt(props.tolerancePx, DEFAULTS.tolerancePx, 0, 32, "tolerancePx"), primary: primaries.length, shifted: diffs.length - primaries.length, differences: diffs.map((d) => ({ kind: d.kind, primary: d.primary, label: d.label, path: d.path, dx: d.dx, dy: d.dy, dw: d.dw, dh: d.dh, summary: d.summary })) },
    };
    if (!plan) {
        const board = buildBoard(W, H, true);
        const doc = {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)(board.m0, ID),
            assets,
            size: { width: W, height: H },
            fps: ctx.target.fps,
            durationMs,
            backgroundColor: bg,
            sources: board.sources,
            sidecars,
            editor: { label },
        };
        return (0, layout_1.withLayoutIntent)(doc, ctx, { templateId: ID, constraints: visualDiffContract(board.L), debug: props.debugLayout === true });
    }
    // ── The walk: a camera over a supersampled board, a card per change (the brief's pattern). ──
    const SW = W * walkthrough_1.MAX_ZOOM;
    const SH = H * walkthrough_1.MAX_ZOOM;
    const board = buildBoard(SW, SH, false);
    const buildMs = Math.ceil((S(plan.buildSec) + 0.6) * 1000);
    const dashboard = { kind: "mosaic_document", version: 1, m0: (0, dsl_stdlib_1.toM0String)(board.m0, `${ID}:board`), assets, size: { width: SW, height: SH }, fps: ctx.target.fps, durationMs: Math.min(durationMs, buildMs), backgroundColor: bg, sources: board.sources };
    const held = { kind: "mosaic_document", version: 1, m0: (0, dsl_stdlib_1.toM0String)("1", `${ID}:held`), assets: {}, size: { width: SW, height: SH }, fps: ctx.target.fps, durationMs, backgroundColor: bg, children: { board: dashboard }, sources: [{ type: "mosaic", ref: "board", placement: { fit: "contain" }, playback: { loopMode: "freeze" } }] };
    // The camera frames the changed area with room around it, on the PR side (or on main for a removal).
    const focusBoxes = stops.map((d) => {
        const win = d.after ? board.L.after : board.L.before;
        const r = toPage(win, d.after ?? d.before);
        const padX = Math.max(r.w * 0.6, win.page.w * 0.18);
        const padY = Math.max(r.h * 1.2, win.page.h * 0.12);
        return { x: Math.max(win.page.x, r.x - padX), y: Math.max(win.page.y, r.y - padY), w: Math.min(win.page.w, r.w + 2 * padX), h: Math.min(win.page.h, r.h + 2 * padY) };
    });
    const camera = (0, walkthrough_1.walkCamera)(plan, focusBoxes, SW, SH, S);
    const pieces = [
        { rect: { x: 0, y: 0, w: W, h: H, importance: 0 }, source: { type: "mosaic", ref: "held", placement: { fit: "contain" }, effects: { camera } } },
    ];
    const Sm = Math.min(W, H);
    const barH = Math.max(3, Math.round(0.006 * Sm));
    pieces.push({ rect: { x: 0, y: H - barH, w: W, h: barH, importance: 1 }, source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { overlay: { xExpr: `-W*(1-min(1,t/${durationMs / 1000}))` } }), "progress"), "accent") });
    const pad = Math.round(Sm * 0.022);
    // The card sits over a page that is mostly white (or near-black): a step off
    // the page colour, with a hairline border so its edge reads on either.
    const cardFill = light ? mix(ink, bg, 0.05) : mix(ink, bg, 0.14);
    const cardEdge = mix(ink, bg, light ? 0.22 : 0.3);
    const cardRects = (side) => {
        const cardR = { x: Math.round(W * 0.14), y: Math.round(H * walkthrough_1.NOTE_CARD[side].y), w: Math.round(W * 0.72), h: Math.round(H * walkthrough_1.NOTE_CARD[side].h) };
        return {
            cardR,
            barR: { x: cardR.x + pad, y: cardR.y + Math.round(cardR.h * 0.2), w: Math.max(3, Math.round(W * 0.0035)), h: Math.round(cardR.h * 0.6) },
            labelR: { x: cardR.x + pad * 2, y: cardR.y + Math.round(cardR.h * 0.1), w: cardR.w - pad * 3, h: Math.round(cardR.h * 0.26) },
            noteR: { x: cardR.x + pad * 2, y: cardR.y + Math.round(cardR.h * 0.38), w: cardR.w - pad * 3, h: Math.round(cardR.h * 0.54) },
        };
    };
    const { noteR: noteBox } = cardRects("bottom");
    const noteTexts = plan.stops.map((s) => s.note);
    const notePx = Math.min(...noteTexts.map((t) => (0, text_1.fitText)(t, (0, text_1.budget)(noteBox.w), noteBox.h, Math.round(H * 0.028), 8, 2, "regular").px));
    plan.stops.forEach((s, i) => {
        const d = stops[s.index];
        const { cardR, barR, labelR, noteR } = cardRects((0, walkthrough_1.frameOn)(focusBoxes[s.index], SW, SH).card);
        const a = S(s.arriveSec - 0.15);
        const b = S(s.leaveSec + 0.1);
        const alpha = (0, template_utils_1.keyframeExpr)([{ t: a, v: 0 }, { t: a + S(0.35), v: 1 }, { t: b - S(0.3), v: 1 }, { t: b, v: 0 }], { ease: "smoothstep" });
        const shown = (src) => ({ ...src, overlay: { alpha, enable: `between(t,${a},${b})`, window: { startSec: a, endSec: b } } });
        const tone = d.kind === "removed" ? removed : accent;
        const labelFit = (0, text_1.fitText)(`${i + 1}/${plan.stops.length} - ${d.label.toUpperCase()} - ${d.summary}`, (0, text_1.budget)(labelR.w), labelR.h, Math.round(H * 0.017), 7, 1, "bold");
        const noteFit = (0, text_1.fitText)(s.note, (0, text_1.budget)(noteR.w), noteR.h, notePx, 8, 2, "regular");
        pieces.push({ rect: { ...cardR, importance: 2 + 2 * i }, source: shown((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(cardFill, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.2 } } }), `note-${i}-card`)) });
        pieces.push({ rect: { ...cardR, importance: 3 + 2 * i }, source: shown((0, template_utils_1.tag)(outlineTile(cardEdge, cardR.w, cardR.h, Math.max(1, Math.round(Sm * 0.0015))), `note-${i}-edge`)) });
        pieces.push({ rect: { ...barR, importance: 3 + 2 * i }, source: shown((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(tone, { effects: { rounding: { cornerStyle: "pill" } } }), `note-${i}-bar`)) });
        pieces.push({ rect: { ...labelR, importance: 3 + 2 * i }, source: shown(textSource(labelFit, tone, `note-${i}-label`, undefined)) });
        pieces.push({ rect: { ...noteR, importance: 3 + 2 * i }, source: shown((0, template_utils_1.withBindingHint)((0, template_utils_1.bindProp)(textSource(noteFit, ink, `note-${i}`, undefined), "notes", i), NOTE_HINT)) });
    });
    const placed = (0, template_utils_1.placeInsetPieces)({ rootW: W, rootH: H, pieces });
    return {
        kind: "mosaic_document",
        version: 1,
        m0: (0, dsl_stdlib_1.toM0String)(placed.m0, ID),
        assets: {},
        size: { width: W, height: H },
        fps: ctx.target.fps,
        durationMs,
        backgroundColor: bg,
        children: { held },
        sources: placed.sources,
        sidecars,
        editor: { label: `${label} - ${stops.length} change${stops.length === 1 ? "" : "s"}` },
    };
}
