"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineReviewV1 = void 0;
const types_1 = require("@m0saic/types");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
const template_utils_1 = require("@m0saic/template-utils");
const deals_1 = require("./deals");
const q3_2026_deals_1 = require("./q3-2026-deals");
const walkthrough_1 = require("./walkthrough");
const ID = "@m0saic-dev/sales/pipeline-review/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;
const CARD = "#172231";
const NOTE_FILL = "#1f2d40";
const INK = "#eef2f7";
const DIM = "#8d9bab";
const RULE = "#2c3a4c";
const GOOD = "#34c98e";
const WARN = "#f2a93b";
const DEFAULT_TITLE = "Q3 2026 Pipeline Review";
const DEFAULT_QUARTER = "2026-07";
const DEFAULT_ACCENT = "#5b9cff";
const DEFAULT_PAGE = "#0e1621";
const LIST_ROWS = 5;
const REGION_ROWS = 6;
const DASHBOARD_REF = "dashboard";
const HELD_REF = "held";
const NOTE_HINT = "A note for this headline: the video stops here while it shows. Empty skips it.";
/** Drafts from the Q3 numbers — the presenter rewrites them in their own words. */
const DEFAULT_NOTES = {
    closedWon: "We closed $407K across 9 deals. September was our strongest month at $163K.",
    openPipeline: "We go into Q4 with $371K open, and $209K of it is already in negotiation.",
    byRegion: "West carried 55% of the quarter. Central closed just $29K.",
    slippedList: "$177K was due in Q3 and is still open. Each of these needs a new close date.",
    topRep: "Ada Okafor closed 44% of our wins and also owns Blue Yonder, our largest open deal.",
};
const DEFAULT_DURATION_MS = (0, walkthrough_1.plannedDurationMs)(DEFAULT_NOTES);
// What each prop IS. How Make presents it — its label, hint, placeholder,
// order — lives in pipeline-review.catalog.json beside this file (m0saic 0.3.1).
const propsSchema = (0, template_utils_1.definePropsSchema)({
    title: { type: "string", required: false },
    subtitle: { type: "string", required: false },
    quarterStart: { type: "string", required: false },
    target: {
        type: "number",
        required: false,
        meta: { constraints: { min: 0 }, control: { step: 1000 } },
    },
    deals: {
        type: "json",
        required: false,
        meta: {
            constraints: {
                jsonSchema: {
                    type: "array",
                    minItems: 1,
                    items: {
                        type: "object",
                        required: ["account", "stage", "amount", "closeMonth"],
                        properties: {
                            opportunity: { type: "string" },
                            account: { type: "string", minLength: 1 },
                            region: { type: "string" },
                            owner: { type: "string" },
                            stage: { type: "string", minLength: 1 },
                            amount: { type: "number", minimum: 0 },
                            closeMonth: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
                        },
                    },
                },
            },
            control: {
                flavor: "objectRows",
                columns: [
                    { key: "account", kind: "text", label: "Account", placeholder: "Northwind Traders" },
                    { key: "region", kind: "text", label: "Region", placeholder: "West" },
                    { key: "owner", kind: "text", label: "Owner", placeholder: "Ada Okafor" },
                    { key: "stage", kind: "text", label: "Stage", placeholder: "Closed Won" },
                    { key: "amount", kind: "number", label: "Amount" },
                    { key: "closeMonth", kind: "text", label: "Close month", placeholder: "2026-09" },
                ],
            },
        },
    },
    notes: {
        type: "group",
        required: false,
        fields: Object.fromEntries(walkthrough_1.FOCUS_KEYS.map((key) => [key, { type: "string", required: false }])),
    },
    accent: {
        type: "string",
        required: false,
        meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULT_ACCENT } },
    },
    pageColor: {
        type: "string",
        required: false,
        meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULT_PAGE } },
    },
    animate: { type: "boolean", required: false },
});
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);
/** Pixel rects clamped to a W x H canvas. */
const rectsOn = (W, H) => (x, y, w, h) => {
    const rx = Math.max(0, Math.round(x));
    const ry = Math.max(0, Math.round(y));
    return { x: rx, y: ry, w: Math.max(1, Math.min(W - rx, Math.round(w))), h: Math.max(1, Math.min(H - ry, Math.round(h))) };
};
const roundedTile = (color, r, radius, stroke) => (0, template_utils_1.makeColorTile)(color, {
    effects: {
        rounding: { cornerStyle: "rounded", borderRadius: Math.min(1, (2 * radius) / Math.min(r.w, r.h)) },
        ...(stroke ? { stroke: { position: "inner", width: 2 / Math.min(r.w, r.h), color: stroke, alpha: 0.5 } } : {}),
    },
});
const svgText = (s, r, maxPx, color, hAlign = "left", maxLines = 1) => (0, template_utils_1.svgLabel)(s || " ", r.w, r.h, { maxPx: Math.round(maxPx), maxLines, color, hAlign, vAlign: "middle" });
const fadeIn = (src, at, dur) => {
    const prev = src.overlay ?? {};
    return { ...src, overlay: { ...prev, alpha: (0, template_utils_1.fadeInExpr)(at, dur), window: { startSec: at } } };
};
/**
 * The dashboard at W x H: its m0, its sources, and where each headline
 * landed (the camera's targets). Every size is a fraction of W / H, so the
 * same call draws the 1x board and the supersampled one the camera crops.
 */
function buildDashboard(d, W, H) {
    const { stats, accent, T } = d;
    const R = rectsOn(W, H);
    const S = Math.min(W, H);
    const FADE = Math.max(0.05, T(0.5));
    const radius = Math.round(S * 0.014);
    const pieces = [];
    const put = (rect, layer, source, at) => pieces.push({ rect, layer, source, at });
    const card = (r, at) => put(r, 0, roundedTile(CARD, r, radius), at);
    const text = svgText;
    // One size per column or group: the largest that fits EVERY entry, so a
    // long account name shrinks its whole column instead of standing out.
    const shared = (texts, w, h, maxPx) => Math.min(Math.round(maxPx), ...texts.map((s) => (0, template_utils_1.fitSvgText)(s || " ", Math.floor(w) - 1, Math.floor(h) - 1, { maxPx: Math.round(maxPx), maxLines: 1 }).fontSize));
    // A row cell bound to one leaf of `deals` — only when the prop is a real
    // array (a pasted CSV string has no leaves to address).
    const dealCell = (src, deal, key, kind, hint) => d.indexed ? (0, template_utils_1.withBindingHint)((0, template_utils_1.bindPropPath)(src, "deals", [deal.index, key], kind), hint) : src;
    // Every headline's label is the handle for its note — double-click to add one.
    const noteHandle = (src, key) => (0, template_utils_1.bindProp)(src, `notes.${key}`, undefined, { hint: NOTE_HINT });
    const rects = {};
    const M = W * 0.042;
    const G = W * 0.0125;
    const inner = W - 2 * M;
    const pad = S * 0.022;
    // ── Header ─────────────────────────────────────────────────────────
    const autoSubtitle = `${stats.quarter.span} - ${(0, deals_1.plural)(stats.dealCount, "opportunity", "opportunities")} from the Salesforce export`;
    const titleR = R(M, H * 0.05, inner * 0.72, H * 0.075);
    put(titleR, 1, (0, template_utils_1.bindProp)(text(d.title, titleR, H * 0.058, INK), "title", undefined, {
        hint: "The dashboard's headline - name the quarter it covers.",
    }), T(0.2));
    const subR = R(M, H * 0.128, inner * 0.72, H * 0.04);
    put(subR, 1, (0, template_utils_1.bindProp)(text(d.subtitle.trim() || autoSubtitle, subR, H * 0.026, DIM), "subtitle", undefined, {
        hint: "The line under the headline; leave it empty for the quarter span and deal count.",
    }), T(0.35));
    // ── KPI tiles ──────────────────────────────────────────────────────
    const winRate = stats.winRate;
    const kpis = [
        {
            key: "closedWon",
            value: (0, deals_1.money)(stats.won.total),
            sub: d.target > 0
                ? `${(0, deals_1.pct)(stats.won.total / d.target)} of ${(0, deals_1.money)(d.target)} target`
                : `${(0, deals_1.plural)(stats.won.count, "deal")} closed ${stats.quarter.span.split(" ")[0]}`,
            tone: GOOD,
            valueTone: INK,
            bindTarget: true,
        },
        {
            key: "winRate",
            value: winRate ? (0, deals_1.pct)(winRate.count) : "n/a",
            sub: winRate
                ? `${stats.won.count} of ${stats.won.count + stats.lost.count} closed - ${(0, deals_1.pct)(winRate.value)} by value`
                : "nothing closed this quarter",
            tone: accent,
            valueTone: INK,
        },
        {
            key: "slipped",
            value: (0, deals_1.money)(stats.slippedTotal),
            sub: `${(0, deals_1.plural)(stats.slipped.length, "open deal")} past close month`,
            tone: WARN,
            valueTone: stats.slipped.length > 0 ? WARN : INK,
        },
        {
            key: "openPipeline",
            value: (0, deals_1.money)(stats.open.total),
            sub: `${(0, deals_1.plural)(stats.open.count, "deal")} - ${(0, deals_1.money)(stats.open.negotiationTotal)} in negotiation`,
            tone: accent,
            valueTone: INK,
        },
    ];
    const kpiY = H * 0.2;
    const kpiH = H * 0.2;
    const kpiW = (inner - 3 * G) / 4;
    const valuePx = shared(kpis.map((kpi) => kpi.value), kpiW - 2 * pad, kpiH * 0.42, H * 0.075);
    const kpiSubPx = shared(kpis.map((kpi) => kpi.sub), kpiW - 2 * pad, kpiH * 0.16, H * 0.02);
    kpis.forEach((kpi, i) => {
        const at = T(0.9 + i * 0.35);
        const x = M + i * (kpiW + G);
        const cardR = R(x, kpiY, kpiW, kpiH);
        rects[kpi.key] = cardR;
        card(cardR, at);
        const labelR = R(x + pad, kpiY + kpiH * 0.1, kpiW - 2 * pad, kpiH * 0.17);
        const valueR = R(x + pad, kpiY + kpiH * 0.29, kpiW - 2 * pad, kpiH * 0.42);
        const subR2 = R(x + pad, kpiY + kpiH * 0.73, kpiW - 2 * pad, kpiH * 0.16);
        put(labelR, 1, noteHandle(text(walkthrough_1.FOCUS_LABELS[kpi.key], labelR, H * 0.021, kpi.tone), kpi.key), at);
        put(valueR, 1, text(kpi.value, valueR, valuePx, kpi.valueTone), at);
        const sub = text(kpi.sub, subR2, kpiSubPx, DIM);
        put(subR2, 1, kpi.bindTarget
            ? (0, template_utils_1.bindProp)(sub, "target", undefined, { hint: "The quarter's bookings target in dollars; set it and this line shows attainment." })
            : sub, at);
    });
    // ── Panels: won by month, won by region, slipped ─────────────────────
    const panelY = H * 0.44;
    const panelH = H * 0.38;
    const colWs = [0.28, 0.32, 0.4].map((f) => f * (inner - 2 * G));
    const colXs = [M, M + colWs[0] + G, M + colWs[0] + colWs[1] + 2 * G];
    const panel = (i, key, heading, at, tone = DIM) => {
        const cardR = R(colXs[i], panelY, colWs[i], panelH);
        rects[key] = cardR;
        card(cardR, at);
        const headR = R(colXs[i] + pad, panelY + pad * 0.8, colWs[i] - 2 * pad, H * 0.035);
        put(headR, 1, noteHandle(text(heading, headR, H * 0.021, tone), key), at);
        const top = headR.y + headR.h + H * 0.02;
        return R(colXs[i] + pad, top, colWs[i] - 2 * pad, panelY + panelH - pad - top);
    };
    const accentBar = () => (0, template_utils_1.bindProp)((0, template_utils_1.makeColorTile)(accent), "accent", undefined, { hint: "The bar colour for both won-revenue charts." });
    // Won by month — three columns, value above each bar.
    {
        const at = T(2.7);
        const b = panel(0, "byMonth", "WON BY MONTH", at);
        const valH = H * 0.032;
        const labH = H * 0.034;
        const base = b.y + b.h - labH - H * 0.008;
        const barsTop = b.y + valH + H * 0.012;
        const slotW = b.w / 3;
        const barW = slotW * 0.46;
        const max = Math.max(1, ...stats.byMonth.map((m) => m.total));
        put(R(b.x, base, b.w, Math.max(1, H * 0.002)), 1, (0, template_utils_1.makeColorTile)(RULE), at);
        stats.byMonth.forEach((m, j) => {
            const mAt = T(2.95 + j * 0.15);
            const bh = m.total > 0 ? Math.max(2, Math.round((base - barsTop) * (m.total / max))) : 0;
            if (bh > 0)
                put(R(b.x + slotW * j + (slotW - barW) / 2, base - bh, barW, bh), 1, accentBar(), mAt);
            const vR = R(b.x + slotW * j, base - bh - valH - H * 0.006, slotW, valH);
            put(vR, 1, text((0, deals_1.money)(m.total), vR, H * 0.022, INK, "center"), mAt);
            const lR = R(b.x + slotW * j, base + H * 0.008, slotW, labH);
            const label = text((0, deals_1.monthName)(m.month).toUpperCase(), lR, H * 0.02, DIM, "center");
            put(lR, 1, j === 0
                ? (0, template_utils_1.bindProp)(label, "quarterStart", undefined, { hint: "The quarter's first month as YYYY-MM; the three columns and every total follow it." })
                : label, at);
        });
    }
    // Won by region — every region in the export, so a $0 region shows too.
    {
        const at = T(3.2);
        const b = panel(1, "byRegion", "WON BY REGION", at);
        const regions = stats.byRegion.length > REGION_ROWS
            ? [
                ...stats.byRegion.slice(0, REGION_ROWS - 1),
                (() => {
                    const rest = stats.byRegion.slice(REGION_ROWS - 1);
                    const total = rest.reduce((a, r) => a + r.total, 0);
                    return { region: `${rest.length} others`, total, share: stats.won.total > 0 ? total / stats.won.total : 0 };
                })(),
            ]
            : stats.byRegion;
        const rowH = b.h / Math.max(regions.length, 4);
        const gap = b.w * 0.03;
        const labelW = b.w * 0.25;
        const valueW = b.w * 0.27;
        const barMax = b.w - labelW - valueW - 2 * gap;
        const max = Math.max(1, ...regions.map((r) => r.total));
        const names = regions.map((r) => clip(r.region, 14));
        const values = regions.map((r) => (r.total > 0 ? `${(0, deals_1.money)(r.total)}  ${(0, deals_1.pct)(r.share)}` : "$0"));
        const namePx = shared(names, labelW, rowH, H * 0.022);
        const regionValuePx = shared(values, valueW, rowH, H * 0.021);
        regions.forEach((r, j) => {
            const rAt = T(3.45 + j * 0.12);
            const y = b.y + j * rowH;
            const lR = R(b.x, y, labelW, rowH);
            put(lR, 1, text(names[j], lR, namePx, INK), at);
            const bw = r.total > 0 ? Math.max(2, Math.round(barMax * (r.total / max))) : 0;
            if (bw > 0)
                put(R(b.x + labelW + gap, y + rowH * 0.29, bw, rowH * 0.42), 1, accentBar(), rAt);
            const vR = R(b.x + b.w - valueW, y, valueW, rowH);
            put(vR, 1, text(values[j], vR, regionValuePx, r.total > 0 ? INK : WARN, "right"), rAt);
        });
    }
    // Slipped — open deals already past their close month, largest first.
    {
        const at = T(3.7);
        const b = panel(2, "slippedList", "SLIPPED - NEEDS A NEW CLOSE DATE", at, WARN);
        const cols = [0.43, 0.27, 0.11, 0.19].map((f) => f * b.w);
        const cx = [b.x, b.x + cols[0], b.x + cols[0] + cols[1], b.x + cols[0] + cols[1] + cols[2]];
        const headH = H * 0.03;
        ["ACCOUNT", "STAGE", "CLOSE", "AMOUNT"].forEach((h, c) => {
            const r = R(cx[c], b.y, cols[c], headH);
            put(r, 1, text(h, r, H * 0.016, DIM, c === 3 ? "right" : "left"), at);
        });
        const rowH = Math.min((b.h - headH) / LIST_ROWS, H * 0.055);
        const listTop = b.y + headH + H * 0.008;
        if (stats.slipped.length === 0) {
            const r = R(b.x, listTop, b.w, rowH);
            put(r, 1, text(`Nothing slipped - every open deal closes after ${(0, deals_1.monthName)(stats.quarter.months[2])}`, r, H * 0.021, GOOD), T(3.95));
        }
        const overflow = stats.slipped.length > LIST_ROWS;
        const shown = stats.slipped.slice(0, overflow ? LIST_ROWS - 1 : LIST_ROWS);
        const accounts = shown.map((deal) => clip(deal.row.account, 24));
        const stages = shown.map((deal) => clip(deal.row.stage, 16));
        const accountPx = shared(accounts, cols[0] - b.w * 0.02, rowH, H * 0.021);
        const stagePx = shared(stages, cols[1] - b.w * 0.02, rowH, H * 0.021);
        const closePx = shared(shown.map((deal) => (0, deals_1.monthName)(deal.row.closeMonth)), cols[2], rowH, H * 0.021);
        const amountPx = shared(shown.map((deal) => (0, deals_1.money)(deal.row.amount)), cols[3], rowH, H * 0.021);
        shown.forEach((deal, j) => {
            const dAt = T(3.95 + j * 0.15);
            const y = listTop + j * rowH;
            put(R(b.x, y, b.w, Math.max(1, H * 0.0015)), 1, (0, template_utils_1.makeColorTile)(RULE), dAt);
            const r0 = R(cx[0], y, cols[0] - b.w * 0.02, rowH);
            const r1 = R(cx[1], y, cols[1] - b.w * 0.02, rowH);
            const r2 = R(cx[2], y, cols[2], rowH);
            const r3 = R(cx[3], y, cols[3], rowH);
            put(r0, 1, dealCell(text(accounts[j], r0, accountPx, INK), deal, "account", "string", "This deal's account name, as it appears in the export."), dAt);
            put(r1, 1, dealCell(text(stages[j], r1, stagePx, DIM), deal, "stage", "string", "This deal's stage; set it to Closed Won or Closed Lost and it leaves the slipped list."), dAt);
            put(r2, 1, dealCell(text((0, deals_1.monthName)(deal.row.closeMonth), r2, closePx, WARN), deal, "closeMonth", "string", "This deal's close month as YYYY-MM; move it past the quarter and it leaves the slipped list."), dAt);
            put(r3, 1, dealCell(text((0, deals_1.money)(deal.row.amount), r3, amountPx, INK, "right"), deal, "amount", "number", "This deal's amount in dollars."), dAt);
        });
        if (overflow) {
            const rest = stats.slipped.slice(LIST_ROWS - 1);
            const y = listTop + (LIST_ROWS - 1) * rowH;
            const r = R(b.x, y, b.w, rowH);
            put(r, 1, text(`+${rest.length} more - ${(0, deals_1.money)(rest.reduce((a, deal) => a + deal.row.amount, 0))}`, r, H * 0.021, DIM), T(3.95 + (LIST_ROWS - 1) * 0.15));
        }
    }
    // ── Callouts ───────────────────────────────────────────────────────
    const topRegion = stats.byRegion[0];
    const big = stats.biggestOpen;
    const callouts = [
        ["topRegion", topRegion && topRegion.total > 0 ? `${topRegion.region} - ${(0, deals_1.money)(topRegion.total)}, ${(0, deals_1.pct)(topRegion.share)} of wins` : "No wins this quarter"],
        ["topRep", stats.topRep ? `${stats.topRep.owner} - ${(0, deals_1.money)(stats.topRep.total)}, ${(0, deals_1.pct)(stats.topRep.share)} of wins` : "No wins this quarter"],
        ["biggestOpen", big ? `${clip(big.row.account, 24)} - ${(0, deals_1.money)(big.row.amount)}, ${big.row.stage}, ${(0, deals_1.monthName)(big.row.closeMonth)}` : "No open deals"],
    ];
    const callY = H * 0.85;
    const callH = H * 0.105;
    const bodyPx = Math.min(...callouts.map(([, body], i) => shared([body], colWs[i] - 2 * pad, callH * 0.4, H * 0.025)));
    callouts.forEach(([key, body], i) => {
        const at = T(5.0 + i * 0.3);
        const cardR = R(colXs[i], callY, colWs[i], callH);
        rects[key] = cardR;
        card(cardR, at);
        const lR = R(colXs[i] + pad, callY + callH * 0.13, colWs[i] - 2 * pad, callH * 0.3);
        const bR = R(colXs[i] + pad, callY + callH * 0.46, colWs[i] - 2 * pad, callH * 0.4);
        put(lR, 1, noteHandle(text(walkthrough_1.FOCUS_LABELS[key], lR, H * 0.017, DIM), key), at);
        put(bR, 1, text(body, bR, bodyPx, INK), at);
    });
    const placed = (0, template_utils_1.placeInsetPieces)({
        rootW: W,
        rootH: H,
        pieces: pieces.map((p) => ({
            rect: { ...p.rect, importance: p.layer },
            source: d.animate && p.at !== undefined ? fadeIn(p.source, p.at, FADE) : p.source,
        })),
    });
    return { m0: String(placed.m0), sources: placed.sources, rects };
}
// The template's label, description and tags live in pipeline-review.catalog.json.
exports.PipelineReviewV1 = (0, template_utils_1.defineMosaicTemplate)({
    id: (0, types_1.asTemplateId)(ID),
    capabilities: { tier: "core" },
    outputHints: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: DEFAULT_DURATION_MS,
        format: { kind: "video", container: "mp4" },
        note: "Builds over ~6s, then stops on each headline that has a note. Its length follows the notes. Designed for 16:9.",
    },
    // The clip is as long as the notes need: each stop gets reading time.
    resolveOutputHints: (props) => ({
        durationMs: props.animate === false ? walkthrough_1.PLAIN_SEC * 1000 : (0, walkthrough_1.plannedDurationMs)(props.notes),
    }),
    bindings: {
        unbound: {
            pageColor: "the page background - no rect of its own",
        },
    },
    propsSchema,
    defaultProps: {
        title: DEFAULT_TITLE,
        subtitle: "",
        quarterStart: DEFAULT_QUARTER,
        target: 0,
        deals: q3_2026_deals_1.Q3_2026_DEALS,
        notes: DEFAULT_NOTES,
        accent: DEFAULT_ACCENT,
        pageColor: DEFAULT_PAGE,
        animate: true,
    },
    async render(props, ctx) {
        // The schema is documentation; render() is the gate.
        const target = props.target ?? 0;
        const animate = props.animate ?? true;
        for (const [key, value] of [["accent", props.accent], ["pageColor", props.pageColor]]) {
            if (value !== undefined && !HEX.test(value)) {
                throw new Error(`${ID}: ${key} ${JSON.stringify(value)} must be #rrggbb.`);
            }
        }
        if (typeof target !== "number" || !Number.isFinite(target) || target < 0) {
            throw new Error(`${ID}: target must be a number >= 0 (0 = no target).`);
        }
        for (const { key, note } of (0, walkthrough_1.noteStops)(props.notes)) {
            if (note.length > walkthrough_1.MAX_NOTE) {
                throw new Error(`${ID}: notes.${key} is ${note.length} characters; keep a note to ${walkthrough_1.MAX_NOTE} so it fits two lines.`);
            }
        }
        let parsed;
        let stats;
        try {
            parsed = (0, deals_1.parseDeals)(props.deals ?? q3_2026_deals_1.Q3_2026_DEALS);
            stats = (0, deals_1.computeStats)(parsed.rows, props.quarterStart || DEFAULT_QUARTER);
        }
        catch (e) {
            throw new Error(`${ID}: ${e.message}`);
        }
        const accent = (props.accent ?? DEFAULT_ACCENT);
        const page = (props.pageColor ?? DEFAULT_PAGE);
        const { width: W, height: H } = ctx.target;
        // Timing: the schedule is authored in planned seconds — the build, then
        // the walk. A clip shorter than planned squeezes all of it to fit; a
        // longer one just holds the full view longer at the end.
        const stops = animate ? (0, walkthrough_1.noteStops)(props.notes) : [];
        const plan = stops.length > 0 ? (0, walkthrough_1.planWalk)(stops) : undefined;
        const plannedSec = plan ? plan.endSec : walkthrough_1.BUILD_SEC / 0.45;
        const k = Math.min(1, ctx.target.durationMs / 1000 / plannedSec);
        const T = (sec) => Number((sec * k).toFixed(3));
        const input = {
            title: props.title ?? DEFAULT_TITLE,
            subtitle: props.subtitle ?? "",
            target,
            accent,
            stats,
            indexed: parsed.indexed,
            animate,
            T,
        };
        if (!plan) {
            const board = buildDashboard(input, W, H);
            return {
                kind: "mosaic_document",
                version: 1,
                m0: (0, dsl_stdlib_1.toM0String)(board.m0, ID),
                assets: {},
                backgroundColor: page,
                sources: board.sources,
            };
        }
        // ── The walkthrough: camera over a supersampled dashboard + note cards ──
        const SW = W * walkthrough_1.MAX_ZOOM;
        const SH = H * walkthrough_1.MAX_ZOOM;
        const board = buildDashboard(input, SW, SH);
        // The board stops changing once it has built, so it renders only the
        // build (+ a beat) — a 4x-pixel child for 7s instead of the whole clip
        // is most of the render time saved. A full-length HELD layer freezes its
        // last frame, and the camera crops that. The freeze must sit one level
        // BELOW the camera: the engine applies a source's effects before its
        // playback, so a camera and a freeze on the same source freeze the
        // camera too (it stops wherever it was when the child ran out).
        const buildMs = Math.ceil((T(walkthrough_1.BUILD_SEC) + 0.6) * 1000);
        const dashboard = {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)(board.m0, `${ID}:dashboard`),
            assets: {},
            // The camera's rects are in THIS space.
            size: { width: SW, height: SH },
            fps: ctx.target.fps,
            durationMs: Math.min(ctx.target.durationMs, buildMs),
            backgroundColor: page,
            sources: board.sources,
        };
        const held = {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)("1", `${ID}:held`),
            assets: {},
            size: { width: SW, height: SH },
            fps: ctx.target.fps,
            durationMs: ctx.target.durationMs,
            backgroundColor: page,
            children: { [DASHBOARD_REF]: dashboard },
            sources: [
                { type: "mosaic", ref: DASHBOARD_REF, placement: { fit: "contain" }, playback: { loopMode: "freeze" } },
            ],
        };
        const camera = (0, walkthrough_1.walkCamera)(plan, board.rects, SW, SH, T);
        const R = rectsOn(W, H);
        const S = Math.min(W, H);
        const pad = S * 0.022;
        const pieces = [
            {
                rect: { x: 0, y: 0, w: W, h: H, importance: 0 },
                source: { type: "mosaic", ref: HELD_REF, placement: { fit: "contain" }, effects: { camera } },
            },
        ];
        const tone = (key) => key === "closedWon" ? GOOD : key === "slipped" || key === "slippedList" ? WARN : accent;
        // The note card: below the headline, or above it when the headline sits
        // too low for the camera to lift it clear (frameOn decides per stop).
        const cardRects = (side) => {
            const cardR = R(W * 0.14, H * walkthrough_1.NOTE_CARD[side].y, W * 0.72, H * walkthrough_1.NOTE_CARD[side].h);
            return {
                cardR,
                barR: R(cardR.x + pad, cardR.y + cardR.h * 0.2, Math.max(3, W * 0.0035), cardR.h * 0.6),
                labelR: R(cardR.x + pad * 2, cardR.y + cardR.h * 0.1, cardR.w - pad * 3, cardR.h * 0.26),
                noteR: R(cardR.x + pad * 2, cardR.y + cardR.h * 0.38, cardR.w - pad * 3, cardR.h * 0.54),
            };
        };
        const { noteR: noteBox } = cardRects("bottom");
        const notePx = Math.min(...plan.stops.map((s) => (0, template_utils_1.fitSvgText)(s.note, noteBox.w - 1, noteBox.h - 1, { maxPx: Math.round(H * 0.03), maxLines: 2 }).fontSize));
        plan.stops.forEach((s, i) => {
            const { cardR, barR, labelR, noteR } = cardRects((0, walkthrough_1.frameOn)(board.rects[s.key], SW, SH).card);
            // Shown while the camera is settled, with a short fade either side.
            const a = T(s.arriveSec - 0.15);
            const b = T(s.leaveSec + 0.1);
            const alpha = (0, template_utils_1.keyframeExpr)([
                { t: a, v: 0 }, { t: a + T(0.35), v: 1 }, { t: b - T(0.3), v: 1 }, { t: b, v: 0 },
            ], { ease: "smoothstep" });
            const shown = (src) => ({
                ...src,
                overlay: { alpha, enable: `between(t,${a},${b})`, window: { startSec: a, endSec: b } },
            });
            // Each stop gets its own two layers: they share one rect, at different times.
            pieces.push({ rect: { ...cardR, importance: 1 + 2 * i }, source: shown(roundedTile(NOTE_FILL, cardR, Math.round(S * 0.014), tone(s.key))) });
            pieces.push({ rect: { ...barR, importance: 2 + 2 * i }, source: shown(roundedTile(tone(s.key), barR, Math.round(barR.w / 2))) });
            pieces.push({ rect: { ...labelR, importance: 2 + 2 * i }, source: shown(svgText(`${walkthrough_1.FOCUS_LABELS[s.key]}   ${i + 1}/${plan.stops.length}`, labelR, H * 0.018, tone(s.key))) });
            pieces.push({ rect: { ...noteR, importance: 2 + 2 * i }, source: shown((0, template_utils_1.bindProp)(svgText(s.note, noteR, notePx, INK, "left", 2), `notes.${s.key}`, undefined, { hint: NOTE_HINT })) });
        });
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: W, rootH: H, pieces });
        return {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)(placed.m0, ID),
            assets: {},
            backgroundColor: page,
            children: { [HELD_REF]: held },
            sources: placed.sources,
        };
    },
});
exports.default = exports.PipelineReviewV1;
