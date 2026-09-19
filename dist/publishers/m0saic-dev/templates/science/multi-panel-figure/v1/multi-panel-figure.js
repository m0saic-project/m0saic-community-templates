"use strict";
/**
 * ============================================================================
 * @m0saic-dev/science/multi-panel-figure/v1 — reproducible multi-panel figures
 * ============================================================================
 *
 * Compose N image panels (exported plots, micrographs, screenshots) into a
 * labeled multi-panel scientific figure: real carved cells per panel, panel
 * letters (A/B/C… or custom), a caption rail, and an optional scale bar —
 * emitted as lossless PNG so the figure is byte-exact reproducible: the same
 * `.mosaic` + assets re-render to the identical file on any machine.
 *
 * Everything is real geometry (the Rect Thesis): panels, label strips, the
 * caption rail, and the scale bar are m0 cells with StableKeys; margins and
 * gutters are `-` null tiles the background shows through. Text is rendered
 * with the svg glyph rasterizer (bundled deterministic font — no host
 * fontconfig, no drawtext spawn), sized with `measureText` against that same
 * font: shrink-to-fit, ellipsis only when even the minimum font overflows.
 *
 * Intrinsic media checks come from `ctx.media` (the host probes before
 * render); the template performs no I/O. With no `sourceIds` it renders a
 * deterministic set of colored demo panels — the zero-setup preview.
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiPanelFigure = void 0;
exports.autoRowCounts = autoRowCounts;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
const layout_1 = require("./layout");
const demo_fixture_1 = require("./demo-fixture");
const TEMPLATE_ID = "@m0saic-dev/science/multi-panel-figure/v1";
const MAX_PANELS = 26; // one letter per panel
/** Hand-tuned page/ink duos (dark is retuned, not derived). */
const PRESETS = {
    light: { bg: "#ffffff", ink: "#16181d" },
    dark: { bg: "#101014", ink: "#e8e8ee" },
};
const DEFAULT_GUTTER = 0.015;
const DEFAULT_MARGIN = 0.045;
const DEFAULT_SCALE_BAR_FRAC = 0.25;
const DEFAULT_CAPTION = "Figure 1 · Multi-panel demo — drop in your exported plots.";
/** Blank-string color pickers mean "unset" — fall back to the preset. */
function pickColor(value, fallback) {
    const s = typeof value === "string" ? value.trim() : value;
    return s ? s : fallback;
}
const propsSchema = (0, template_utils_1.definePropsSchema)({
    sourceIds: {
        type: "media[]",
        required: true,
        description: "Panel images in reading order — exported plots, micrographs, screenshots. Empty renders a built-in demo set so you can preview the figure before adding panels.",
        meta: {
            ui: { label: "Panels", order: 1, primary: true },
            control: { multiple: true, picker: "folder", accept: ["image"] },
        },
    },
    rowCounts: {
        type: "number[]",
        required: false,
        description: "Panels per row, top to bottom — e.g. 3,2 puts three panels on the first row and two on the second. Must sum to the panel count. Empty picks an aspect-aware grid — more rows on a tall/mobile canvas, more columns on a wide one.",
        meta: {
            constraints: { minItems: 1, maxItems: 26 },
            ui: { label: "Panels per row", order: 2 },
        },
    },
    labels: {
        type: "boolean",
        required: false,
        description: "Show a letter above each panel (the A/B/C… of figure captions).",
        meta: { ui: { label: "Panel letters", order: 1 } },
    },
    labelCase: {
        type: "string",
        required: false,
        description: 'Letter style: "upper" renders A, B, C…; "lower" renders a, b, c…',
        meta: {
            constraints: { oneOf: ["upper", "lower"] },
            ui: { label: "Letter case", order: 2 },
        },
    },
    panelLabels: {
        type: "string[]",
        required: false,
        description: "Custom per-panel labels replacing the auto letters (one entry per panel; an empty entry skips that panel's label).",
        meta: {
            constraints: { maxItems: 26 },
            ui: { label: "Custom labels", order: 3 },
        },
    },
    caption: {
        type: "string",
        required: false,
        description: "Figure caption, rendered in a rail under the panels (single line — it shrinks to fit, then truncates). Empty removes the rail.",
        meta: { ui: { label: "Caption", order: 1 } },
    },
    scaleBarLabel: {
        type: "string",
        required: false,
        description: 'Scale-bar label, e.g. "100 µm" or "1 cm". Non-empty draws the bar in the footer rail.',
        meta: { control: { placeholder: "none" }, ui: { label: "Scale bar", order: 2 } },
    },
    scaleBarFrac: {
        type: "number",
        required: false,
        description: "Scale-bar length as a fraction of a first-row panel's width.",
        meta: {
            constraints: { min: 0.05, max: 1 },
            control: { flavor: "slider", step: 0.05 },
            ui: { label: "Scale-bar length", order: 3 },
        },
    },
    gutter: {
        type: "number",
        required: false,
        description: "Space between panels, as a fraction of the canvas short edge.",
        meta: {
            constraints: { min: 0, max: 0.1 },
            control: { flavor: "slider", step: 0.005 },
            ui: { label: "Gutter", order: 1 },
        },
    },
    margin: {
        type: "number",
        required: false,
        description: "Outer page margin, as a fraction of the canvas short edge.",
        meta: {
            constraints: { min: 0, max: 0.2 },
            control: { flavor: "slider", step: 0.005 },
            ui: { label: "Margin", order: 2 },
        },
    },
    panelFit: {
        type: "string",
        required: false,
        description: 'How each image fills its panel: "contain" letterboxes and never crops data (the scientific default); "cover" fills the cell and crops.',
        meta: {
            constraints: { oneOf: ["contain", "cover"] },
            ui: { label: "Panel fit", order: 3 },
        },
    },
    preset: {
        type: "string",
        required: false,
        description: 'Hand-tuned page/ink duo: "light" (print-like, default) or "dark".',
        meta: {
            constraints: { oneOf: ["light", "dark"] },
            ui: { label: "Preset", order: 1 },
        },
    },
    background: {
        type: "string",
        required: false,
        description: "Page color override (shows in margins, gutters and panel letterboxes).",
        meta: {
            constraints: { isColor: true },
            control: { placeholder: "preset background", colorPicker: true },
            ui: { label: "Background", order: 2 },
        },
    },
    ink: {
        type: "string",
        required: false,
        description: "Ink color override (panel letters, caption, scale bar).",
        meta: {
            constraints: { isColor: true },
            control: { placeholder: "preset ink", colorPicker: true },
            ui: { label: "Ink", order: 3 },
        },
    },
});
/**
 * Demo mode: six BUNDLED mock metric charts — real placeholders a user swaps
 * out via `sourceIds`. Falls back to deterministic colored panels when the
 * bundled assets aren't on disk (a stripped build).
 */
function demoInput(count, panelFit) {
    if (!demo_fixture_1.DEMO_CHARTS_AVAILABLE) {
        return {
            count,
            sourceFor: (i) => ({
                type: "lavfi",
                color: (0, demo_fixture_1.demoPanelColor)(i),
                editor: { owner: "template", label: `panel:${i}` },
            }),
            assetEntryFor: () => undefined,
        };
    }
    const n = demo_fixture_1.DEMO_CHART_PATHS.length;
    const idFor = (i) => `demo-chart-${i % n}`; // cycles if more panels asked
    return {
        count,
        sourceFor: (i) => ({
            type: "media",
            mediaType: "image",
            assetId: idFor(i),
            placement: { fit: panelFit },
            editor: { owner: "template", label: `panel:${i}` },
        }),
        assetEntryFor: (i) => [
            idFor(i),
            { kind: "file", path: demo_fixture_1.DEMO_CHART_PATHS[i % n], mediaType: "image" },
        ],
    };
}
/** Real mode: probed images from ctx.media, fail-fast on anything unusable. */
function mediaInput(sourceIds, panelFit, ctx) {
    const problems = [];
    const assetIds = [];
    const entries = [];
    // Keys are slugged from the basename, so panels exported to the same
    // filename in different folders (runA/plot.png, runB/plot.png) would
    // collide — uniqueAssetKey suffixes duplicates so every panel keeps its
    // own image.
    const seen = {};
    for (const id of sourceIds) {
        const meta = ctx.media[(0, types_1.asAssetId)(id)];
        if (!meta || !(meta.width > 0) || !(meta.height > 0)) {
            problems.push(`no probed dimensions for "${id}"`);
            continue;
        }
        if (meta.kind !== "image") {
            problems.push(`"${id}" is ${meta.kind ?? "unknown"} — figure panels must be images`);
            continue;
        }
        const entry = { kind: "file", path: id, mediaType: "image" };
        const assetId = String((0, template_utils_1.uniqueAssetKey)((0, template_utils_1.slugifyAssetKeyFromPath)(id), seen));
        seen[assetId] = entry;
        assetIds.push(assetId);
        entries.push([assetId, entry]);
    }
    if (problems.length > 0)
        return problems.join("; ");
    return {
        count: assetIds.length,
        sourceFor: (i) => ({
            type: "media",
            mediaType: "image",
            assetId: assetIds[i],
            placement: { fit: panelFit },
            editor: { owner: "template", label: `panel:${i}` },
        }),
        assetEntryFor: (i) => entries[i],
    };
}
/**
 * Aspect-aware default grid: columns track the canvas aspect, so a TALL
 * (mobile / portrait) canvas gets more rows + fewer columns and a WIDE canvas
 * gets more columns — `cols/rows ≈ W/H`, keeping cells roughly square. Earlier
 * rows take the remainder. Exported for tests.
 */
function autoRowCounts(count, W, H) {
    const aspect = W / Math.max(1, H);
    const cols = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * aspect))));
    const rows = Math.ceil(count / cols);
    const base = Math.floor(count / rows);
    const extra = count % rows;
    return Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0));
}
function autoLetters(count, letterCase) {
    const a = letterCase === "lower" ? 97 : 65;
    return Array.from({ length: count }, (_, i) => String.fromCharCode(a + i));
}
/** SVG-glyph text cell (bundled deterministic font; no drawtext spawn). */
function textCell(opts) {
    return {
        type: "text",
        rasterizer: "svg",
        renderMode: { kind: "image" },
        layers: [
            {
                content: { kind: "literal", text: opts.text },
                style: {
                    fontSize: opts.fontSize,
                    fontColor: opts.color,
                    ...(opts.bold ? { fontWeight: "bold" } : {}),
                },
                placement: { hAlign: "left", vAlign: opts.vAlign },
            },
        ],
        editor: { owner: "template", label: opts.label },
    };
}
exports.MultiPanelFigure = {
    id: (0, types_1.asTemplateId)(TEMPLATE_ID),
    label: "Multi-Panel Figure",
    version: 1,
    description: "Compose N image panels into a labeled multi-panel scientific figure — real carved cells per panel, A/B/C panel letters, caption rail, optional scale bar; lossless PNG output for byte-exact reproducibility.",
    capabilities: { tier: "core" },
    tags: ["data-viz", "science", "figure", "panels", "publication", "reproducible", "researchers", "academic", "paper", "journal"],
    outputHints: { width: 2400, height: 1800, format: { kind: "image", container: "png" } },
    propsSchema,
    defaultProps: {
        labels: true,
        labelCase: "upper",
        caption: DEFAULT_CAPTION,
        scaleBarFrac: DEFAULT_SCALE_BAR_FRAC,
        gutter: DEFAULT_GUTTER,
        margin: DEFAULT_MARGIN,
        panelFit: "contain",
        preset: "light",
    },
    async render(props, ctx) {
        const W = Math.max(1, Math.round(ctx.target.width));
        const H = Math.max(1, Math.round(ctx.target.height));
        const fail = (message) => (0, template_utils_1.makeErrorMosaic)(message, { title: "Multi-Panel Figure", width: W, height: H });
        // ── knobs ──
        const preset = props.preset === "dark" ? "dark" : "light";
        const duo = PRESETS[preset];
        const bg = pickColor(props.background, duo.bg);
        const ink = pickColor(props.ink, duo.ink);
        const gutterFrac = Math.min(0.1, Math.max(0, props.gutter ?? DEFAULT_GUTTER));
        const marginFrac = Math.min(0.2, Math.max(0, props.margin ?? DEFAULT_MARGIN));
        const panelFit = props.panelFit === "cover" ? "cover" : "contain";
        const showLabels = props.labels !== false;
        const letterCase = props.labelCase === "lower" ? "lower" : "upper";
        const caption = (props.caption ?? "").trim();
        const scaleBarLabel = (props.scaleBarLabel ?? "").trim();
        const scaleBarFrac = Math.min(1, Math.max(0.05, props.scaleBarFrac ?? DEFAULT_SCALE_BAR_FRAC));
        // ── inputs ──
        const ids = (props.sourceIds ?? []).map((s) => String(s).trim()).filter((s) => s.length > 0);
        const declaredRows = props.rowCounts;
        if (declaredRows != null) {
            if (declaredRows.length === 0)
                return fail("rowCounts must not be empty when provided");
            for (const n of declaredRows) {
                if (!Number.isInteger(n) || n < 1)
                    return fail(`rowCounts entries must be positive integers (got ${JSON.stringify(declaredRows)})`);
            }
        }
        let input;
        if (ids.length === 0) {
            // Demo mode sizes itself to rowCounts when given, so the layout knobs
            // are previewable without media.
            const demoCount = declaredRows ? declaredRows.reduce((a, b) => a + b, 0) : demo_fixture_1.DEMO_PANEL_COUNT;
            if (demoCount > MAX_PANELS)
                return fail(`at most ${MAX_PANELS} panels are supported (got ${demoCount})`);
            input = demoInput(demoCount, panelFit);
        }
        else {
            const resolved = mediaInput(ids, panelFit, ctx);
            if (typeof resolved === "string")
                return fail(resolved);
            input = resolved;
        }
        if (input.count > MAX_PANELS)
            return fail(`at most ${MAX_PANELS} panels are supported (got ${input.count})`);
        const rowCounts = declaredRows ?? autoRowCounts(input.count, W, H);
        const declaredCount = rowCounts.reduce((a, b) => a + b, 0);
        if (declaredCount !== input.count)
            return fail(`rowCounts sums to ${declaredCount} but there are ${input.count} panel(s)`);
        if (props.panelLabels != null && props.panelLabels.length !== input.count)
            return fail(`panelLabels has ${props.panelLabels.length} entries for ${input.count} panel(s)`);
        const panelLabels = showLabels
            ? props.panelLabels?.map((s) => String(s).trim()) ?? autoLetters(input.count, letterCase)
            : null;
        // ── source factory: one source per cell. Fed into the layout's
        //    inset-recovery packer, which returns them in the m0's frame order. ──
        const sourceForCell = (cell) => {
            switch (cell.kind) {
                case "panel":
                    return input.sourceFor(cell.panelIndex);
                case "label":
                    return textCell({
                        text: cell.text,
                        fontSize: cell.fontSize,
                        color: ink,
                        bold: true,
                        vAlign: "bottom",
                        label: `label:${cell.text}`,
                    });
                case "caption":
                    return textCell({
                        text: cell.text,
                        fontSize: cell.fontSize,
                        color: ink,
                        vAlign: "middle",
                        label: "caption",
                    });
                case "scalebar-bar":
                    return {
                        type: "lavfi",
                        color: ink,
                        editor: { owner: "template", label: "scalebar:bar" },
                    };
                case "scalebar-label":
                    return textCell({
                        text: cell.text,
                        fontSize: cell.fontSize,
                        color: ink,
                        vAlign: "middle",
                        label: "scalebar:label",
                    });
            }
        };
        // ── geometry + composed sources (ratio m0 + frame-ordered inset sources) ──
        let layout;
        try {
            layout = (0, layout_1.buildFigureLayout)({
                W,
                H,
                rowCounts,
                panelLabels,
                caption: caption.length > 0 ? caption : null,
                scaleBar: scaleBarLabel.length > 0 ? { label: scaleBarLabel, frac: scaleBarFrac } : null,
                marginFrac,
                gutterFrac,
            }, sourceForCell);
        }
        catch (e) {
            if (e instanceof layout_1.FigureLayoutError)
                return fail(e.message);
            throw e;
        }
        const sources = layout.sources;
        const assets = {};
        for (let i = 0; i < input.count; i++) {
            const entry = input.assetEntryFor(i);
            if (entry)
                assets[entry[0]] = entry[1];
        }
        return {
            kind: "mosaic_document",
            version: 1,
            assets,
            m0: layout.m0,
            sources,
            fps: ctx.target.fps,
            durationMs: ctx.target.durationMs,
            size: { width: W, height: H },
            backgroundColor: bg,
            editor: {
                label: `Multi-Panel Figure · ${input.count} panel${input.count === 1 ? "" : "s"} · ${rowCounts.join("+")} rows`,
            },
        };
    },
};
exports.default = exports.MultiPanelFigure;
