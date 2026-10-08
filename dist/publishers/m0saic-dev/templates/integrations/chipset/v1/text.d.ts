/**
 * Measured text for the chipset card (copied from docker/build-digest/v1 so
 * each template freezes on its own bytes): the svg
 * rasterizer never wraps or shrinks text, so every string is fitted here
 * against the bundled font (the BOLD file when drawn bold — the regular
 * metrics under-measure bold copy) and handed over pre-wrapped.
 */
import type { MosaicColor, MosaicOverlayExpr, MosaicSource } from "@m0saic/types";
export type Fit = {
    text: string;
    fontSize: number;
    width: number;
    height: number;
    lines: number;
};
/**
 * Largest size whose greedy wrap fits the box in at most `maxLines`, then
 * balanced (narrowest width keeping the line count, so no widows). When
 * nothing fits at the floor the copy is still wrapped at the floor.
 */
export declare function fitCopy(text: string, boxW: number, boxH: number, opts: {
    maxPx: number;
    maxLines: number;
    bold?: boolean;
}): Fit;
/** One svg-rasterized text cell: bundled font, no drawtext, aligned inside its rect. */
export declare function textCell(opts: {
    fit: Fit;
    color: MosaicColor;
    hAlign: "left" | "right" | "center";
    vAlign?: "top" | "middle" | "bottom";
    bold?: boolean;
    label: string;
    overlay?: MosaicOverlayExpr;
}): MosaicSource;
