import { latticeAxisTier, mmToPx } from "@m0saic/template-utils";
import {
  buildDvdDielineSpec,
  dvdFitDpiToTarget,
  dvdSpineWidthMm,
  resolveDvdDieline,
} from "./dieline";

describe("DVD dieline", () => {
  it("resolves standard, slim, and multi-disc spines", () => {
    expect(dvdSpineWidthMm("standard", 1)).toBe(14);
    expect(dvdSpineWidthMm("slim", 1)).toBe(7);
    expect(dvdSpineWidthMm("multi", 2)).toBe(22);
    expect(dvdSpineWidthMm("multi", 4)).toBe(30);
    expect(resolveDvdDieline({ caseType: "slim", discCount: 1, bleedMm: 3, dpi: 300 }).panels[1].trim.width).toBeGreaterThan(0);
  });

  it("applies an explicit spine override and a narrow-spine safe margin", () => {
    const spec = buildDvdDielineSpec({ caseType: "standard", discCount: 1, spineWidthMm: 18, bleedMm: 3 });
    expect(spec.panels[1]).toEqual({ id: "spine", widthMm: 18, safeMarginMm: 2 });
  });

  describe("lattice snapping (prime-axis rescue)", () => {
    const CASES = [
      { caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 },
      { caseType: "slim", discCount: 1, bleedMm: 3, dpi: 300 },
      { caseType: "multi", discCount: 4, bleedMm: 3, dpi: 300 },
      { caseType: "standard", discCount: 1, bleedMm: 3, dpi: 72 },
    ] as const;

    it.each(CASES)("panel paint axes + canvas are lattice-friendly (%o)", (args) => {
      const d = resolveDvdDieline(args);
      const [back, spine, front] = d.panels;
      const seam1 = spine.trim.x;
      const seam2 = front.trim.x;
      // The child-doc axes: back paints 0..seam1, spine seam1..seam2,
      // front seam2..canvasW (see rendering.ts globalPanelGeometries).
      const spans = [seam1, seam2 - seam1, d.canvas.width - seam2, d.canvas.width, d.canvas.height];
      for (const s of spans) {
        expect(latticeAxisTier(s)).toBeGreaterThanOrEqual(1);
      }
      // At print DPI the ±3px window always contains a divisor-rich value —
      // the wide panels + canvas (96% of the old DSL bill) must be fully
      // rescued, not merely usable. (At 72 DPI the ±1px window can top out
      // at tier 1 — e.g. canvas 794 → 793 = 13·61, a 61-slot lattice —
      // which is already a cheap emit.)
      if (args.dpi >= 300) {
        expect(latticeAxisTier(seam1)).toBe(2);
        expect(latticeAxisTier(d.canvas.width - seam2)).toBe(2);
        expect(latticeAxisTier(d.canvas.width)).toBe(2);
      }
    });

    it("moves nothing more than the DPI-scaled tolerance from the raw mm math", () => {
      const args = { caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 } as const;
      const d = resolveDvdDieline(args);
      // Raw values from the pure mm math (280mm canvas, seams at 133/147mm).
      expect(Math.abs(d.canvas.width - mmToPx(280, 300))).toBeLessThanOrEqual(3);
      expect(Math.abs(d.canvas.height - mmToPx(190, 300))).toBeLessThanOrEqual(3);
      expect(Math.abs(d.panels[1].trim.x - mmToPx(133, 300))).toBeLessThanOrEqual(3);
      expect(Math.abs(d.panels[2].trim.x - mmToPx(147, 300))).toBeLessThanOrEqual(3);
    });

    it("honors a requested canvas via the effective dpi (user override wins)", () => {
      const base = { caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 } as const;
      const natural = resolveDvdDieline(base).canvas;

      // No target / degenerate target → exact print dpi.
      expect(dvdFitDpiToTarget({ ...base })).toBe(300);
      expect(dvdFitDpiToTarget({ ...base, target: { width: 0, height: 0 } })).toBe(300);

      // The natural canvas (the outputHints default) and near-misses within
      // the snap tolerance (stale pre-snap customs like 3307) stay exact.
      expect(dvdFitDpiToTarget({ ...base, target: { width: natural.width, height: natural.height } })).toBe(300);
      expect(dvdFitDpiToTarget({ ...base, target: { width: natural.width + 3, height: natural.height } })).toBe(300);

      // A genuinely different request scales: half-size box → ~half dpi.
      const half = dvdFitDpiToTarget({
        ...base,
        target: { width: Math.round(natural.width / 2), height: Math.round(natural.height / 2) },
      });
      expect(half).toBeGreaterThan(140);
      expect(half).toBeLessThan(160);

      // Aspect preserved: a 16:9 request fits the LIMITING axis.
      const hd = dvdFitDpiToTarget({ ...base, target: { width: 1920, height: 1080 } });
      expect(hd).toBeCloseTo(300 * (1080 / natural.height), 0);

      // Clamped: an absurdly small request never collapses below 24 dpi.
      expect(dvdFitDpiToTarget({ ...base, target: { width: 10, height: 10 } })).toBe(24);
    });

    it("keeps the dieline internally consistent after snapping", () => {
      const d = resolveDvdDieline({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 });
      const [back, spine, front] = d.panels;
      // Panels tile seam-free.
      expect(back.trim.x + back.trim.width).toBe(spine.trim.x);
      expect(spine.trim.x + spine.trim.width).toBe(front.trim.x);
      expect(front.trim.x + front.trim.width).toBe(d.trimBox.x + d.trimBox.width);
      // Fold lines sit exactly on the seams.
      expect(d.foldLinesX).toEqual([spine.trim.x, front.trim.x]);
      // Safe rects stay inside their (snapped) trims.
      for (const p of d.panels) {
        expect(p.safe.x).toBeGreaterThanOrEqual(p.trim.x);
        expect(p.safe.x + p.safe.width).toBeLessThanOrEqual(p.trim.x + p.trim.width);
        expect(p.safe.y).toBeGreaterThanOrEqual(p.trim.y);
        expect(p.safe.y + p.safe.height).toBeLessThanOrEqual(p.trim.y + p.trim.height);
      }
      // Trim box sits inside the canvas with the bleed preserved.
      expect(d.trimBox.x).toBeGreaterThan(0);
      expect(d.trimBox.x + d.trimBox.width).toBeLessThan(d.canvas.width);
    });
  });
});
