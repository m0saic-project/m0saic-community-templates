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

import type {
  MosaicAssetManifest,
  MosaicColor,
  MosaicDocument,
  MosaicEngineContext,
  MosaicRenderableFile,
  MosaicSource,
  MosaicTemplate,
} from "@m0saic/types";
import { asAssetId, asTemplateId } from "@m0saic/types";
import {
  definePropsSchema,
  makeErrorMosaic,
  slugifyAssetKeyFromPath,
  uniqueAssetKey,
} from "@m0saic/template-utils";
import { buildFigureLayout, FigureLayoutError, type FigureCell } from "./layout";
import {
  DEMO_CHART_PATHS,
  DEMO_CHARTS_AVAILABLE,
  DEMO_PANEL_COUNT,
  demoPanelColor,
} from "./demo-fixture";

export type MultiPanelFigureProps = {
  /** The panel images, in reading order — files or a folder (the host expands folders). */
  sourceIds?: string[];
  /** Panels per row, top to bottom (e.g. [3, 2]). Must sum to the panel count. Default: near-square. */
  rowCounts?: number[];
  /** Show panel letters above each panel. Default true. */
  labels?: boolean;
  /** Auto-letter case: "upper" = A, B, C…; "lower" = a, b, c…. Default "upper". */
  labelCase?: "upper" | "lower";
  /** Custom per-panel labels (override the auto letters; "" skips that panel's label). */
  panelLabels?: string[];
  /** Figure caption, rendered in a rail under the panels. Empty = no caption rail. */
  caption?: string;
  /** Scale-bar label (e.g. "100 µm"). Non-empty turns the scale bar on. */
  scaleBarLabel?: string;
  /** Scale-bar length as a fraction of a first-row panel's width. Default 0.25. */
  scaleBarFrac?: number;
  /** Space between panels, as a fraction of the canvas short edge. Default 0.015. */
  gutter?: number;
  /** Outer margin, as a fraction of the canvas short edge. Default 0.045. */
  margin?: number;
  /** How each image fills its panel: "contain" never crops data; "cover" fills the cell. Default "contain". */
  panelFit?: "contain" | "cover";
  /** Hand-tuned background/ink duo. Default "light" (print-like). */
  preset?: "light" | "dark";
  /** Background override (page color; shows in margins, gutters and letterboxes). */
  background?: MosaicColor;
  /** Ink override (panel letters, caption, scale bar). */
  ink?: MosaicColor;
};

const TEMPLATE_ID = "@m0saic-dev/science/multi-panel-figure/v1";
const MAX_PANELS = 26; // one letter per panel

/** Hand-tuned page/ink duos (dark is retuned, not derived). */
const PRESETS: Record<"light" | "dark", { bg: MosaicColor; ink: MosaicColor }> = {
  light: { bg: "#ffffff" as MosaicColor, ink: "#16181d" as MosaicColor },
  dark: { bg: "#101014" as MosaicColor, ink: "#e8e8ee" as MosaicColor },
};

const DEFAULT_GUTTER = 0.015;
const DEFAULT_MARGIN = 0.045;
const DEFAULT_SCALE_BAR_FRAC = 0.25;
const DEFAULT_CAPTION = "Figure 1 · Multi-panel demo — drop in your exported plots.";

/** Blank-string color pickers mean "unset" — fall back to the preset. */
function pickColor(value: MosaicColor | undefined, fallback: MosaicColor): MosaicColor {
  const s = typeof value === "string" ? value.trim() : value;
  return s ? (s as MosaicColor) : fallback;
}

const propsSchema = definePropsSchema<MultiPanelFigureProps>({
  sourceIds: {
    type: "media[]",
    required: true,
    description:
      "Panel images in reading order — exported plots, micrographs, screenshots. Empty renders a built-in demo set so you can preview the figure before adding panels.",
    meta: {
      ui: { label: "Panels", order: 1, primary: true },
      control: { multiple: true, picker: "folder", accept: ["image"] },
    },
  },
  rowCounts: {
    type: "number[]",
    required: false,
    description:
      "Panels per row, top to bottom — e.g. 3,2 puts three panels on the first row and two on the second. Must sum to the panel count. Empty picks an aspect-aware grid — more rows on a tall/mobile canvas, more columns on a wide one.",
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
    description:
      "Custom per-panel labels replacing the auto letters (one entry per panel; an empty entry skips that panel's label).",
    meta: {
      constraints: { maxItems: 26 },
      ui: { label: "Custom labels", order: 3 },
    },
  },
  caption: {
    type: "string",
    required: false,
    description:
      "Figure caption, rendered in a rail under the panels (single line — it shrinks to fit, then truncates). Empty removes the rail.",
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
    description:
      'How each image fills its panel: "contain" letterboxes and never crops data (the scientific default); "cover" fills the cell and crops.',
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

type ResolvedInput = {
  count: number;
  /** Source for panel index i (placement is the shell's job). */
  sourceFor: (panelIndex: number) => MosaicSource;
  /** Asset manifest entry for panel index i (undefined in demo mode). */
  assetEntryFor: (panelIndex: number) => [string, MosaicAssetManifest[keyof MosaicAssetManifest]] | undefined;
};

/**
 * Demo mode: six BUNDLED mock metric charts — real placeholders a user swaps
 * out via `sourceIds`. Falls back to deterministic colored panels when the
 * bundled assets aren't on disk (a stripped build).
 */
function demoInput(count: number, panelFit: "contain" | "cover"): ResolvedInput {
  if (!DEMO_CHARTS_AVAILABLE) {
    return {
      count,
      sourceFor: (i) =>
        ({
          type: "lavfi",
          color: demoPanelColor(i),
          editor: { owner: "template", label: `panel:${i}` },
        } as unknown as MosaicSource),
      assetEntryFor: () => undefined,
    };
  }
  const n = DEMO_CHART_PATHS.length;
  const idFor = (i: number) => `demo-chart-${i % n}`; // cycles if more panels asked
  return {
    count,
    sourceFor: (i) =>
      ({
        type: "media",
        mediaType: "image",
        assetId: idFor(i),
        placement: { fit: panelFit },
        editor: { owner: "template", label: `panel:${i}` },
      } as unknown as MosaicSource),
    assetEntryFor: (i) =>
      [
        idFor(i),
        { kind: "file", path: DEMO_CHART_PATHS[i % n], mediaType: "image" },
      ] as unknown as [string, MosaicAssetManifest[keyof MosaicAssetManifest]],
  };
}

/** Real mode: probed images from ctx.media, fail-fast on anything unusable. */
function mediaInput(
  sourceIds: string[],
  panelFit: "contain" | "cover",
  ctx: MosaicEngineContext,
): ResolvedInput | string {
  const problems: string[] = [];
  const assetIds: string[] = [];
  const entries: Array<[string, { kind: "file"; path: string; mediaType: "image" }]> = [];
  // Keys are slugged from the basename, so panels exported to the same
  // filename in different folders (runA/plot.png, runB/plot.png) would
  // collide — uniqueAssetKey suffixes duplicates so every panel keeps its
  // own image.
  const seen = {} as MosaicAssetManifest;
  for (const id of sourceIds) {
    const meta = ctx.media[asAssetId(id)];
    if (!meta || !(meta.width > 0) || !(meta.height > 0)) {
      problems.push(`no probed dimensions for "${id}"`);
      continue;
    }
    if (meta.kind !== "image") {
      problems.push(`"${id}" is ${meta.kind ?? "unknown"} — figure panels must be images`);
      continue;
    }
    const entry = { kind: "file", path: id, mediaType: "image" } as const;
    const assetId = String(uniqueAssetKey(slugifyAssetKeyFromPath(id), seen));
    (seen as Record<string, unknown>)[assetId] = entry;
    assetIds.push(assetId);
    entries.push([assetId, entry]);
  }
  if (problems.length > 0) return problems.join("; ");
  return {
    count: assetIds.length,
    sourceFor: (i) =>
      ({
        type: "media",
        mediaType: "image",
        assetId: assetIds[i],
        placement: { fit: panelFit },
        editor: { owner: "template", label: `panel:${i}` },
      } as unknown as MosaicSource),
    assetEntryFor: (i) => entries[i] as unknown as [string, MosaicAssetManifest[keyof MosaicAssetManifest]],
  };
}

/**
 * Aspect-aware default grid: columns track the canvas aspect, so a TALL
 * (mobile / portrait) canvas gets more rows + fewer columns and a WIDE canvas
 * gets more columns — `cols/rows ≈ W/H`, keeping cells roughly square. Earlier
 * rows take the remainder. Exported for tests.
 */
export function autoRowCounts(count: number, W: number, H: number): number[] {
  const aspect = W / Math.max(1, H);
  const cols = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * aspect))));
  const rows = Math.ceil(count / cols);
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0));
}

function autoLetters(count: number, letterCase: "upper" | "lower"): string[] {
  const a = letterCase === "lower" ? 97 : 65;
  return Array.from({ length: count }, (_, i) => String.fromCharCode(a + i));
}

/** SVG-glyph text cell (bundled deterministic font; no drawtext spawn). */
function textCell(opts: {
  text: string;
  fontSize: number;
  color: MosaicColor;
  bold?: boolean;
  vAlign: "middle" | "bottom";
  label: string;
}): MosaicSource {
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
          ...(opts.bold ? { fontWeight: "bold" as const } : {}),
        },
        placement: { hAlign: "left" as const, vAlign: opts.vAlign },
      },
    ],
    editor: { owner: "template", label: opts.label },
  } as unknown as MosaicSource;
}

export const MultiPanelFigure: MosaicTemplate<MultiPanelFigureProps> = {
  id: asTemplateId(TEMPLATE_ID),
  label: "Multi-Panel Figure",
  version: 1,
  description:
    "Compose N image panels into a labeled multi-panel scientific figure — real carved cells per panel, A/B/C panel letters, caption rail, optional scale bar; lossless PNG output for byte-exact reproducibility.",
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

  async render(props: MultiPanelFigureProps, ctx: MosaicEngineContext): Promise<MosaicRenderableFile> {
    const W = Math.max(1, Math.round(ctx.target.width));
    const H = Math.max(1, Math.round(ctx.target.height));
    const fail = (message: string): MosaicDocument =>
      makeErrorMosaic(message, { title: "Multi-Panel Figure", width: W, height: H });

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
      if (declaredRows.length === 0) return fail("rowCounts must not be empty when provided");
      for (const n of declaredRows) {
        if (!Number.isInteger(n) || n < 1)
          return fail(`rowCounts entries must be positive integers (got ${JSON.stringify(declaredRows)})`);
      }
    }
    let input: ResolvedInput;
    if (ids.length === 0) {
      // Demo mode sizes itself to rowCounts when given, so the layout knobs
      // are previewable without media.
      const demoCount = declaredRows ? declaredRows.reduce((a, b) => a + b, 0) : DEMO_PANEL_COUNT;
      if (demoCount > MAX_PANELS) return fail(`at most ${MAX_PANELS} panels are supported (got ${demoCount})`);
      input = demoInput(demoCount, panelFit);
    } else {
      const resolved = mediaInput(ids, panelFit, ctx);
      if (typeof resolved === "string") return fail(resolved);
      input = resolved;
    }
    if (input.count > MAX_PANELS) return fail(`at most ${MAX_PANELS} panels are supported (got ${input.count})`);

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
    const sourceForCell = (cell: FigureCell): MosaicSource => {
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
          } as unknown as MosaicSource;
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
      layout = buildFigureLayout(
        {
          W,
          H,
          rowCounts,
          panelLabels,
          caption: caption.length > 0 ? caption : null,
          scaleBar: scaleBarLabel.length > 0 ? { label: scaleBarLabel, frac: scaleBarFrac } : null,
          marginFrac,
          gutterFrac,
        },
        sourceForCell,
      );
    } catch (e) {
      if (e instanceof FigureLayoutError) return fail(e.message);
      throw e;
    }
    const sources = layout.sources;

    const assets: MosaicAssetManifest = {} as MosaicAssetManifest;
    for (let i = 0; i < input.count; i++) {
      const entry = input.assetEntryFor(i);
      if (entry) (assets as Record<string, unknown>)[entry[0]] = entry[1];
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

export default MultiPanelFigure;
