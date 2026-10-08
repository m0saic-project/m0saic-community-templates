"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyBriefV1 = exports.BRIEF_BAR_GRAPH_ID = exports.BRIEF_LINE_CHART_ID = exports.BRIEF_MIN_CHART_H = exports.BRIEF_MIN_CHART_W = exports.BRIEF_MAX_POINTS = exports.BRIEF_FORMATS = exports.BRIEF_CHARTS = exports.BRIEF_BAD = exports.BRIEF_GOOD = exports.BRIEF_THEME_COLORS = exports.BRIEF_THEMES = exports.BRIEF_PLATFORM_KEYS = exports.BRIEF_PLATFORMS = exports.BRIEF_MAX_HIGHLIGHTS = exports.BRIEF_MAX_METRICS = exports.BRIEF_MAX_SEC = exports.BRIEF_MIN_SEC = void 0;
exports.briefBeats = briefBeats;
exports.layoutWeeklyBrief = layoutWeeklyBrief;
exports.weeklyBriefContract = weeklyBriefContract;
exports.trendOfDelta = trendOfDelta;
exports.formatValue = formatValue;
exports.lineDomain = lineDomain;
exports.formatDelta = formatDelta;
exports.noteStops = noteStops;
exports.plannedDurationMs = plannedDurationMs;
const types_1 = require("@m0saic/types");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
const template_utils_1 = require("@m0saic/template-utils");
const walkthrough_1 = require("./walkthrough");
const layout_1 = require("./layout");
const text_1 = require("./text");
const ID = "@m0saic-dev/insights/weekly-brief/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;
exports.BRIEF_MIN_SEC = 8;
exports.BRIEF_MAX_SEC = 30;
exports.BRIEF_MAX_METRICS = 6;
exports.BRIEF_MAX_HIGHLIGHTS = 3;
exports.BRIEF_PLATFORMS = {
    /** 16:9 at full size - the player in an inbox, or a slide. */
    email: { width: 1920, height: 1080 },
    /** 16:9 at 720p - a lighter file for a chat message's inline player. */
    chat: { width: 1280, height: 720 },
    /** 1:1 - a feed or a dashboard tile; two tiles across. */
    square: { width: 1080, height: 1080 },
    /** 9:16 - a phone; two tiles across, the rest stacks. */
    mobile: { width: 1080, height: 1920 },
};
exports.BRIEF_PLATFORM_KEYS = Object.keys(exports.BRIEF_PLATFORMS);
exports.BRIEF_THEMES = ["light", "dark"];
exports.BRIEF_THEME_COLORS = {
    light: { background: "#f6f7f9", ink: "#161a22" },
    dark: { background: "#0f1218", ink: "#eef1f6" },
};
/** Status colours for a delta - reserved, never a series colour; the sign and the word carry the meaning too. */
exports.BRIEF_GOOD = "#22a06b";
exports.BRIEF_BAD = "#e5484d";
exports.BRIEF_CHARTS = ["line", "bars"];
exports.BRIEF_FORMATS = ["number", "currency", "percent"];
/** Points per series - the chart templates' comfortable width for a sparkline slot. */
exports.BRIEF_MAX_POINTS = 24;
/** The smallest slot a nested chart renders in (px); under it the tile shows no chart. */
exports.BRIEF_MIN_CHART_W = 96;
exports.BRIEF_MIN_CHART_H = 36;
/** What Make shows on a tile's handle (and under the note card's editor). */
const NOTE_HINT = "A note for the reader: the video stops on this tile, zooms in and shows it, then moves on. Empty removes the stop.";
/** The vendored chart templates this template nests (ids renamed from `@m0saic/charts/...`). */
// The charts are the OFFICIAL pack's, nested by id: every m0saic host (CLI,
// Desktop, Mosaic Web) registers @m0saic/templates, and the demo-lab vendor
// copies this template was built against are byte-identical to these two
// (shipped, so frozen — the same frame forever). The community pack never
// imports @m0saic/templates (dep-allowlist); the id is the whole contract.
exports.BRIEF_LINE_CHART_ID = "@m0saic/charts/line-chart/v2";
exports.BRIEF_BAR_GRAPH_ID = "@m0saic/charts/bar-graph/v3";
/** Generic on purpose: this repo is public, so the defaults name no real company, product or person. */
const DEFAULTS = {
    platform: "email",
    brandName: "Harbor & Pine",
    title: "Weekly brief",
    periodLabel: "Week of 6 Oct 2026",
    greeting: "Good morning",
    recipientName: "Dana",
    headline: "Revenue is up 8% on last week, carried by returning customers; order value slipped again and support volume fell.",
    metrics: [
        { label: "Net revenue", format: "currency", series: [318000, 331000, 342000, 339000, 355000, 361000, 372000, 368000, 381000, 379000, 381000, 412000], caption: "Sum of paid orders, refunds removed." },
        { label: "Orders", format: "number", chart: "bars", series: [2510, 2602, 2688, 2650, 2790, 2841, 2905, 2870, 3010, 2988, 3030, 3184], caption: "Orders placed, any channel." },
        { label: "New customers", format: "number", series: [880, 905, 940, 921, 980, 1010, 1044, 1032, 1098, 1105, 1116, 1250], caption: "First order ever placed this week." },
        { label: "Repeat rate", format: "percent", series: [34, 35, 35, 36, 37, 37, 38, 38, 39, 39, 39, 41], caption: "Share of orders from a returning customer." },
        { label: "Average order", format: "currency", series: [138, 137, 136, 136, 135, 134, 133, 133, 132, 132, 131, 129], caption: "Net revenue over orders.", note: "Third week of decline. The bundle promotion ends Friday - I expect this to recover in next week's brief; if not, we revisit pricing." },
        { label: "Support tickets", format: "number", upIsGood: false, chart: "bars", series: [280, 275, 268, 271, 262, 255, 250, 248, 240, 236, 233, 212], caption: "New tickets opened this week." },
    ],
    deltaLabel: "vs last week",
    highlights: [
        "Returning customers drove the revenue gain; new-customer orders were flat.",
        "Average order value slipped for the third week; the bundle promotion ends Friday.",
        "Support volume fell after the shipping-status email went live.",
    ],
    footer: "6 questions, answered live from orders_db and support_db at 06:00 Monday",
    ctaUrl: "brief.example/harbor-pine/2026-w41",
    theme: "light",
    accent: "#2f6fed",
    durationSec: 16,
};
// What each prop IS. How Make presents it lives in weekly-brief.catalog.json.
const propsSchema = (0, template_utils_1.definePropsSchema)({
    platform: { type: "string", required: false, meta: { constraints: { oneOf: [...exports.BRIEF_PLATFORM_KEYS] } } },
    brandName: { type: "string", required: false },
    brandLogo: {
        type: "media[]",
        required: false,
        meta: { control: { multiple: false, picker: "file", accept: ["image", "video"] } },
    },
    title: { type: "string", required: false },
    periodLabel: { type: "string", required: false },
    greeting: { type: "string", required: false },
    recipientName: { type: "string", required: false },
    headline: { type: "string", required: false },
    metrics: {
        type: "json",
        required: false,
        meta: {
            constraints: {
                jsonSchema: {
                    type: "array",
                    minItems: 1,
                    maxItems: exports.BRIEF_MAX_METRICS,
                    items: {
                        type: "object",
                        required: ["label"],
                        properties: {
                            label: { type: "string" },
                            series: { type: "array", minItems: 1, maxItems: exports.BRIEF_MAX_POINTS, items: { type: "number" } },
                            format: { type: "string", enum: [...exports.BRIEF_FORMATS] },
                            decimals: { type: "integer", minimum: 0, maximum: 4 },
                            value: { type: "string" },
                            delta: { type: "string" },
                            upIsGood: { type: "boolean" },
                            chart: { type: "string", enum: [...exports.BRIEF_CHARTS] },
                            caption: { type: "string" },
                            note: { type: "string", maxLength: walkthrough_1.MAX_NOTE },
                        },
                    },
                },
            },
        },
    },
    deltaLabel: { type: "string", required: false },
    highlights: { type: "string[]", required: false, meta: { constraints: { maxItems: exports.BRIEF_MAX_HIGHLIGHTS } } },
    footer: { type: "string", required: false },
    ctaUrl: { type: "string", required: false },
    theme: { type: "string", required: false, meta: { constraints: { oneOf: [...exports.BRIEF_THEMES] } } },
    accent: {
        type: "string",
        required: false,
        meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.accent } },
    },
    background: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
    ink: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
    durationSec: { type: "number", required: false, meta: { constraints: { min: exports.BRIEF_MIN_SEC, max: exports.BRIEF_MAX_SEC } } },
    debugLayout: { type: "boolean", required: false },
});
/** 10% hello alone, one tile per stagger, the highlights a beat after the last tile; capped at half the clip. */
function briefBeats(totalSec, tileCount) {
    const D = round3(totalSec);
    const rise = round3(Math.min(0.4, 0.05 * D));
    const stagger = round3(Math.min(0.4, 0.045 * D));
    const cut1 = round3(0.1 * D);
    const cut2 = round3(Math.min(0.5 * D, cut1 + (tileCount + 1) * stagger + rise + 0.4));
    return { total: D, cuts: [cut1, cut2], rise, stagger };
}
/**
 * Three bands in every orientation: the hello (chrome row, greeting,
 * headline), the grid of tiles (three across in landscape, two in square and
 * portrait), the so-what (highlights, then footer and link). The grid takes
 * what the other two leave; every text rect is sized FROM its fitted block.
 */
function layoutWeeklyBrief(copy, W, H) {
    const S = Math.min(W, H);
    const stacked = W / H < 0.9;
    const margin = Math.round(0.05 * S);
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
    const rowH = Math.max(10, Math.round(0.036 * S));
    const wmFit = (0, text_1.fitText)(copy.brandName.toUpperCase(), (0, text_1.budget)(Math.round(cw * 0.5)), rowH, Math.round(0.026 * S), 8, 1, "bold");
    const logo = copy.hasLogo ? clamp({ x: x0, y: Math.round(0.035 * S), w: Math.round(Math.min(cw * 0.45, 0.36 * W)), h: Math.round(0.08 * S) }) : null;
    const wmY = logo ? logo.y + Math.round((logo.h - wmFit.h) / 2) : Math.round(0.045 * S);
    const wordmark = at(wmFit, clamp({ x: x0, y: wmY, w: Math.round(cw * 0.5), h: wmFit.h }));
    // The delta label is said ONCE, up here, not on every tile.
    const kickerText = [copy.title, copy.periodLabel, copy.deltaLabel].filter(Boolean).join("  -  ").toUpperCase();
    const kickerFit = kickerText ? (0, text_1.fitText)(kickerText, (0, text_1.budget)(Math.round(cw * 0.48)), rowH, Math.round(0.024 * S), 8, 1, "regular") : null;
    const kicker = kickerFit ? at(kickerFit, clamp({ x: x0 + cw - Math.round(cw * 0.48), y: wmY + Math.round((wmFit.h - kickerFit.h) / 2), w: Math.round(cw * 0.48), h: kickerFit.h })) : null;
    const chromeBottom = logo ? logo.y + logo.h : wordmark.rect.y + wordmark.rect.h;
    // ── hello: greeting, headline ──
    let y = chromeBottom + Math.round(0.04 * S);
    const helloText = copy.recipientName ? (copy.greeting ? `${copy.greeting}, ${copy.recipientName}` : copy.recipientName) : copy.greeting;
    const helloFit = helloText ? (0, text_1.fitText)(helloText, (0, text_1.budget)(cw), 0.1 * H, Math.round(0.056 * S), 12, 1, "bold") : null;
    const hello = helloFit ? at(helloFit, clamp({ x: x0, y, w: cw, h: helloFit.h })) : null;
    if (helloFit)
        y += helloFit.h + Math.round(gap * 0.6);
    const headlineW = Math.round(cw * (stacked ? 1 : 0.78));
    const headlineFit = (0, text_1.fitText)(copy.headline, (0, text_1.budget)(headlineW), 0.12 * H, Math.round(0.03 * S), 9, stacked ? 3 : 2, "regular");
    const headline = at(headlineFit, clamp({ x: x0, y, w: headlineW, h: headlineFit.h }));
    y += headlineFit.h;
    const helloEnd = y;
    // ── the bottom block is measured first so the grid takes the rest ──
    const barH = Math.max(3, Math.round(0.006 * S));
    const bar = { x: 0, y: H - barH, w: W, h: barH };
    const bottomY1 = H - barH - Math.round(0.045 * S);
    const dotD = Math.max(6, Math.round(0.012 * S));
    const hlTextX = x0 + dotD + Math.round(gap * 0.8);
    const hlW = Math.round(cw * (stacked ? 1 : 0.72)) - (hlTextX - x0);
    const hlGap = Math.round(gap * 0.7);
    // The pill is sized first; the footer takes whatever width it leaves.
    const urlFit = copy.ctaUrl ? (0, text_1.fitText)(copy.ctaUrl, (0, text_1.budget)(Math.round(cw * 0.45)), 0.05 * H, Math.round(0.023 * S), 7, 1, "bold") : null;
    const pillH = urlFit ? urlFit.h + Math.round(urlFit.px * 0.7) : 0;
    const pillW = urlFit ? Math.min(Math.round(cw * 0.45), Math.ceil(urlFit.width / 0.94) + Math.round(urlFit.px * 1.6)) : 0;
    const footerW = cw - (pillW ? pillW + gap : 0);
    // Three across only on a wide canvas; square and portrait take two, so a
    // value and its chart keep room on one row.
    const m = copy.metrics.length;
    const cols = Math.min(m, W / H >= 1.2 ? 3 : 2);
    const rows = Math.ceil(m / cols);
    const gridY0 = helloEnd + Math.round(0.04 * S);
    const tileW = Math.floor((cw - gap * (cols - 1)) / cols);
    // A stat tile is wider than tall: on a portrait canvas the grid must not
    // swallow the leftover height (it stretched the tiles and their charts).
    const tileMax = Math.min(0.34 * H, Math.round(tileW * 0.6));
    // Two passes over the bottom block: roomy (two-line highlights), and when
    // that would push the tiles under their minimum height, compact (one line
    // each, smaller). The numbers are the brief; the so-what yields first.
    const tileMin = Math.round(0.15 * S);
    const measureBottom = (compact) => {
        const px = Math.round((compact ? 0.021 : 0.026) * S);
        const lines = compact ? 1 : 2;
        // One size for the whole list: the largest that fits every line.
        const first = copy.highlights.map((h) => (0, text_1.fitText)(h, (0, text_1.budget)(hlW), 0.08 * H, px, 8, lines, "regular"));
        const shared = first.reduce((m, f) => Math.min(m, f.px), px);
        const hlFits = first.map((f, i) => (f.px === shared ? f : (0, text_1.fitText)(copy.highlights[i], (0, text_1.budget)(hlW), 0.08 * H, shared, 8, lines, "regular")));
        const footerFit = copy.footer ? (0, text_1.fitText)(copy.footer, (0, text_1.budget)(footerW), 0.05 * H, Math.round(0.021 * S), 7, compact || !stacked ? 1 : 2, "regular") : null;
        const lastH = Math.max(footerFit?.h ?? 0, pillH);
        const hlBlockH = hlFits.reduce((a, f) => a + f.h, 0) + hlGap * Math.max(0, hlFits.length - 1);
        const bottomH = hlBlockH + (hlBlockH > 0 && lastH > 0 ? gap : 0) + lastH;
        const gridY1 = bottomY1 - bottomH - (bottomH > 0 ? Math.round(0.04 * S) : 0);
        const tileH = Math.floor(Math.min((Math.max(1, gridY1 - gridY0) - gap * (rows - 1)) / rows, tileMax));
        return { hlFits, footerFit, lastH, bottomH, tileH };
    };
    let bottom = measureBottom(false);
    if (bottom.tileH < tileMin)
        bottom = measureBottom(true);
    const { hlFits, footerFit, lastH, tileH } = bottom;
    // ── the grid ──
    const pad = Math.round(0.016 * S);
    const tiles = [];
    copy.metrics.forEach((metric, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const rect = clamp({ x: x0 + c * (tileW + gap), y: gridY0 + r * (tileH + gap), w: tileW, h: tileH });
        // The stat-tile anatomy: label on top, caption at the bottom, and between
        // them one row - the value with its delta on the left, the sparkline on
        // the right, as tall as the row.
        const innerX = rect.x + pad;
        const innerW = rect.w - 2 * pad;
        const hasChart = metric.series.length > 0;
        const labelFit = (0, text_1.fitText)(metric.label, (0, text_1.budget)(innerW), tileH * 0.16, Math.round(0.02 * S), 7, 1, "regular");
        const capFit = metric.caption ? (0, text_1.fitText)(metric.caption, (0, text_1.budget)(innerW), tileH * 0.14, Math.round(0.017 * S), 7, 1, "regular") : null;
        const capH = capFit ? capFit.h : 0;
        const label = at(labelFit, clamp({ x: innerX, y: rect.y + pad, w: innerW, h: labelFit.h }));
        const rowY = label.rect.y + label.rect.h + Math.round(gap * 0.3);
        const rowBottom = rect.y + rect.h - pad - (capH ? capH + Math.round(gap * 0.4) : 0);
        const rowH = Math.max(1, rowBottom - rowY);
        const leftW = hasChart ? Math.round(innerW * 0.56) : innerW;
        const valueFit = (0, text_1.fitText)(metric.value, (0, text_1.budget)(leftW), rowH * 0.9, Math.round(0.052 * S), 10, 1, "bold");
        const deltaFit = metric.delta ? (0, text_1.fitText)(metric.delta, (0, text_1.budget)(Math.round(leftW * 0.6)), rowH * 0.4, Math.round(0.022 * S), 7, 1, "bold") : null;
        // The delta rides the value's baseline when the two fit side by side, else sits under it.
        const beside = deltaFit ? Math.ceil(valueFit.width / 0.94) + Math.round(gap * 0.6) + Math.ceil(deltaFit.width / 0.94) + 2 <= leftW : false;
        const blockH = valueFit.h + (deltaFit && !beside ? deltaFit.h : 0);
        const vy = rowY + Math.max(0, (rowH - blockH) / 2);
        const value = at(valueFit, clamp({ x: innerX, y: vy, w: leftW, h: valueFit.h }));
        let delta = null;
        if (deltaFit) {
            const dw = Math.ceil(deltaFit.width / 0.94) + 2;
            delta = beside
                ? at(deltaFit, clamp({ x: innerX + Math.ceil(valueFit.width / 0.94) + Math.round(gap * 0.6), y: vy + valueFit.h - deltaFit.h - Math.round(valueFit.px * 0.14), w: dw, h: deltaFit.h }))
                : at(deltaFit, clamp({ x: innerX, y: vy + valueFit.h, w: dw, h: deltaFit.h }));
        }
        // The nested chart needs real pixels (its chrome splits are px-based and
        // a slot under ~96x36 fails to flatten - SPLIT_EXCEEDS_AXIS); below that
        // the tile is a plain stat tile.
        // The chart keeps a sparkline's proportions (never taller than ~0.55 of its
        // width) and sits centred in the row, like the value beside it.
        const chartX = innerX + leftW + gap;
        const chartW = innerX + innerW - chartX;
        const chartH = Math.min(rowH, Math.round(chartW * 0.55));
        const chart = hasChart && chartW >= exports.BRIEF_MIN_CHART_W && chartH >= exports.BRIEF_MIN_CHART_H ? clamp({ x: chartX, y: rowY + (rowH - chartH) / 2, w: chartW, h: chartH }) : null;
        const caption = capFit ? at(capFit, clamp({ x: innerX, y: rect.y + rect.h - pad - capH, w: innerW, h: capH })) : null;
        tiles.push({ metric, rect, label, value, delta, chart, caption });
    });
    const gridEnd = gridY0 + rows * tileH + (rows - 1) * gap;
    // ── so what: the highlights follow the grid; the footer and the link hold
    //    the bottom edge (or follow the highlights when there is no room) ──
    let hy = gridEnd + Math.round(0.04 * S);
    const highlights = hlFits.map((fit, i) => {
        const text = at(fit, clamp({ x: hlTextX, y: hy, w: hlW, h: fit.h }));
        const dot = clamp({ x: x0, y: hy + Math.round(fit.px * 0.62) - dotD / 2 + Math.round((fit.h - fit.px * 1.25) / 2), w: dotD, h: dotD });
        hy += fit.h + hlGap;
        return { index: i, dot, text };
    });
    if (hlFits.length > 0)
        hy += gap - hlGap;
    const lastY = Math.max(hy, bottomY1 - lastH);
    const pill = urlFit ? clamp({ x: x0 + cw - pillW, y: lastY + (lastH - pillH) / 2, w: pillW, h: pillH }) : null;
    const footer = footerFit ? at(footerFit, clamp({ x: x0, y: lastY + (lastH - footerFit.h) / 2, w: footerW, h: footerFit.h })) : null;
    return { W, H, stacked, wordmark, logo, kicker, hello, headline, tiles, highlights, footer, pill, url: urlFit, bar };
}
/** What the geometry promises, label by label. */
function weeklyBriefContract(L) {
    const out = [];
    const fits = (label, fit) => {
        if (fit)
            out.push((0, layout_1.textFitsMeasured)(label, fit.lines.join("\n"), fit.px, fit.width));
    };
    if (!L.logo)
        fits("wordmark", L.wordmark.fit);
    fits("kicker", L.kicker?.fit);
    fits("hello", L.hello?.fit);
    fits("headline", L.headline.fit);
    L.tiles.forEach((t, i) => {
        fits(`metric-${i}-label`, t.label.fit);
        fits(`metric-${i}-value`, t.value.fit);
        fits(`metric-${i}-delta`, t.delta?.fit);
        fits(`metric-${i}-caption`, t.caption?.fit);
    });
    L.highlights.forEach((h, i) => {
        fits(`highlight-${i}`, h.text.fit);
        out.push({ label: `highlight-${i}-dot`, aspect: 1, aspectTolerance: 0.2 });
    });
    fits("footer", L.footer?.fit);
    fits("url", L.url);
    out.push({ label: L.logo ? "logo" : "wordmark", within: { yFrac: [0, 0.2] } });
    out.push({ label: "progress", minWidthFrac: 0.98, within: { yFrac: [0.9, 1] } });
    return out;
}
exports.WeeklyBriefV1 = (0, template_utils_1.defineMosaicTemplate)({
    id: (0, types_1.asTemplateId)(ID),
    capabilities: { tier: "core" },
    outputHints: {
        ...exports.BRIEF_PLATFORMS[DEFAULTS.platform],
        fps: 30,
        // The defaults carry one note, so the default clip is the board plus one stop.
        durationMs: plannedDurationMs({ durationSec: DEFAULTS.durationSec, metrics: DEFAULTS.metrics, highlights: DEFAULTS.highlights }),
        format: { kind: "video", container: "mp4" },
        note: "The canvas follows the platform knob (email 1920x1080 by default; chat is 720p, square and mobile put two tiles across); an explicit -w/-h wins. The board builds over durationSec; every tile with a note adds a stop (zoom in, read, move on), so the clip is as long as the notes need; an explicit --durationMs squeezes or holds it.",
    },
    // The canvas and the length are knobs: a host seeds its Device and Duration
    // fields from the props and re-seeds when they change. Never throws.
    // The clip is as long as the notes need: each stop gets reading time.
    resolveOutputHints: (props) => {
        const key = typeof props?.platform === "string" ? props.platform.trim().toLowerCase() : "";
        const dims = exports.BRIEF_PLATFORMS[(key in exports.BRIEF_PLATFORMS ? key : DEFAULTS.platform)];
        return { ...dims, durationMs: plannedDurationMs(props) };
    },
    propsSchema,
    defaultProps: {
        platform: DEFAULTS.platform,
        brandName: DEFAULTS.brandName,
        brandLogo: [],
        title: DEFAULTS.title,
        periodLabel: DEFAULTS.periodLabel,
        greeting: DEFAULTS.greeting,
        recipientName: DEFAULTS.recipientName,
        headline: DEFAULTS.headline,
        metrics: DEFAULTS.metrics.map((x) => ({ ...x, ...(x.series ? { series: [...x.series] } : {}) })),
        deltaLabel: DEFAULTS.deltaLabel,
        highlights: [...DEFAULTS.highlights],
        footer: DEFAULTS.footer,
        ctaUrl: DEFAULTS.ctaUrl,
        theme: DEFAULTS.theme,
        accent: DEFAULTS.accent,
        durationSec: DEFAULTS.durationSec,
        debugLayout: false,
    },
    // `background` is the document's own fill; `ink` and the length can carry a
    // handle and deliberately do not. `platform` and `theme` are closed sets.
    bindings: { unbound: { background: "canvas", ink: "theme", durationSec: "timing" } },
    render,
});
exports.default = exports.WeeklyBriefV1;
/* ── input: the schema is documentation, render() is the gate ── */
function numberOr(v, fallback, min, max) {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
/** undefined = the default, "" = removed. */
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
    if (!choices.includes(s)) {
        throw new Error(`${ID}: ${name} must be one of ${choices.join(", ")}. Got ${JSON.stringify(value)}.`);
    }
    return s;
}
/** An editor may deliver a json prop as a string; a row export may too. */
function pickJson(value, name) {
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        throw new Error(`${ID}: ${name} is not valid JSON.`);
    }
}
/** The trend a delta string implies: a leading "+" is up, "-" is down, else flat. */
function trendOfDelta(delta) {
    const s = delta.trim();
    if (/^\+/.test(s) && !/^\+0+(\.0+)?\s*(%|pts?)?$/.test(s))
        return "up";
    if (/^-/.test(s) && !/^-0+(\.0+)?\s*(%|pts?)?$/.test(s))
        return "down";
    return "flat";
}
/* ── the number, from the data ── */
// A declaration, not a const: the static outputHints call formatValue at module load, above this line.
function group(n, decimals) {
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
/** Compact figures the way a stat tile prints them: 1,284 / 12.9K / $4.2M / 41%. */
function formatValue(n, format, decimals = 0) {
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (format === "percent")
        return `${sign}${group(a, decimals)}%`;
    const prefix = format === "currency" ? "$" : "";
    if (a >= 1e9)
        return `${sign}${prefix}${group(a / 1e9, 1)}B`;
    if (a >= 1e6)
        return `${sign}${prefix}${group(a / 1e6, 1)}M`;
    if (a >= 1e4 || (format === "currency" && a >= 1e4))
        return `${sign}${prefix}${group(a / 1e3, a >= 1e5 ? 0 : 1)}K`;
    return `${sign}${prefix}${group(a, decimals)}`;
}
/** The y-range a sparkline line is drawn in: the series' own min..max plus a tenth of air each side (a flat series gets a unit). */
function lineDomain(series) {
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    const pad = hi - lo > 0 ? (hi - lo) * 0.1 : Math.max(1, Math.abs(hi) * 0.1);
    return { minValue: lo - pad, maxValue: hi + pad };
}
/** The last change: percentage points for a percent, else a signed percent of the previous point. */
function formatDelta(last, prev, format) {
    if (format === "percent") {
        const d = last - prev;
        return `${d > 0 ? "+" : d < 0 ? "-" : ""}${group(Math.abs(d), 1)} pts`;
    }
    if (prev === 0)
        return "";
    const d = ((last - prev) / Math.abs(prev)) * 100;
    return `${d > 0 ? "+" : d < 0 ? "-" : ""}${group(Math.abs(d), 1)}%`;
}
function normalizeMetric(raw, i) {
    if (!raw || typeof raw !== "object")
        throw new Error(`${ID}: metrics[${i}] must be an object.`);
    const m = raw;
    const at = `metrics[${i}]`;
    const label = pickText(m.label, "", `${at}.label`);
    if (!label)
        throw new Error(`${ID}: ${at}.label is required.`);
    const format = pickChoice(m.format, exports.BRIEF_FORMATS, "number", `${at}.format`);
    const decimals = pickInt(m.decimals, 0, 0, 4, `${at}.decimals`);
    let series = [];
    if (m.series !== undefined && m.series !== null) {
        if (!Array.isArray(m.series) || m.series.length < 1 || m.series.length > exports.BRIEF_MAX_POINTS) {
            throw new Error(`${ID}: ${at}.series must be an array of 1 to ${exports.BRIEF_MAX_POINTS} numbers.`);
        }
        series = m.series.map((v, j) => {
            const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
            if (typeof n !== "number" || !Number.isFinite(n))
                throw new Error(`${ID}: ${at}.series[${j}] must be a number.`);
            return n;
        });
    }
    if (m.upIsGood !== undefined && typeof m.upIsGood !== "boolean")
        throw new Error(`${ID}: ${at}.upIsGood must be true or false.`);
    const note = pickText(m.note, "", `${at}.note`);
    if (note.length > walkthrough_1.MAX_NOTE)
        throw new Error(`${ID}: ${at}.note is ${note.length} characters; keep a note to ${walkthrough_1.MAX_NOTE} so it fits two lines on the card.`);
    const givenValue = typeof m.value === "number" ? String(m.value) : pickText(m.value, "", `${at}.value`);
    const givenDelta = typeof m.delta === "number" ? `${m.delta > 0 ? "+" : ""}${m.delta}` : pickText(m.delta, "", `${at}.delta`);
    let value;
    let delta;
    if (series.length > 0) {
        // One source of truth: a number typed beside the data could contradict it.
        if (givenValue || givenDelta) {
            throw new Error(`${ID}: ${at} carries a series, so its value and delta come from the series - drop ${givenValue ? "value" : "delta"} (or drop the series for a one-off number).`);
        }
        value = formatValue(series[series.length - 1], format, decimals);
        delta = series.length > 1 ? formatDelta(series[series.length - 1], series[series.length - 2], format) : "";
    }
    else {
        if (!givenValue)
            throw new Error(`${ID}: ${at} needs a series, or a value for a one-off number.`);
        value = givenValue;
        delta = givenDelta;
    }
    return {
        label,
        value,
        delta,
        trend: trendOfDelta(delta),
        upIsGood: m.upIsGood !== false,
        series,
        chart: pickChoice(m.chart, exports.BRIEF_CHARTS, "line", `${at}.chart`),
        caption: pickText(m.caption, "", `${at}.caption`),
        note,
        index: i,
    };
}
function pickMetrics(value) {
    const v = pickJson(value, "metrics");
    if (v === undefined || v === null)
        return DEFAULTS.metrics.map((x, i) => normalizeMetric(x, i));
    if (!Array.isArray(v) || v.length < 1 || v.length > exports.BRIEF_MAX_METRICS) {
        throw new Error(`${ID}: metrics must be an array of 1 to ${exports.BRIEF_MAX_METRICS} metrics.`);
    }
    return v.map((x, i) => normalizeMetric(x, i));
}
function pickHighlights(value) {
    if (value === undefined || value === null)
        return [...DEFAULTS.highlights];
    if (!Array.isArray(value))
        throw new Error(`${ID}: highlights must be an array of up to ${exports.BRIEF_MAX_HIGHLIGHTS} lines.`);
    const rows = value.map((v, i) => pickText(v, "", `highlights[${i}]`)).filter((s) => s.length > 0);
    if (rows.length > exports.BRIEF_MAX_HIGHLIGHTS)
        throw new Error(`${ID}: highlights carries at most ${exports.BRIEF_MAX_HIGHLIGHTS} lines (got ${rows.length}).`);
    return rows;
}
/** A zero-or-one media prop: an array of path strings; more than one is an error. */
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
        layers: [
            {
                content: { kind: "literal", text: fit.lines.join("\n") },
                style: {
                    fontSize: fit.px,
                    fontColor: color,
                    ...(fit.face === "bold" ? { fontWeight: "bold" } : {}),
                    ...(fit.face === "italic" ? { fontStyle: "italic" } : {}),
                },
                placement: { hAlign, vAlign: "middle" },
            },
        ],
        ...(overlay ? { overlay } : {}),
        editor: { owner: "template" },
    }, label);
}
async function render(props, ctx) {
    const brandName = pickText(props.brandName, DEFAULTS.brandName, "brandName");
    if (!brandName)
        throw new Error(`${ID}: brandName is required - the brief is from someone.`);
    const headline = pickText(props.headline, DEFAULTS.headline, "headline");
    if (!headline)
        throw new Error(`${ID}: headline is required - the brief says one thing.`);
    const logoRef = pickMedia(props.brandLogo, "brandLogo");
    pickChoice(props.platform, exports.BRIEF_PLATFORM_KEYS, DEFAULTS.platform, "platform");
    const copy = {
        brandName,
        hasLogo: logoRef.length > 0,
        title: pickText(props.title, DEFAULTS.title, "title"),
        periodLabel: pickText(props.periodLabel, DEFAULTS.periodLabel, "periodLabel"),
        greeting: pickText(props.greeting, DEFAULTS.greeting, "greeting"),
        recipientName: pickText(props.recipientName, DEFAULTS.recipientName, "recipientName"),
        headline,
        metrics: pickMetrics(props.metrics),
        deltaLabel: pickText(props.deltaLabel, DEFAULTS.deltaLabel, "deltaLabel"),
        highlights: pickHighlights(props.highlights),
        footer: pickText(props.footer, DEFAULTS.footer, "footer"),
        ctaUrl: pickText(props.ctaUrl, DEFAULTS.ctaUrl, "ctaUrl"),
    };
    const theme = exports.BRIEF_THEME_COLORS[pickChoice(props.theme, exports.BRIEF_THEMES, DEFAULTS.theme, "theme")];
    const accent = pickColor(props.accent, DEFAULTS.accent, "accent");
    const bg = pickColor(props.background, theme.background, "background");
    const ink = pickColor(props.ink, theme.ink, "ink");
    const dim = mix(ink, bg, 0.6);
    const card = mix(ink, bg, 0.06);
    const good = exports.BRIEF_GOOD;
    const bad = exports.BRIEF_BAD;
    const assets = {};
    const logoId = logoRef ? (0, types_1.asAssetId)(ASSET_ID_RE.test(logoRef) ? logoRef : "brand-logo") : undefined;
    const logoKind = logoId ? mediaKindOf(ctx, String(logoId), logoRef) : "image";
    if (logoId)
        assets[logoId] = { kind: "file", path: logoRef, mediaType: logoKind };
    // Timing. The board builds at the pace the length knob sets; with notes the
    // walk is appended (the clip is as long as the notes need - see
    // resolveOutputHints). An explicit pin wins and BECOMES the clip: shorter
    // than planned squeezes the whole schedule through `S`; longer just holds.
    const baseSec = pickInt(props.durationSec, DEFAULTS.durationSec, exports.BRIEF_MIN_SEC, exports.BRIEF_MAX_SEC, "durationSec");
    const stops = noteStops(copy.metrics);
    const W = Math.max(1, Math.round(ctx.target.width));
    const H = Math.max(1, Math.round(ctx.target.height));
    const L = layoutWeeklyBrief(copy, W, H);
    const T = briefBeats(baseSec, L.tiles.length);
    const [cut1, cut2] = T.cuts;
    const plan = stops.length > 0 ? (0, walkthrough_1.planWalk)(buildSecOf(T, L.highlights.length), stops) : undefined;
    const plannedSec = plan ? plan.endSec : baseSec;
    const pinned = (0, template_utils_1.resolvePinnedDurationMs)(ctx);
    // Unpinned: the planned length to the tenth, exactly as the hint states it.
    const durationMs = pinned !== undefined ? Math.round(pinned) : Math.ceil(plannedSec * 10) * 100;
    const k = Math.min(1, durationMs / 1000 / plannedSec);
    const S = (sec) => round3(sec * k);
    const arrive = (startSec, step, kind = "slide-up") => (0, template_utils_1.entrance)({ kind, durationMs: S(T.rise) * 1000, atSec: S(startSec + step * T.stagger), ease: "easeOut" });
    /**
     * The board - everything the dashboard shows - at a canvas of its own:
     * 1x for the plain clip, MAX_ZOOM x under the camera, so a zoomed crop is
     * never an upscale. The progress line is frame chrome and only joins the
     * board when the board IS the frame.
     */
    const buildBoard = async (Wb, Hb, withBar) => {
        const L = layoutWeeklyBrief(copy, Wb, Hb);
        const pieces = [];
        const piece = (rect, importance, source) => pieces.push({ rect: { ...rect, importance }, source });
        // ── chrome ──
        if (L.logo && logoId) {
            piece(L.logo, 1, (0, template_utils_1.bindProp)((0, template_utils_1.tag)({
                type: "media",
                mediaType: logoKind,
                assetId: logoId,
                placement: { fit: "contain", hAlign: "left", vAlign: "middle" },
                ...(logoKind === "video" ? { loopMode: "loop", audio: { enabled: false } } : {}),
                editor: { owner: "template" },
            }, "logo"), "brandLogo", 0));
        }
        else {
            piece(L.wordmark.rect, 1, (0, template_utils_1.bindProps)(textSource(L.wordmark.fit, ink, "wordmark", undefined), [{ propKey: "brandName" }, { propKey: "brandLogo", index: 0 }]));
        }
        if (L.kicker)
            piece(L.kicker.rect, 1, (0, template_utils_1.bindProps)(textSource(L.kicker.fit, dim, "kicker", undefined, "right"), [{ propKey: "title" }, { propKey: "periodLabel" }, { propKey: "deltaLabel" }]));
        if (withBar)
            piece(L.bar, 1, (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { overlay: { xExpr: `-W*(1-min(1,t/${durationMs / 1000}))` } }), "progress"), "accent"));
        // ── hello: static from frame 0 ──
        if (L.hello)
            piece(L.hello.rect, 2, (0, template_utils_1.bindProps)(textSource(L.hello.fit, ink, "hello", undefined), [{ propKey: "recipientName" }, { propKey: "greeting" }]));
        piece(L.headline.rect, 2, (0, template_utils_1.bindProp)(textSource(L.headline.fit, dim, "headline", undefined), "headline"));
        // ── the numbers, one tile at a time ──
        // The nested charts read their colours from the upstream theme namespace:
        // every surface IS the tile, so a chart's own card and canvas vanish into it.
        const muted = mix(accent, card, 0.38);
        const chartTheme = {
            surfaceApp: card,
            surface: card,
            surfaceRaised: card,
            surfaceInset: card,
            border: card,
            borderStrong: card,
            textPrimary: ink,
            textSecondary: dim,
            textMuted: dim,
            eyebrow: dim,
            accent,
            accentSoft: muted,
            accentGlow: accent,
            positive: good,
            negative: bad,
            grid: dim,
            gridAlpha: 0,
            axis: dim,
            axisAlpha: 0,
            radius: 0,
            dataPalette: [accent],
        };
        const chartCtx = {
            ...ctx,
            upstreamData: { ...(ctx.upstreamData ?? {}), theme: { ...chartTheme } },
        };
        const children = {};
        for (const [i, t] of L.tiles.entries()) {
            const motion = arrive(cut1, i);
            const k = t.metric.index;
            const n = t.metric.series.length;
            // The card is the "add a note" handle: a note on a tile is a camera stop.
            piece(t.rect, 2, (0, template_utils_1.withBindingHint)((0, template_utils_1.bindPropPath)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(card, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.18 } }, overlay: motion }), `metric-${i}-card`), "metrics", [k, "note"], "string", { onClear: "unset-leaf" }), NOTE_HINT));
            piece(t.label.rect, 3, (0, template_utils_1.bindPropPath)(textSource(t.label.fit, dim, `metric-${i}-label`, motion), "metrics", [k, "label"], "string"));
            // With a series, the value IS its last point and the delta its last change:
            // the handles edit the data, and the number, the delta and the chart move together.
            const valueSrc = textSource(t.value.fit, ink, `metric-${i}-value`, motion);
            piece(t.value.rect, 3, n > 0
                ? (0, template_utils_1.withBindingHint)((0, template_utils_1.bindPropPath)(valueSrc, "metrics", [k, "series", n - 1], "number"), "The latest point of the series; the value, the delta and the chart follow it.")
                : (0, template_utils_1.bindPropPath)(valueSrc, "metrics", [k, "value"], "string"));
            if (t.delta) {
                // Direction x whether up is good; flat stays in the text colour. The sign carries it without colour.
                const tone = t.metric.trend === "flat" ? dim : (t.metric.trend === "up") === t.metric.upIsGood ? good : bad;
                const deltaSrc = textSource(t.delta.fit, tone, `metric-${i}-delta`, motion);
                piece(t.delta.rect, 3, n > 1
                    ? (0, template_utils_1.withBindingHint)((0, template_utils_1.bindPropPath)(deltaSrc, "metrics", [k, "series", n - 2], "number"), "The point before the latest; the delta compares the latest to it.")
                    : (0, template_utils_1.bindPropPath)(deltaSrc, "metrics", [k, "delta"], "string"));
            }
            if (t.chart) {
                // The real chart, nested in the slot, drawing itself in as the tile lands.
                const ref = `chart-${i}`;
                const introDelay = S(cut1 + i * T.stagger + T.rise * 0.5);
                const introDur = round3(Math.min(1.1, Math.max(0.4, (S(cut2) - introDelay) * 0.8)));
                const slot = { width: t.chart.w, height: t.chart.h, fps: ctx.target.fps, durationMs };
                const chartProps = t.metric.chart === "bars"
                    ? {
                        values: t.metric.series,
                        layout: { orientation: "vertical", gap: 0.18, padding: 2, cornerRadius: 0.3 },
                        appearance: { preset: "neutral", barColor: t.metric.series.map((_, j) => (j === n - 1 ? accent : muted)) },
                        grid: { show: false },
                        baseline: { show: false },
                        valueAxis: { show: false },
                        valueLabels: { show: false },
                        titles: {},
                        anim: { renderMode: "light", intro: { delaySec: introDelay, durationSec: introDur, staggerSec: round3(Math.min(0.06, introDur / Math.max(1, n))), ease: "smoothstep" }, reduceMotion: false },
                    }
                    : {
                        values: t.metric.series,
                        // A sparkline shows SHAPE: the domain is the data's own range (plus a
                        // tenth of air), never zero - a 34..41% series must not read as flat.
                        domain: lineDomain(t.metric.series),
                        line: { lineColor: accent, strokeWidth: 2, curve: "linear", lineCap: "round", lineJoin: "round", area: { show: true, color: accent, opacity: 0.1 } },
                        points: { showPoints: false },
                        // The chart's chrome child must draw at least one thing (an all-off
                        // chrome is an empty split and refuses); the x axis stays "on" in the
                        // tile's own colour, so nothing shows but the chart renders.
                        axes: {
                            xAxis: { show: true, color: card, showLabels: false, showTicks: false, showGrid: false },
                            yAxis: { show: false, showLabels: false, showTicks: false, showGrid: false },
                        },
                        appearance: { preset: "neutral", backgroundColor: "none", cornerRadius: 0, padding: 4, border: { alpha: 0 } },
                        legend: { show: false },
                        valueLabels: { show: false },
                        titles: {},
                        anim: { intro: { delaySec: introDelay, durationSec: introDur, staggerSec: 0, ease: "smoothstep" }, reduceMotion: false },
                    };
                const child = await (0, template_utils_1.renderNestedTemplate)(t.metric.chart === "bars" ? exports.BRIEF_BAR_GRAPH_ID : exports.BRIEF_LINE_CHART_ID, chartProps, chartCtx, { slot });
                if (child.kind !== "mosaic_document")
                    throw new Error(`${ID}: the nested chart for ${t.metric.label} did not return a document (${child.kind}).`);
                // The chart's own handles name ITS props; against this template's schema they are unknown.
                children[ref] = (0, template_utils_1.stripPropBindings)(child);
                piece(t.chart, 3, (0, template_utils_1.tag)({ type: "mosaic", ref, overlay: motion, editor: { owner: "template" } }, `metric-${i}-chart`));
            }
            if (t.caption)
                piece(t.caption.rect, 3, (0, template_utils_1.bindPropPath)(textSource(t.caption.fit, dim, `metric-${i}-caption`, motion), "metrics", [k, "caption"], "string"));
        }
        // ── so what: holds to the last frame ──
        L.highlights.forEach((h, i) => {
            const motion = arrive(cut2, i, "rise");
            piece(h.dot, 2, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { mask: { kind: "inline-mask", ...(0, dsl_stdlib_1.circleMask)(h.dot.w, h.dot.h) }, overlay: motion }), `highlight-${i}-dot`));
            piece(h.text.rect, 2, (0, template_utils_1.bindProp)(textSource(h.text.fit, ink, `highlight-${i}`, motion), "highlights", h.index));
        });
        const last = L.highlights.length;
        if (L.footer)
            piece(L.footer.rect, 2, (0, template_utils_1.bindProp)(textSource(L.footer.fit, dim, "footer", arrive(cut2, last, "rise")), "footer"));
        if (L.pill && L.url) {
            const motion = arrive(cut2, last, "fade");
            piece(L.pill, 2, (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { effects: { rounding: { cornerStyle: "pill" } }, overlay: motion }), "url-pill"));
            piece(L.pill, 3, (0, template_utils_1.bindProp)(textSource(L.url, onColor(accent, bg, ink), "url", motion, "center"), "ctaUrl"));
        }
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: Wb, rootH: Hb, pieces });
        return { L, m0: placed.m0, sources: placed.sources, children };
    };
    const label = `Weekly Brief - ${copy.brandName}${copy.periodLabel ? ` - ${copy.periodLabel}` : ""}`;
    if (!plan) {
        // ── The plain clip: the board IS the frame. ──
        const board = await buildBoard(W, H, true);
        const doc = {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)(board.m0, ID),
            assets,
            ...(Object.keys(board.children).length ? { children: board.children } : {}),
            size: { width: W, height: H },
            fps: ctx.target.fps,
            durationMs,
            backgroundColor: bg,
            sources: board.sources,
            editor: { label },
        };
        return (0, layout_1.withLayoutIntent)(doc, ctx, { templateId: ID, constraints: weeklyBriefContract(board.L), debug: props.debugLayout === true });
    }
    // ── The walkthrough: a camera over a supersampled board, and a note card per stop. ──
    // The board stops changing once it has built, so the child renders only the
    // build (+ a beat); a full-length HELD layer freezes its last frame and the
    // camera crops that. The freeze sits one level BELOW the camera: the engine
    // applies a source's effects before its playback, so both on one source
    // would freeze the camera too. (The pipeline-review pattern.)
    const SW = W * walkthrough_1.MAX_ZOOM;
    const SH = H * walkthrough_1.MAX_ZOOM;
    const board = await buildBoard(SW, SH, false);
    const buildMs = Math.ceil((S(plan.buildSec) + 0.6) * 1000);
    const dashboard = {
        kind: "mosaic_document",
        version: 1,
        m0: (0, dsl_stdlib_1.toM0String)(board.m0, `${ID}:dashboard`),
        assets,
        ...(Object.keys(board.children).length ? { children: board.children } : {}),
        // The camera's rects are in THIS space.
        size: { width: SW, height: SH },
        fps: ctx.target.fps,
        durationMs: Math.min(durationMs, buildMs),
        backgroundColor: bg,
        sources: board.sources,
    };
    const held = {
        kind: "mosaic_document",
        version: 1,
        m0: (0, dsl_stdlib_1.toM0String)("1", `${ID}:held`),
        assets: {},
        size: { width: SW, height: SH },
        fps: ctx.target.fps,
        durationMs,
        backgroundColor: bg,
        children: { dashboard },
        sources: [{ type: "mosaic", ref: "dashboard", placement: { fit: "contain" }, playback: { loopMode: "freeze" } }],
    };
    const tileRects = board.L.tiles.map((t) => t.rect);
    const camera = (0, walkthrough_1.walkCamera)(plan, tileRects, SW, SH, S);
    const pieces = [
        { rect: { x: 0, y: 0, w: W, h: H, importance: 0 }, source: { type: "mosaic", ref: "held", placement: { fit: "contain" }, effects: { camera } } },
    ];
    // Frame chrome stays un-zoomed: the progress line, and the note cards.
    const Sm = Math.min(W, H);
    const barH = Math.max(3, Math.round(0.006 * Sm));
    pieces.push({ rect: { x: 0, y: H - barH, w: W, h: barH, importance: 1 }, source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { overlay: { xExpr: `-W*(1-min(1,t/${durationMs / 1000}))` } }), "progress"), "accent") });
    const pad = Math.round(Sm * 0.022);
    // The card sits OVER the board: white on a light page, a raised step on a dark one.
    const cardFill = luminance(bg) > 0.5 ? "#ffffff" : mix(ink, bg, 0.12);
    const cardRects = (side) => {
        const cardR = { x: Math.round(W * 0.14), y: Math.round(H * walkthrough_1.NOTE_CARD[side].y), w: Math.round(W * 0.72), h: Math.round(H * walkthrough_1.NOTE_CARD[side].h) };
        return {
            cardR,
            barR: { x: cardR.x + pad, y: cardR.y + Math.round(cardR.h * 0.2), w: Math.max(3, Math.round(W * 0.0035)), h: Math.round(cardR.h * 0.6) },
            labelR: { x: cardR.x + pad * 2, y: cardR.y + Math.round(cardR.h * 0.1), w: cardR.w - pad * 3, h: Math.round(cardR.h * 0.26) },
            noteR: { x: cardR.x + pad * 2, y: cardR.y + Math.round(cardR.h * 0.38), w: cardR.w - pad * 3, h: Math.round(cardR.h * 0.54) },
        };
    };
    // One size for every note: the largest that fits the longest on two lines.
    const { noteR: noteBox } = cardRects("bottom");
    const notePx = Math.min(...plan.stops.map((s) => (0, text_1.fitText)(s.note, (0, text_1.budget)(noteBox.w), noteBox.h, Math.round(H * 0.03), 8, 2, "regular").px));
    plan.stops.forEach((s, i) => {
        const metric = copy.metrics[s.index];
        const { cardR, barR, labelR, noteR } = cardRects((0, walkthrough_1.frameOn)(tileRects[s.index], SW, SH).card);
        // Shown while the camera is settled, with a short fade either side.
        const a = S(s.arriveSec - 0.15);
        const b = S(s.leaveSec + 0.1);
        const alpha = (0, template_utils_1.keyframeExpr)([{ t: a, v: 0 }, { t: a + S(0.35), v: 1 }, { t: b - S(0.3), v: 1 }, { t: b, v: 0 }], { ease: "smoothstep" });
        const shown = (src) => ({ ...src, overlay: { alpha, enable: `between(t,${a},${b})`, window: { startSec: a, endSec: b } } });
        const labelFit = (0, text_1.fitText)(`${metric.label.toUpperCase()}   ${i + 1}/${plan.stops.length}`, (0, text_1.budget)(labelR.w), labelR.h, Math.round(H * 0.018), 7, 1, "bold");
        const noteFit = (0, text_1.fitText)(s.note, (0, text_1.budget)(noteR.w), noteR.h, notePx, 8, 2, "regular");
        pieces.push({ rect: { ...cardR, importance: 2 + 2 * i }, source: shown((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(cardFill, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.2 } } }), `note-${i}-card`)) });
        pieces.push({ rect: { ...barR, importance: 3 + 2 * i }, source: shown((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(accent, { effects: { rounding: { cornerStyle: "pill" } } }), `note-${i}-bar`)) });
        pieces.push({ rect: { ...labelR, importance: 3 + 2 * i }, source: shown(textSource(labelFit, accent, `note-${i}-label`, undefined)) });
        pieces.push({ rect: { ...noteR, importance: 3 + 2 * i }, source: shown((0, template_utils_1.withBindingHint)((0, template_utils_1.bindPropPath)(textSource(noteFit, ink, `note-${i}`, undefined), "metrics", [metric.index, "note"], "string", { onClear: "unset-leaf" }), NOTE_HINT)) });
    });
    const placed = (0, template_utils_1.placeInsetPieces)({ rootW: W, rootH: H, pieces });
    // No layout contract here: the board's frames live in the supersampled
    // child, under a camera - the plain clip carries the contract for the same geometry.
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
        editor: { label: `${label} - ${plan.stops.length} note${plan.stops.length === 1 ? "" : "s"}` },
    };
}
/** The planned second the board has finished building (every element landed). */
function buildSecOf(T, highlightCount) {
    return round3(T.cuts[1] + (highlightCount + 1) * T.stagger + T.rise + 0.6);
}
/** The noted tiles, in tile order - the camera stops. */
function noteStops(metrics) {
    return metrics.flatMap((m, index) => (m.note ? [{ index, note: m.note }] : []));
}
/**
 * The clip length the props ask for, in ms: the length knob, plus the walk
 * when any tile carries a note. Never throws (hosts call it per edit) - junk
 * props fall back to the knob.
 */
function plannedDurationMs(props) {
    const baseSec = numberOr(props?.durationSec, DEFAULTS.durationSec, exports.BRIEF_MIN_SEC, exports.BRIEF_MAX_SEC);
    try {
        const metrics = pickMetrics(props?.metrics);
        const highlights = pickHighlights(props?.highlights);
        const stops = noteStops(metrics);
        if (stops.length === 0)
            return baseSec * 1000;
        const T = briefBeats(baseSec, metrics.length);
        return Math.ceil((0, walkthrough_1.planWalk)(buildSecOf(T, highlights.length), stops).endSec * 10) * 100;
    }
    catch {
        return baseSec * 1000;
    }
}
