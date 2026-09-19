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
import type { MosaicColor, MosaicTemplate } from "@m0saic/types";
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
/**
 * Aspect-aware default grid: columns track the canvas aspect, so a TALL
 * (mobile / portrait) canvas gets more rows + fewer columns and a WIDE canvas
 * gets more columns — `cols/rows ≈ W/H`, keeping cells roughly square. Earlier
 * rows take the remainder. Exported for tests.
 */
export declare function autoRowCounts(count: number, W: number, H: number): number[];
export declare const MultiPanelFigure: MosaicTemplate<MultiPanelFigureProps>;
export default MultiPanelFigure;
