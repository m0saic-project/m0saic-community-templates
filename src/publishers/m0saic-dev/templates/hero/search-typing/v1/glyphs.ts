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
import {
  makeColorTile,
  maskAtlasSource,
  roundedRectPathD,
  textToPath,
} from "@m0saic/template-utils";

import type { SearchTypingUnderlineMode } from "./schema";
import type { PxRect, SearchBarLayout } from "./layout";

/** Polygon sides for the magnifier ring circles (arc-free, overlay-safe). */
export const RING_SIDES = 28;
/** Ring center as a fraction of the icon square (glass sits upper-left). */
const RING_CENTER_FRAC = 0.42;
/** Outer ring radius as a fraction of the icon square. */
const RING_RADIUS_FRAC = 0.34;
/** Ring/handle pen thickness as a fraction of the icon square. */
const RING_STROKE_FRAC = 0.1;
/** Handle length from the ring center, as a fraction of the icon square. */
const HANDLE_LEN_FRAC = 0.66;

const r2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * A circle as a many-sided polygon path. `reverse` flips the winding — pair a
 * forward outer with a reversed inner for a nonzero-fill ring hole (the
 * inline-mask rasterizer emits no fill-rule, so winding is the mechanism).
 */
export function circlePolyPath(
  cx: number,
  cy: number,
  radius: number,
  sides = RING_SIDES,
  reverse = false,
): string {
  let d = "";
  for (let k = 0; k < sides; k++) {
    const step = reverse ? sides - k : k;
    const angle = (step / sides) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    d += `${k === 0 ? "M" : "L"} ${r2(x)} ${r2(y)} `;
  }
  return `${d}Z`;
}

/**
 * Hand-authored polygon magnifier inside the icon square: ring (outer poly +
 * opposite-wound inner poly) plus a 45°-rotated handle quad, wound like the
 * outer so the ring∩handle overlap stays filled under nonzero winding.
 * Exactly 3 subpaths, all arc-free. Author against a LOCAL rect
 * ({x:0, y:0, w, h}) for a cell-local atlas.
 */
export function magnifierPaths(icon: PxRect): string[] {
  const s = Math.min(icon.w, icon.h);
  const cx = icon.x + RING_CENTER_FRAC * s;
  const cy = icon.y + RING_CENTER_FRAC * s;
  const outerR = RING_RADIUS_FRAC * s;
  const stroke = Math.max(2, RING_STROKE_FRAC * s);
  const innerR = Math.max(0.5, outerR - stroke);

  const outer = circlePolyPath(cx, cy, outerR, RING_SIDES, false);
  const inner = circlePolyPath(cx, cy, innerR, RING_SIDES, true);

  // Handle: a stroke-wide quad from just inside the outer ring edge to the
  // icon's lower-right, along the 45° diagonal. 1px overlap into the ring
  // closes any anti-alias seam; the whole atlas is one silhouette anyway.
  const dir = Math.SQRT1_2; // cos45 == sin45
  const half = stroke / 2;
  const px = -dir * half;
  const py = dir * half;
  const ax = cx + dir * (outerR - 1);
  const ay = cy + dir * (outerR - 1);
  const bx = cx + dir * HANDLE_LEN_FRAC * s;
  const by = cy + dir * HANDLE_LEN_FRAC * s;
  const handle =
    `M ${r2(ax + px)} ${r2(ay + py)} ` +
    `L ${r2(ax - px)} ${r2(ay - py)} ` +
    `L ${r2(bx - px)} ${r2(by - py)} ` +
    `L ${r2(bx + px)} ${r2(by + py)} Z`;

  return [outer, inner, handle];
}

/**
 * The card cell: a REAL background fill — a plain color tile painting its
 * whole cell (the bar is authored on the SNAP_PX grid, so the cell IS the
 * visual card), with rounded corners via the engine's SVG `rounding` effect
 * (the page-skeleton idiom). No inline mask: the card's silhouette no longer
 * obscures the text masks in inspectors, and the template is now entirely
 * arc-free (the old mask carried the only SVG arcs).
 */
export function cardSource(layout: SearchBarLayout, cardColor: MosaicColor): MosaicSource {
  const { bar, cornerRadiusPx } = layout;
  const short = Math.min(bar.w, bar.h);
  const halfShort = Math.floor(short / 2);
  // Near-half radii become a true pill; otherwise the normalized rounded
  // contract (borderRadius = 2r/shortSide), always on the svg rasterizer.
  const rounding =
    cornerRadiusPx > 0 && cornerRadiusPx >= halfShort - 1
      ? ({ cornerStyle: "pill", rasterizer: "svg" } as const)
      : ({
          cornerStyle: "rounded",
          borderRadius: Math.max(0, Math.min(1, (2 * cornerRadiusPx) / short)),
          rasterizer: "svg",
        } as const);
  return makeColorTile(cardColor, { effects: { rounding } });
}

/** The magnifier cell: the 3 polygon subpaths for the EXACT icon square,
 *  authored local to its (snapped) `cell`. */
export function magnifierSource(
  icon: PxRect,
  cell: PxRect,
  color: MosaicColor,
): MosaicSource {
  return maskAtlasSource(
    magnifierPaths({ x: icon.x - cell.x, y: icon.y - cell.y, w: icon.w, h: icon.h }),
    color,
    { width: cell.w, height: cell.h },
  );
}

/**
 * Split a combined textToPath string into per-contour subpaths, so
 * maskAtlasSource's MASK_SUBPATH_BUDGET counts REAL contours — the mask
 * resolver's argv wall is per contour, not per array entry. Without this the
 * whole label counts as ONE entry and the budget throw can never fire.
 */
function splitContours(path: string): string[] {
  return path
    .split(/(?=M)/)
    .map((contour) => contour.trim())
    .filter(Boolean);
}

/** One-line glyph outlines at (x, baselineY) inside a cell-local canvas. */
function lineTextPath(
  text: string,
  x: number,
  baselineY: number,
  layout: SearchBarLayout,
  cell: { width: number; height: number },
): string {
  return textToPath(
    text,
    {
      fontSize: layout.fontSize,
      hAlign: "left",
      vAlign: "top",
      // vAlign "top" puts the baseline at padding.y + ascent — pin it exactly.
      padding: { x, y: baselineY - layout.ascent },
    },
    cell,
  );
}

/**
 * The label chrome cell: label glyphs + the static underline segment, joined
 * into ONE muted-color mask atlas local to `rect` (the label zone; widened by
 * the caller across the word zone in "static" underline mode). Returns null
 * when the cell would be empty.
 */
export function labelChromeSource(
  layout: SearchBarLayout,
  rect: PxRect,
  color: MosaicColor,
  opts: { underline: SearchTypingUnderlineMode },
): MosaicSource | null {
  const cell = { width: rect.w, height: rect.h };
  const paths: string[] = [];
  if (layout.labelText) {
    paths.push(
      ...splitContours(
        lineTextPath(layout.labelText, layout.labelX - rect.x, layout.baselineY - rect.y, layout, cell),
      ),
    );
  }
  if (opts.underline !== "none") {
    const x0 = layout.labelUnderline.x0;
    const x1 =
      opts.underline === "static"
        ? layout.wordX + layout.maxWordWidthPx
        : layout.labelUnderline.x1;
    const w = Math.round(x1 - x0);
    if (w >= 1) {
      paths.push(
        roundedRectPathD(
          Math.round(x0) - rect.x,
          layout.underlineY - rect.y,
          w,
          layout.underlineHeightPx,
          0,
        ),
      );
    }
  }
  const subpaths = paths.filter(Boolean);
  if (subpaths.length === 0) return null;
  return maskAtlasSource(subpaths, color, cell);
}

/**
 * One static ink-colored svg-text strip per word, authored local to the
 * shared word `zone` cell — all sharing the layout's `wordX` origin (the same
 * origin `charAdvances` measured against — D5). `windows[k]`, when given,
 * becomes the strip's overlay window (R4: window every short-lived source);
 * attached by spread because makeColorTile's overlay opt does not carry
 * `window`.
 */
export function wordStripSources(
  layout: SearchBarLayout,
  zone: PxRect,
  inkColor: MosaicColor,
  windows?: (MosaicOverlayWindow | undefined)[],
): MosaicSource[] {
  const cell = { width: zone.w, height: zone.h };
  return layout.words.map((entry, index) => {
    const source = makeColorTile(inkColor, {
      mask: {
        kind: "inline-mask",
        localPath: lineTextPath(
          entry.word,
          layout.wordX - zone.x,
          layout.baselineY - zone.y,
          layout,
          cell,
        ),
        bounds: { x: 0, y: 0, width: zone.w, height: zone.h },
      },
    });
    const window = windows?.[index];
    return window ? { ...source, overlay: { window } } : source;
  });
}
