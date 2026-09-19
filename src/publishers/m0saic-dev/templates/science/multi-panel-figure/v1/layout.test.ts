import { getComplexityMetricsFast, validateM0String } from "@m0saic/dsl";
import { buildFigureLayout, FigureLayoutError, type FigureLayoutOptions } from "./layout";

const base = (over: Partial<FigureLayoutOptions> = {}): FigureLayoutOptions => ({
  W: 1600,
  H: 1200,
  rowCounts: [3, 2],
  panelLabels: ["A", "B", "C", "D", "E"],
  caption: "Figure 1 · Treated vs control.",
  scaleBar: { label: "100 um", frac: 0.25 },
  marginFrac: 0.045,
  gutterFrac: 0.015,
  ...over,
});

describe("multi-panel-figure layout — m0 emission", () => {
  it("emits one valid cell per panel, label, caption and scale-bar part, in paint order", () => {
    const layout = buildFigureLayout(base());
    expect(validateM0String(String(layout.m0)).ok).toBe(true);
    const kinds = layout.cells.map((c) => c.kind);
    // Row 1: 3 labels then 3 panels; row 2: 2 labels then 2 panels; footer: caption, bar, bar label.
    expect(kinds).toEqual([
      "label", "label", "label",
      "panel", "panel", "panel",
      "label", "label",
      "panel", "panel",
      "caption", "scalebar-bar", "scalebar-label",
    ]);
  });

  it("emits a RATIO m0 — precision bounded by the lattice basis, not the canvas", () => {
    // The point of the inset-recovery rebuild: precision no longer tracks the
    // canvas (was precisionCost == canvas width — slope 1.0 / ABSOLUTE). It now
    // stays flat, bounded by the ~120 lattice basis, so the figure nests into
    // any parent cell. Exactness rides each source's placement.inset, not the m0.
    const metrics = (W: number, H: number) =>
      getComplexityMetricsFast(String(buildFigureLayout(base({ W, H })).m0));
    const small = metrics(1600, 1200);
    const large = metrics(3200, 2400);
    expect(small.precisionCost).toBeLessThanOrEqual(130);
    expect(large.precisionCost).toBeLessThanOrEqual(130);
    // Doesn't scale with the canvas — a 2× canvas keeps the same precision.
    expect(large.precisionCost).toBeLessThanOrEqual(small.precisionCost + 16);
    // One frame per cell still survives the pack.
    expect(small.frameCount).toBe(buildFigureLayout(base({ W: 1600, H: 1200 })).cells.length);
  });

  it("gutters and margins are exact; panels in a row share a width within 1px", () => {
    const opts = base();
    const layout = buildFigureLayout(opts);
    const S = Math.min(opts.W, opts.H);
    const margin = Math.round(opts.marginFrac * S);
    const gutter = Math.round(opts.gutterFrac * S);
    const panels = layout.cells.filter((c) => c.kind === "panel");
    const row1 = panels.slice(0, 3).map((c) => c.rect);
    expect(row1[0].x).toBe(margin);
    expect(row1[1].x - (row1[0].x + row1[0].w)).toBe(gutter);
    expect(row1[2].x - (row1[1].x + row1[1].w)).toBe(gutter);
    expect(row1[2].x + row1[2].w).toBe(opts.W - margin);
    const widths = row1.map((r) => r.w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    // Row heights equal within 1px.
    const row2 = panels.slice(3).map((c) => c.rect);
    expect(Math.abs(row1[0].h - row2[0].h)).toBeLessThanOrEqual(1);
  });

  it("each label strip sits directly on top of its panel, left-aligned", () => {
    const layout = buildFigureLayout(base());
    const labels = layout.cells.filter((c) => c.kind === "label");
    const panels = layout.cells.filter((c) => c.kind === "panel");
    for (const l of labels) {
      const p = panels.find((c) => c.kind === "panel" && c.panelIndex === (l as { panelIndex: number }).panelIndex)!;
      expect(l.rect.x).toBe(p.rect.x);
      expect(l.rect.w).toBe(p.rect.w);
      expect(l.rect.y + l.rect.h).toBe(p.rect.y);
    }
  });

  it("labels off / no footer: only panel cells remain", () => {
    const layout = buildFigureLayout(base({ panelLabels: null, caption: null, scaleBar: null }));
    expect(layout.cells.every((c) => c.kind === "panel")).toBe(true);
    expect(layout.cells.length).toBe(5);
  });

  it('an empty label ("") skips that panel\'s label cell', () => {
    const layout = buildFigureLayout(base({ rowCounts: [3], panelLabels: ["A", "", "C"], caption: null, scaleBar: null }));
    const labels = layout.cells.filter((c) => c.kind === "label") as Array<{ text: string }>;
    expect(labels.map((l) => l.text)).toEqual(["A", "C"]);
  });

  it("scale bar: thin centered bar next to its label, flush right", () => {
    const opts = base({ caption: null });
    const layout = buildFigureLayout(opts);
    const bar = layout.cells.find((c) => c.kind === "scalebar-bar")!;
    const label = layout.cells.find((c) => c.kind === "scalebar-label")!;
    expect(bar.rect.h).toBeLessThan(label.rect.h);
    expect(bar.rect.x + bar.rect.w).toBeLessThan(label.rect.x);
    const S = Math.min(opts.W, opts.H);
    const margin = Math.round(opts.marginFrac * S);
    expect(label.rect.x + label.rect.w).toBe(opts.W - margin);
  });

  it("a hopelessly long caption ellipsis-truncates at the minimum font", () => {
    const layout = buildFigureLayout(
      base({ W: 320, H: 260, rowCounts: [2], panelLabels: null, scaleBar: null, caption: "x".repeat(600) }),
    );
    const cap = layout.cells.find((c) => c.kind === "caption") as { text: string; fontSize: number };
    expect(cap.fontSize).toBe(8);
    expect(cap.text.endsWith("…")).toBe(true);
    expect(cap.text.length).toBeLessThan(600);
  });

  it("deterministic: identical inputs produce identical layouts", () => {
    expect(JSON.stringify(buildFigureLayout(base()))).toBe(JSON.stringify(buildFigureLayout(base())));
  });

  it("throws FigureLayoutError on a canvas too small for the rows", () => {
    expect(() => buildFigureLayout(base({ W: 60, H: 40, rowCounts: [4, 4] }))).toThrow(FigureLayoutError);
  });

  it("throws FigureLayoutError on a panelLabels length mismatch", () => {
    expect(() => buildFigureLayout(base({ panelLabels: ["A"] }))).toThrow(FigureLayoutError);
  });

  it("throws FigureLayoutError when a caption-less scale bar overflows the footer (never a silent squeeze)", () => {
    // frac 1 of a single-panel row = the whole interior; the label pushes the
    // block past it. Before the guard this dropped the negative remainder and
    // the footer weights no longer summed to the axis.
    expect(() =>
      buildFigureLayout(
        base({
          W: 400,
          H: 300,
          rowCounts: [1],
          panelLabels: null,
          caption: null,
          scaleBar: { label: "100 micrometers", frac: 1 },
        }),
      ),
    ).toThrow(FigureLayoutError);
  });
});
