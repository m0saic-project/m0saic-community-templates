/**
 * Layout — every rect the calendar paints, computed as integer pixels for
 * the exact render canvas (the beat-hero / scene-highlight resolution-baked
 * head-template style, laundered into real m0 cells by placeRects in
 * compose).
 *
 * Structure (all inside the card region):
 *
 *   paper (the sheet)
 *   └─ panel (the table's ink slab — grid lines are this showing through)
 *      ├─ masthead row  ("OCTOBER 2026")
 *      ├─ header row    (7 weekday cells, lattice columns)
 *      └─ week rows     (N×7 day cells, lattice columns)
 *
 * The lattice rounds each boundary independently (X_k = round(x0 + k·unit))
 * so line thickness never accumulates drift, and cells are inset from the
 * lattice lines by the line width — the ink slab showing between cells IS
 * the table grid.
 */

import type { StageArea } from "./platforms";

export type Rect = { x: number; y: number; w: number; h: number };

export type Aspect = "DESKTOP" | "SQUARE" | "TALL";

export function selectAspect(width: number, height: number): Aspect {
  if (width <= 0 || height <= 0) return "DESKTOP";
  const r = width / height;
  if (r >= 1.25) return "DESKTOP";
  if (r <= 0.8) return "TALL";
  return "SQUARE";
}

export type Regions = {
  facecam?: Rect;
  /** Where the TABLE (masthead + grid + list) lays out — inside the safe area. */
  card: Rect;
  /**
   * Where the SHEET paints. On tall (social) canvases the sheet bleeds edge
   * to edge so the calendar IS the video — the platform's chrome then sits
   * on sheet, not on an empty stage — while the table stays inside the safe
   * area. Absent = the sheet is the card (the poster look with a margin).
   */
  paper?: Rect;
};

export type FacecamCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export const FACECAM_CORNERS: FacecamCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

/** Picture-in-picture facecam on tall canvases: which corner, how wide. */
export type FacecamPip = {
  corner: FacecamCorner;
  /** Width as a fraction of the canvas width. */
  sizeFrac: number;
};

/** The PiP is 3:4 — a head-and-shoulders crop of any facecam. */
const PIP_ASPECT = 4 / 3;

/**
 * Top-level regions. With a facecam: side-by-side on desktop/square (portrait
 * video left, calendar right); on tall canvases the CALENDAR is the video —
 * the card fills the safe area exactly as it does without a facecam — and the
 * facecam is a picture-in-picture in the corner the user picked, inside the
 * safe area and nudged clear of the action rail (the top corners are
 * rail-free on TikTok / Shorts / Reels; the rail starts at 45 %). Default
 * corner: top-left. The card otherwise fills
 * the platform's SAFE area minus a margin, and never overlaps the rail.
 */
export function computeRegions(
  W: number,
  H: number,
  hasFacecam: boolean,
  aspect: Aspect,
  stage: StageArea = { safe: { x: 0, y: 0, w: W, h: H } },
  pip: FacecamPip = { corner: "top-left", sizeFrac: 0.34 },
  /** The drawn facecam rect (escape hatch): exactly where the facecam goes. */
  facecamOverride?: Rect,
): Regions {
  // A drawn rect moves ONLY the facecam: the calendar keeps the layout it
  // has with a facecam present (the side-by-side column on landscape, the
  // full safe area on portrait), and the cam lands exactly where the user
  // put it — over the calendar, beside it, wherever. Re-laying the calendar
  // out "as if alone" made moving the cam re-flow the whole month.
  if (hasFacecam && facecamOverride) {
    const auto = computeRegions(W, H, true, aspect, stage, pip);
    return { ...auto, facecam: facecamOverride };
  }
  const margin = Math.round(Math.min(W, H) * 0.035);
  const safe = stage.safe;
  const clearRail = (r: Rect): Rect => {
    const rail = stage.rail;
    if (!rail) return r;
    const overlaps =
      rail.x < r.x + r.w && rail.x + rail.w > r.x && rail.y < r.y + r.h && rail.y + rail.h > r.y;
    return overlaps ? { ...r, w: Math.max(1, rail.x - r.x) } : r;
  };
  if (!hasFacecam) {
    const card = inset(clearRail(safe), margin);
    return aspect === "TALL" ? { card, paper: { x: 0, y: 0, w: W, h: H } } : { card };
  }
  if (aspect === "TALL") {
    // TikTok style: the calendar is the video, the facecam a corner PiP.
    const card = inset(clearRail(safe), margin);
    const paper = { x: 0, y: 0, w: W, h: H };
    const gutter = margin;
    const w = Math.max(16, Math.min(Math.round(W * pip.sizeFrac), safe.w - 2 * gutter));
    const h = Math.max(16, Math.min(Math.round(w * PIP_ASPECT), safe.h - 2 * gutter));
    const right = pip.corner.endsWith("right");
    const top = pip.corner.startsWith("top");
    let x = right ? safe.x + safe.w - gutter - w : safe.x + gutter;
    const y = top ? safe.y + gutter : safe.y + safe.h - gutter - h;
    const rail = stage.rail;
    if (rail && rail.x < x + w && rail.y < y + h && rail.y + rail.h > y) {
      // The picked corner sits under the platform's buttons — slide left.
      x = Math.max(safe.x + gutter, rail.x - gutter - w);
    }
    return { facecam: { x, y, w, h }, card, paper };
  }
  // Side-by-side: a portrait slice on the left, sized for a 9:16 clip on
  // desktop (clamped so the calendar keeps most of the canvas). The facecam
  // matches the SHEET's height and top edge and shares its margin, so the
  // two read as one row — a full-height column beside an inset sheet looked
  // like two unrelated layers.
  const idealCamW = Math.round(H * (9 / 16));
  const camW =
    aspect === "DESKTOP"
      ? Math.min(idealCamW, Math.round(W * 0.4))
      : Math.round(W * 0.38);
  const left = Math.max(safe.x, camW);
  const card = inset(
    clearRail({ x: left, y: safe.y, w: Math.max(1, safe.x + safe.w - left), h: safe.h }),
    margin,
  );
  const camX = safe.x + margin;
  return {
    facecam: { x: camX, y: card.y, w: Math.max(1, camW - camX), h: card.h },
    card,
  };
}

function inset(r: Rect, m: number): Rect {
  const mm = Math.min(m, Math.floor(Math.min(r.w, r.h) / 4));
  return { x: r.x + mm, y: r.y + mm, w: r.w - 2 * mm, h: r.h - 2 * mm };
}

export type CardGeometry = {
  paper: Rect;
  /** The ink slab behind masthead + table; grid lines are it showing through. */
  panel: Rect;
  masthead: Rect;
  /** 7 header cells, left to right. */
  headerCells: Rect[];
  /** Day cells, row-major `[row][col]`. */
  dayCells: Rect[][];
  /** The table area (header + weeks) — the spotlight centers on this. */
  table: Rect;
  /**
   * Drops-list rows under the table (portrait / square reflow: titles leave
   * the cramped cells and line up here). Empty when the layout keeps titles
   * in their cells.
   */
  listRows: Rect[];
  listFontPx: number;
  /** Grid line thickness, px. */
  linePx: number;
  mastheadFontPx: number;
  headerFontPx: number;
  dayNumFontPx: number;
};

/** Fit a single ALL-CAPS line: font from height cap and width budget. */
export function fitCapsFontPx(
  text: string,
  rect: Rect,
  heightCap: number,
  em: number,
): number {
  const byHeight = rect.h * heightCap;
  const byWidth = (rect.w * 0.94 - 2) / Math.max(1, text.length * em);
  return Math.max(8, Math.floor(Math.min(byHeight, byWidth)));
}

export function computeCardGeometry(
  card: Rect,
  weekRows: number,
  mastheadText: string,
  /** Rows to reserve for the drops list under the table (0 = none). */
  listRowCount = 0,
  /** Where the sheet paints; defaults to the card (see `Regions.paper`). */
  paperRect?: Rect,
): CardGeometry {
  const minDim = Math.min(card.w, card.h);
  const pad = Math.max(4, Math.round(minDim * 0.028)); // paper margin around the slab
  const linePx = Math.max(1, Math.round(minDim * 0.0035));

  const paper = paperRect ?? card;
  const panel = inset(card, pad);

  // Row heights: masthead ~15% of the panel (capped against width so a
  // narrow card doesn't get a slab-sized masthead), header ~55% of a week
  // row, weeks split the rest evenly via the lattice.
  const mastheadH = Math.round(Math.min(panel.h * 0.15, panel.w * 0.14));
  const tableTop = panel.y + linePx + mastheadH;

  // Drops list: rows sized off the panel width (readable at phone scale),
  // capped so the grid keeps at least ~55 % of the panel.
  let listRowH = 0;
  let listH = 0;
  if (listRowCount > 0) {
    listRowH = Math.max(14, Math.round(Math.min(panel.w * 0.062, panel.h * 0.05)));
    const maxListH = Math.round((panel.h - mastheadH) * 0.45);
    if (listRowCount * listRowH > maxListH) listRowH = Math.max(14, Math.floor(maxListH / listRowCount));
    listH = listRowCount * listRowH + linePx;
  }

  const tableBottom = panel.y + panel.h - linePx - listH;
  const tableH = tableBottom - tableTop;
  const headerUnit = 0.55;
  const rowUnit = tableH / (weekRows + headerUnit);
  const headerH = Math.round(rowUnit * headerUnit);

  const masthead: Rect = {
    x: panel.x + linePx,
    y: panel.y + linePx,
    w: panel.w - 2 * linePx,
    h: mastheadH - linePx,
  };

  // Column lattice: 7 columns across the panel's inner width.
  const innerX = panel.x + linePx;
  const innerW = panel.w - 2 * linePx;
  const colX: number[] = Array.from({ length: 8 }, (_, k) =>
    Math.round(innerX + (k * innerW) / 7),
  );
  // Row lattice: header boundary, then equal week rows.
  const rowY: number[] = [tableTop, tableTop + headerH];
  for (let j = 1; j <= weekRows; j++) {
    rowY.push(Math.round(tableTop + headerH + (j * (tableH - headerH)) / weekRows));
  }

  const lead = Math.ceil(linePx / 2);
  const trail = Math.floor(linePx / 2);
  const cellAt = (c: number, r: number): Rect => {
    const x = colX[c] + lead;
    const y = rowY[r] + lead;
    return {
      x,
      y,
      w: Math.max(1, colX[c + 1] - trail - x),
      h: Math.max(1, rowY[r + 1] - trail - y),
    };
  };

  const headerCells = Array.from({ length: 7 }, (_, c) => cellAt(c, 0));
  const dayCells = Array.from({ length: weekRows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => cellAt(c, r + 1)),
  );

  const table: Rect = {
    x: innerX,
    y: tableTop,
    w: innerW,
    h: tableBottom - tableTop,
  };

  const listRows: Rect[] = Array.from({ length: listRowCount }, (_, i) => ({
    x: innerX,
    y: tableBottom + linePx + i * listRowH,
    w: innerW,
    h: Math.max(1, listRowH - (i === listRowCount - 1 ? 0 : 0)),
  }));

  const cellW = dayCells[0][0].w;
  const cellH = dayCells[0][0].h;
  return {
    paper,
    panel,
    masthead,
    headerCells,
    dayCells,
    table,
    listRows,
    listFontPx: Math.max(8, Math.floor(listRowH * 0.5)),
    linePx,
    mastheadFontPx: fitCapsFontPx(mastheadText, masthead, 0.6, 0.72),
    headerFontPx: Math.max(8, Math.floor(Math.min(headerH * 0.42, cellW * 0.13))),
    dayNumFontPx: Math.max(8, Math.floor(Math.min(cellH * 0.2, cellW * 0.16))),
  };
}

/** A centered square spotlight over the table area. */
/**
 * The teaser zoom: a square of `sizeFrac` × the table's short side, centred
 * on the table — horizontally AND vertically. It is the hero of the short-
 * form composition (founder 2026-09-15: title on top, facecam as host
 * commentary in the upper left, the zoomed promo centred in the calendar,
 * legend at the bottom) and never yields to the facecam; the facecam paints
 * above it instead (see `Z` in compose) and the creator sizes / places the
 * facecam so the two read as layers.
 */
export function spotlightRect(table: Rect, sizeFrac: number): Rect {
  const side = Math.max(16, Math.round(Math.min(table.w, table.h) * sizeFrac));
  return {
    x: table.x + Math.round((table.w - side) / 2),
    y: table.y + Math.round((table.h - side) / 2),
    w: side,
    h: side,
  };
}

/** The 4 edge bars of a highlight ring just inside `r`. */
export function ringRects(r: Rect, thickness: number): Rect[] {
  const t = Math.max(1, Math.min(thickness, Math.floor(Math.min(r.w, r.h) / 3)));
  return [
    { x: r.x, y: r.y, w: r.w, h: t },
    { x: r.x, y: r.y + r.h - t, w: r.w, h: t },
    { x: r.x, y: r.y + t, w: t, h: Math.max(1, r.h - 2 * t) },
    { x: r.x + r.w - t, y: r.y + t, w: t, h: Math.max(1, r.h - 2 * t) },
  ];
}
