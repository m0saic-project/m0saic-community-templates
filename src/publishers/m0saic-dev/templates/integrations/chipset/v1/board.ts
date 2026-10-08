/**
 * The motherboard around the chip: faint PCB decoration, generated from a
 * seed. Lead bundles leave the chip's top and flanks and bend away as nested
 * buses (the same no-crossing rule as the partner wires), ending on pads;
 * small IC packages sit in the free board space. Everything stays above the
 * horizon — the lower half of the card belongs to the partner wiring.
 *
 * Pure geometry in canvas px. The template splits it into a left and a right
 * half so each half paints as ONE masked tile (a mask is one source no matter
 * how many strokes it carries).
 */
import { mulberry32 } from "@m0saic/template-utils";

import type { Pt, Rect } from "./layout";

export type BoardArt = {
  /** Stroked open polylines (leads). */
  lines: Pt[][];
  /** Stroked closed outlines (IC packages). */
  outlines: Rect[];
  /** Filled pads at lead ends. */
  pads: { x: number; y: number; r: number }[];
  /** Filled small rects (IC pins). */
  blocks: Rect[];
};

type Ctx = { W: number; u: number; rnd: () => number; art: BoardArt; taken: Rect[] };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

/**
 * Board art for a chip at `chip`, kept above `floorAt(x)` (the horizon) and
 * out of `avoid`. `seed` picks lengths, bends and package placement.
 */
export function boardArt(
  W: number,
  u: number,
  chip: Rect,
  floorAt: (x: number) => number,
  avoid: Rect[],
  seed: number,
): BoardArt {
  const art: BoardArt = { lines: [], outlines: [], pads: [], blocks: [] };
  const c: Ctx = { W, u, rnd: mulberry32((seed | 0) ^ 0x5eed), art, taken: [...avoid] };
  const q = 13 * u; // lead pitch
  const topY = chip.y;
  const cx = chip.x + chip.w / 2;

  // Top leads: a straight centre bundle climbing toward the top edge.
  const k = Math.max(3, Math.min(7, Math.floor((chip.w * 0.22) / q)));
  const centre: Pt[][] = [];
  for (let j = 0; j < k; j++) {
    const x = cx - ((k - 1) / 2) * q + j * q;
    const len = (0.3 + 0.7 * c.rnd()) * topY * 0.85;
    centre.push([{ x, y: topY }, { x, y: Math.max(8 * u, topY - len) }]);
  }
  bundle(c, centre);

  // Top flank bundles: climb, turn outward, climb again. j = 0 is the line
  // nearest the centre; the outermost line turns first (lowest), so every
  // turn nests inside the next and no two leads cross. Chamfers grow on the
  // outside of each bend to keep the pitch through the 45°.
  for (const dir of [-1, 1]) {
    const x0 = cx + dir * (chip.w * 0.2);
    const reach = (0.16 + 0.12 * c.rnd()) * W;
    const flank: Pt[][] = [];
    for (let j = 0; j < k; j++) {
      const x = x0 + dir * j * q;
      const level = k - 1 - j;
      const yTurn = topY - 20 * u - level * q;
      const ch1 = 10 * u + level * q * (2 - Math.SQRT2);
      const ch2 = 10 * u + j * q * (2 - Math.SQRT2);
      const xOut = x + dir * reach;
      const up = (0.25 + 0.6 * c.rnd()) * Math.max(0, yTurn - ch2 - 10 * u);
      flank.push([
        { x, y: topY },
        { x, y: yTurn + ch1 },
        { x: x + dir * ch1, y: yTurn },
        { x: xOut - dir * ch2, y: yTurn },
        { x: xOut, y: yTurn - ch2 },
        { x: xOut, y: Math.max(8 * u, yTurn - ch2 - up) },
      ]);
    }
    bundle(c, flank);
  }

  // Side leads: bundles leaving the chip's flanks, running outward, then
  // bending down toward the horizon. Bending down, the bottom line turns first.
  const m = Math.max(3, Math.min(6, Math.floor((chip.h * 0.3) / q)));
  for (const dir of [-1, 1]) {
    const xEdge = dir < 0 ? chip.x : chip.x + chip.w;
    const yMid = chip.y + chip.h * 0.4;
    const run = (0.08 + 0.08 * c.rnd()) * W;
    const side: Pt[][] = [];
    for (let j = 0; j < m; j++) {
      const y = yMid + (j - (m - 1) / 2) * q;
      const level = m - 1 - j;
      const xTurn = xEdge + dir * (run + level * q);
      const ch = 10 * u + j * q * (2 - Math.SQRT2);
      const xv = xTurn + dir * ch;
      const yEnd = Math.min(floorAt(xv) - 14 * u, y + ch + (0.3 + 0.7 * c.rnd()) * 0.1 * W);
      if (yEnd - (y + ch) < 16 * u) continue;
      side.push([{ x: xEdge, y }, { x: xTurn, y }, { x: xv, y: y + ch }, { x: xv, y: yEnd }]);
    }
    bundle(c, side);
  }

  // IC packages in the free board space above the horizon.
  const want = W > 1.3 * (topY + chip.h) ? 8 : 6;
  let placed = 0;
  for (let t = 0; t < 80 && placed < want; t++) {
    const w = (44 + 90 * c.rnd()) * u;
    const h = (24 + 40 * c.rnd()) * u;
    const x = 24 * u + c.rnd() * (W - w - 48 * u);
    const nearest = Math.min(Math.max(cx, x), x + w);
    const floor = floorAt(nearest) - 24 * u;
    const y = 18 * u + c.rnd() * Math.max(0, floor - h - 18 * u);
    const pinLen = 7 * u;
    const r = { x, y, w, h };
    if (y + h + pinLen > floor) continue;
    if ([grow(chip, 30 * u), ...c.taken].some((o) => overlaps(grow(r, pinLen + 12 * u), o))) continue;
    c.taken.push(grow(r, pinLen));
    art.outlines.push(r);
    const pins = Math.max(2, Math.floor(w / (11 * u)));
    const pitch = w / pins;
    for (let p = 0; p < pins; p++) {
      const px = x + pitch * (p + 0.5) - 2 * u;
      art.blocks.push({ x: px, y: y - pinLen, w: 4 * u, h: pinLen - 2 * u });
      art.blocks.push({ x: px, y: y + h + 2 * u, w: 4 * u, h: pinLen - 2 * u });
    }
    placed++;
  }
  return art;
}

/** A bundle of leads, each ending on a pad. A lead is skipped when it would
 *  leave the canvas or run into space an EARLIER bundle took (a bundle's own
 *  lines run a pitch apart by design); its segments become taken space. */
function bundle(c: Ctx, leads: Pt[][]) {
  const took: Rect[] = [];
  for (const pts of leads) {
    const segs = pts.slice(1).map((p, i) => grow(bbox([pts[i], p]), 5 * c.u));
    // The first segment starts at the chip; only test the rest.
    if (segs.slice(1).some((s) => c.taken.some((o) => overlaps(s, o)))) continue;
    const box = bbox(pts);
    if (box.x < 6 * c.u || box.x + box.w > c.W - 6 * c.u) continue;
    c.art.lines.push(pts);
    const end = pts[pts.length - 1];
    c.art.pads.push({ x: end.x, y: end.y, r: 3.4 * c.u });
    took.push(...segs);
  }
  c.taken.push(...took);
}

export function bbox(pts: Pt[]): Rect {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
