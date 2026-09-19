/**
 * Figure geometry — every region of the figure is a REAL m0 cell.
 *
 * The canvas is carved with exact integer pixel weights (absolute drafting:
 * band weights ARE pixel sizes summing to the axis, so there is zero
 * quantization remainder at the emit canvas). Structure, top to bottom:
 *
 *   margin
 *   per panel-row: [label strip] + panel band, gutters between rows
 *   [gutter + footer rail]  (caption left, optional scale bar right)
 *   margin
 *
 * Margins and gutters are `-` null tiles (the document background shows
 * through) — never `placement.inset` tricks, never drawtext positioning.
 * Boundaries are rounded independently (`round(i/N · span)`), never summed
 * from rounded widths, so segments always total the axis exactly.
 *
 * Text fitting uses `measureText` against the SAME bundled font the svg
 * rasterizer draws with, so the fit is deterministic on every platform.
 */
import type { M0String } from "@m0saic/dsl";
import type { MosaicSource } from "@m0saic/types";
export type FigureRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** One paintable cell, in DSL paint order (the engine binds sources in this order). */
export type FigureCell = {
    kind: "panel";
    panelIndex: number;
    rect: FigureRect;
} | {
    kind: "label";
    panelIndex: number;
    text: string;
    fontSize: number;
    rect: FigureRect;
} | {
    kind: "caption";
    text: string;
    fontSize: number;
    rect: FigureRect;
} | {
    kind: "scalebar-bar";
    rect: FigureRect;
} | {
    kind: "scalebar-label";
    text: string;
    fontSize: number;
    rect: FigureRect;
};
export type FigureLayoutOptions = {
    W: number;
    H: number;
    /** Panels per row, top to bottom. Sum = total panel count. */
    rowCounts: number[];
    /** Per-panel label texts (empty string = no label cell for that panel), or null = labels off. */
    panelLabels: string[] | null;
    /** Figure caption (single line, shrink-to-fit then ellipsis), or null = off. */
    caption: string | null;
    /** Scale bar: label text + bar length as a fraction of a first-row panel's width. */
    scaleBar: {
        label: string;
        frac: number;
    } | null;
    /** Outer margin / inter-panel gutter as fractions of the canvas short edge. */
    marginFrac: number;
    gutterFrac: number;
};
export type FigureLayout = {
    m0: M0String;
    /** Sources in the m0's frame order, each carrying its recovery inset. */
    sources: MosaicSource[];
    /** Exact computed cell rects, in paint order (labels, panels, footer). */
    cells: FigureCell[];
};
/** Raised for inputs the geometry cannot honor (caller renders an error mosaic). */
export declare class FigureLayoutError extends Error {
}
export declare function buildFigureLayout(opts: FigureLayoutOptions, sourceForCell?: (cell: FigureCell) => MosaicSource): FigureLayout;
