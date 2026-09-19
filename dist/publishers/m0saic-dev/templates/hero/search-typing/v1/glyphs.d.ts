/**
 * Cell-local source builders for the search-typing hero — the card, the
 * magnifier, the label chrome, and the word strips.
 *
 * Real-geometry contract (the Rect Thesis): every element is placed as a REAL
 * m0 cell by `placeInsetPieces` in search-typing.ts, so each builder here
 * authors its paths in the CELL'S OWN pixel space and sets the mask `bounds`
 * to the cell's exact w×h — `scaleX === scaleY === 1`, no distortion, and the
 * document carries selectable bounding boxes instead of an opaque overlay
 * stack of full-canvas sources.
 *
 * Arc policy (plan risk 4): the engine's mask rasterizer drops SVG arcs under
 * any temporal overlay — so the ONLY arc-bearing path is the card's rounded
 * rect, which is static forever. The magnifier ring is polygon circles
 * (outer wound one way, inner the opposite — the nonzero-fill hole idiom from
 * dsl-canvas's frameOutlineSource / alpine line-chart's circlePolyLocal), and
 * word strips are pure glyph outlines from textToPath.
 */
import type { MosaicColor, MosaicOverlayWindow, MosaicSource } from "@m0saic/types";
import type { SearchTypingUnderlineMode } from "./schema";
import type { PxRect, SearchBarLayout } from "./layout";
/** Polygon sides for the magnifier ring circles (arc-free, overlay-safe). */
export declare const RING_SIDES = 28;
/**
 * A circle as a many-sided polygon path. `reverse` flips the winding — pair a
 * forward outer with a reversed inner for a nonzero-fill ring hole (the
 * inline-mask rasterizer emits no fill-rule, so winding is the mechanism).
 */
export declare function circlePolyPath(cx: number, cy: number, radius: number, sides?: number, reverse?: boolean): string;
/**
 * Hand-authored polygon magnifier inside the icon square: ring (outer poly +
 * opposite-wound inner poly) plus a 45°-rotated handle quad, wound like the
 * outer so the ring∩handle overlap stays filled under nonzero winding.
 * Exactly 3 subpaths, all arc-free. Author against a LOCAL rect
 * ({x:0, y:0, w, h}) for a cell-local atlas.
 */
export declare function magnifierPaths(icon: PxRect): string[];
/**
 * The card cell: a REAL background fill — a plain color tile painting its
 * whole cell (the bar is authored on the SNAP_PX grid, so the cell IS the
 * visual card), with rounded corners via the engine's SVG `rounding` effect
 * (the page-skeleton idiom). No inline mask: the card's silhouette no longer
 * obscures the text masks in inspectors, and the template is now entirely
 * arc-free (the old mask carried the only SVG arcs).
 */
export declare function cardSource(layout: SearchBarLayout, cardColor: MosaicColor): MosaicSource;
/** The magnifier cell: the 3 polygon subpaths for the EXACT icon square,
 *  authored local to its (snapped) `cell`. */
export declare function magnifierSource(icon: PxRect, cell: PxRect, color: MosaicColor): MosaicSource;
/**
 * The label chrome cell: label glyphs + the static underline segment, joined
 * into ONE muted-color mask atlas local to `rect` (the label zone; widened by
 * the caller across the word zone in "static" underline mode). Returns null
 * when the cell would be empty.
 */
export declare function labelChromeSource(layout: SearchBarLayout, rect: PxRect, color: MosaicColor, opts: {
    underline: SearchTypingUnderlineMode;
}): MosaicSource | null;
/**
 * One static ink-colored svg-text strip per word, authored local to the
 * shared word `zone` cell — all sharing the layout's `wordX` origin (the same
 * origin `charAdvances` measured against — D5). `windows[k]`, when given,
 * becomes the strip's overlay window (R4: window every short-lived source);
 * attached by spread because makeColorTile's overlay opt does not carry
 * `window`.
 */
export declare function wordStripSources(layout: SearchBarLayout, zone: PxRect, inkColor: MosaicColor, windows?: (MosaicOverlayWindow | undefined)[]): MosaicSource[];
