/**
 * Cell-local mask sources — every non-media element of the story is a flat
 * colour tile masked to a shape (the Rect Thesis: m0 owns the rect, SVG
 * draws the shape). Each builder authors its path in the CELL'S OWN pixel
 * space with `bounds` = the cell's exact w×h, so `scaleX === scaleY === 1`
 * and nothing distorts.
 *
 * Text is glyph OUTLINES from the bundled Roboto Bold (`textToPath`) — no
 * drawtext spawn, no system font, identical in the CLI and the app preview.
 * The sticker outline is the mask's `strokes` channel: the same outline
 * path stroked at 2·r with round joins IS the exact r-dilation of the
 * glyphs, so halo / stroke / fill are three colour tiles sharing one path.
 *
 * Arc policy (search-typing's finding): the mask rasterizer drops SVG arcs
 * under a temporal overlay, and everything here animates — so every curve
 * is a polygon (circles and rounded corners are many-sided), never an `A`.
 */
import type { MosaicOverlayExpr, MosaicSource } from "@m0saic/types";
import { type Rect, type TextLine } from "./layout";
import type { BadgeGlyph } from "./platforms";
/** Polygon sides for circles (arc-free). */
export declare const CIRCLE_SIDES = 32;
/** Segments per rounded corner (arc-free). */
export declare const CORNER_SEGMENTS = 8;
/**
 * A circle as a many-sided polygon. `reverse` flips the winding — pair a
 * forward outer with a reversed inner for a nonzero-fill ring hole (the mask
 * rasterizer emits no fill-rule, so winding is the mechanism).
 */
export declare function circlePolyPath(cx: number, cy: number, radius: number, sides?: number, reverse?: boolean): string;
/**
 * A rounded rectangle as a polygon (corners = `CORNER_SEGMENTS` chords).
 * `radius` clamps to the half-extents; 0 = a plain rect. Clockwise in screen
 * space; `reverse` for a hole.
 */
export declare function roundedRectPolyPath(x: number, y: number, w: number, h: number, radius: number, reverse?: boolean): string;
/** A plain rect subpath (clockwise). */
export declare function rectPath(x: number, y: number, w: number, h: number): string;
/** Glyph outlines of `line`, authored local to its cell, baseline pinned. */
export declare function linePath(line: TextLine): string;
/** A colour tile masked to `path` (optionally dilated by a round-joined stroke). */
export declare function maskTile(color: string, cell: Rect, path: string, opts?: {
    strokeWidth?: number;
    overlay?: MosaicOverlayExpr;
}): MosaicSource;
export type StickerColors = {
    fill: string;
    stroke: string;
    halo: string;
};
/**
 * The three stacked sources of a sticker line, bottom → top: the halo
 * (glyphs dilated by haloPx), the stroke (dilated by strokePx), the fill.
 * All three share one outline path and one overlay, so they move as one.
 */
export declare function stickerSources(line: TextLine, colors: StickerColors, overlay?: MosaicOverlayExpr): MosaicSource[];
/** A plain glyph line (no outline). */
export declare function plainTextSource(line: TextLine, color: string, overlay?: MosaicOverlayExpr): MosaicSource;
/** The boxed CTA's frame: four bars (a nonzero union, no winding games). */
export declare function frameSource(cell: Rect, strokePx: number, color: string, overlay?: MosaicOverlayExpr): MosaicSource;
/**
 * A down arrow at the TOP of its cell (the cell is taller by the bob
 * amplitude so the bob never leaves it): a shaft over a wide head.
 */
export declare function arrowPath(cellW: number, inkH: number): string;
export declare function arrowSource(cell: Rect, inkH: number, color: string, overlay?: MosaicOverlayExpr): MosaicSource;
/** The link pill body: a polygon stadium filling its cell. */
export declare function pillSource(cell: Rect, color: string, overlay?: MosaicOverlayExpr): MosaicSource;
/**
 * Chain-link glyph in a square cell: two diagonal rings joined by a bar.
 * Rings are forward outer + reversed inner (holes under nonzero); where the
 * rings overlap the union stays filled, which is what a chain link is.
 */
export declare function linkGlyphPath(size: number): string;
export declare function linkGlyphSource(cell: Rect, color: string, overlay?: MosaicOverlayExpr): MosaicSource;
/** The badge's white glyph path for `kind`, in a w×h cell (w:h ≈ 1.4). */
export declare function badgeGlyphPath(kind: Exclude<BadgeGlyph, "none">, w: number, h: number): string;
/**
 * The drawn badge, bottom → top: an accent-coloured rounded tile filling
 * the cell and the white glyph on it. Both carry the same overlay.
 */
export declare function badgeSources(cell: Rect, kind: Exclude<BadgeGlyph, "none">, accent: string, glyphColor: string, overlay?: MosaicOverlayExpr): MosaicSource[];
