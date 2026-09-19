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
import { measureText, placeInsetPieces, type InsetPiece } from "@m0saic/template-utils";

export type FigureRect = { x: number; y: number; w: number; h: number };

/** One paintable cell, in DSL paint order (the engine binds sources in this order). */
export type FigureCell =
  | { kind: "panel"; panelIndex: number; rect: FigureRect }
  | { kind: "label"; panelIndex: number; text: string; fontSize: number; rect: FigureRect }
  | { kind: "caption"; text: string; fontSize: number; rect: FigureRect }
  | { kind: "scalebar-bar"; rect: FigureRect }
  | { kind: "scalebar-label"; text: string; fontSize: number; rect: FigureRect };

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
  scaleBar: { label: string; frac: number } | null;
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
export class FigureLayoutError extends Error {}

const MIN_PANEL_PX = 12;
const MIN_LABEL_PX = 8;
const MIN_FONT_PX = 8;

/** Coarse lattice basis — the precision floor for the composable (ratio) m0. */
const INSET_BASIS = 120;

/** Fallback source for callers that only need the geometry (e.g. tests). */
function stubSource(): MosaicSource {
  return { type: "lavfi", color: "#808080" } as unknown as MosaicSource;
}

/** Boundary-rounded partition of `span` into `n` equal parts (sums exactly). */
function partition(span: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(((i + 1) * span) / n) - Math.round((i * span) / n));
  return out;
}

/** Largest fontSize ≤ `maxFont` whose rendered width fits `boxW`; text width scales linearly. */
function fitFontToWidth(text: string, boxW: number, maxFont: number): number {
  const m = measureText(text, { fontSize: 100 });
  if (!(m.width > 0)) return maxFont;
  return Math.max(MIN_FONT_PX, Math.min(maxFont, Math.floor((100 * boxW) / m.width)));
}

/** Shrink-to-fit a single line; ellipsis-truncate only when even the min font overflows. */
function fitSingleLine(text: string, boxW: number, boxH: number): { text: string; fontSize: number } {
  const maxFont = Math.max(MIN_FONT_PX, Math.min(64, Math.floor(boxH * 0.52)));
  const usableW = Math.floor(boxW * 0.98);
  const fontSize = fitFontToWidth(text, usableW, maxFont);
  if (measureText(text, { fontSize }).width <= usableW) return { text, fontSize };
  // Even MIN_FONT_PX overflows — binary-search the longest prefix that fits with an ellipsis.
  let lo = 1;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}…`;
    if (measureText(candidate, { fontSize: MIN_FONT_PX }).width <= usableW) lo = mid;
    else hi = mid - 1;
  }
  return { text: `${text.slice(0, lo).trimEnd()}…`, fontSize: MIN_FONT_PX };
}

export function buildFigureLayout(
  opts: FigureLayoutOptions,
  sourceForCell: (cell: FigureCell) => MosaicSource = stubSource,
): FigureLayout {
  const { W, H, rowCounts, panelLabels, caption, scaleBar } = opts;
  const nRows = rowCounts.length;
  const nPanels = rowCounts.reduce((a, b) => a + b, 0);
  if (nRows === 0 || nPanels === 0) throw new FigureLayoutError("at least one panel is required");
  if (panelLabels && panelLabels.length !== nPanels)
    throw new FigureLayoutError(
      `panelLabels has ${panelLabels.length} entries for ${nPanels} panels — lengths must match`,
    );

  const S = Math.min(W, H);
  const margin = Math.max(0, Math.round(opts.marginFrac * S));
  const gutter = Math.max(0, Math.round(opts.gutterFrac * S));

  // ── vertical plan ──
  const hasFooter = caption != null || scaleBar != null;
  const footerH = hasFooter ? Math.min(Math.max(14, Math.round(S * 0.06)), Math.floor(H * 0.15)) : 0;
  const rowsAreaH = H - 2 * margin - (hasFooter ? footerH + gutter : 0) - (nRows - 1) * gutter;
  if (rowsAreaH < nRows * MIN_PANEL_PX)
    throw new FigureLayoutError(
      `canvas ${W}×${H} is too small for ${nRows} row(s) at these margins — panels would drop below ${MIN_PANEL_PX}px`,
    );
  const bandHs = partition(rowsAreaH, nRows);
  const showLabels = panelLabels != null;
  const labelH = showLabels
    ? Math.min(Math.max(MIN_LABEL_PX, Math.round(S * 0.045)), Math.floor(Math.min(...bandHs) * 0.32))
    : 0;
  if (showLabels && labelH < MIN_LABEL_PX)
    throw new FigureLayoutError(`canvas ${W}×${H} is too small for panel labels — disable labels or enlarge`);
  if (showLabels && Math.min(...bandHs) - labelH < MIN_PANEL_PX)
    throw new FigureLayoutError(`canvas ${W}×${H} leaves panels under ${MIN_PANEL_PX}px after label strips`);

  // ── horizontal plan per row ──
  const interiorW = W - 2 * margin;
  const rowXs: number[][] = [];
  const rowWs: number[][] = [];
  for (const n of rowCounts) {
    const panelSpace = interiorW - (n - 1) * gutter;
    if (panelSpace < n * MIN_PANEL_PX)
      throw new FigureLayoutError(
        `canvas ${W}×${H} is too small for a ${n}-panel row — panels would drop below ${MIN_PANEL_PX}px`,
      );
    const ws = partition(panelSpace, n);
    const xs: number[] = [];
    let x = margin;
    for (let i = 0; i < n; i++) {
      xs.push(x);
      x += ws[i] + gutter;
    }
    rowXs.push(xs);
    rowWs.push(ws);
  }

  const cells: FigureCell[] = [];
  const labelFont = Math.max(MIN_FONT_PX, Math.round(labelH * 0.72));

  let panelIndex = 0;
  let y = margin;
  for (let r = 0; r < nRows; r++) {
    const n = rowCounts[r];
    const panelH = bandHs[r] - labelH;
    const first = panelIndex;

    if (showLabels) {
      for (let i = 0; i < n; i++) {
        const text = panelLabels[first + i] ?? "";
        if (text)
          cells.push({
            kind: "label",
            panelIndex: first + i,
            text,
            fontSize: labelFont,
            rect: { x: rowXs[r][i], y, w: rowWs[r][i], h: labelH },
          });
      }
      y += labelH;
    }

    for (let i = 0; i < n; i++) {
      cells.push({
        kind: "panel",
        panelIndex: first + i,
        rect: { x: rowXs[r][i], y, w: rowWs[r][i], h: panelH },
      });
    }
    y += panelH;

    if (r < nRows - 1) y += gutter;
    panelIndex += n;
  }

  // ── footer rail: caption (left) + optional scale bar (right) ──
  if (hasFooter) {
    y += gutter;
    const footerCells: FigureCell[] = [];

    let scaleBlockW = 0;
    if (scaleBar) {
      const scaleFont = fitFontToWidth(
        scaleBar.label,
        Math.floor(interiorW * 0.4),
        Math.max(MIN_FONT_PX, Math.min(64, Math.floor(footerH * 0.5))),
      );
      const barW = Math.max(4, Math.round(scaleBar.frac * rowWs[0][0]));
      const labelW = Math.ceil(measureText(scaleBar.label, { fontSize: scaleFont }).width * 1.08);
      const gapSmall = Math.max(4, Math.round(gutter / 2));
      scaleBlockW = barW + gapSmall + labelW;
      const barH = Math.max(2, Math.round(footerH * 0.16));
      const padTop = Math.floor((footerH - barH) / 2);
      const x0 = margin + interiorW - scaleBlockW;
      footerCells.push(
        { kind: "scalebar-bar", rect: { x: x0, y: y + padTop, w: barW, h: barH } },
        {
          kind: "scalebar-label",
          text: scaleBar.label,
          fontSize: scaleFont,
          rect: { x: x0 + barW + gapSmall, y, w: labelW, h: footerH },
        },
      );
    }

    const captionW = interiorW - (scaleBar ? scaleBlockW + gutter : 0);
    // Guard both footer shapes: a negative caption width means the scale bar
    // (or its label) overflowed the rail. Caption-less, the left space is just
    // background (null tiles) between the margin and the scale bar.
    if (captionW < (caption != null ? 20 : 0))
      throw new FigureLayoutError(
        caption != null
          ? `no room for the caption next to the scale bar on a ${W}×${H} canvas`
          : `the scale bar does not fit on a ${W}×${H} canvas — shorten its label or lower scaleBarFrac`,
      );
    if (caption != null) {
      const fitted = fitSingleLine(caption, captionW, footerH);
      cells.push({
        kind: "caption",
        text: fitted.text,
        fontSize: fitted.fontSize,
        rect: { x: margin, y, w: captionW, h: footerH },
      });
    }
    cells.push(...footerCells);
  }

  // ── compose: RATIO m0 — cells quantize outward to a coarse lattice and each
  //    source carries a recovery inset that paints it back on its EXACT rect.
  //    Bounded precision (basis ≤ INSET_BASIS), zero drift, nests cleanly.
  //    Margins/gutters are the null space between packed rects (doc background).
  const pieces: InsetPiece[] = cells.map((c) => ({
    rect: { x: c.rect.x, y: c.rect.y, w: c.rect.w, h: c.rect.h, importance: c.kind === "panel" ? 0 : 1 },
    source: sourceForCell(c),
  }));
  const placed = placeInsetPieces({ rootW: W, rootH: H, pieces, basis: INSET_BASIS });
  if (placed.sources.length !== cells.length)
    throw new FigureLayoutError(
      `placed ${placed.sources.length} sources for ${cells.length} cells (internal ordering bug)`,
    );

  return { m0: placed.m0, sources: placed.sources, cells };
}
