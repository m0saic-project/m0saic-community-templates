import type { MosaicDocument, MosaicEngineContext, MosaicMediaMetadata, MosaicSource } from "@m0saic/types";
import { parseM0StringComplete, validateM0String } from "@m0saic/dsl";
import { MultiPanelFigure, autoRowCounts } from "./multi-panel-figure";
import { DEMO_PANEL_COUNT } from "./demo-fixture";

const ctxFor = (
  w: number,
  h: number,
  media: Record<string, Partial<MosaicMediaMetadata>> = {},
): MosaicEngineContext => {
  const t = { width: w, height: h, fps: 30, durationMs: 2000 };
  return {
    mode: "render",
    target: t,
    output: { ...t, workspaceDir: "/tmp/multi-panel-figure-test" },
    media,
  } as unknown as MosaicEngineContext;
};

const isErrorMosaic = (doc: MosaicDocument): boolean =>
  (doc.sources?.[0] as { engine?: { renderStatus?: string } } | undefined)?.engine?.renderStatus === "error";

const IMG = (width: number, height: number): Partial<MosaicMediaMetadata> => ({ kind: "image", width, height });

const editorLabels = (doc: MosaicDocument): string[] =>
  doc.sources
    .map((s) => (s as { editor?: { label?: string } }).editor?.label)
    .filter((l): l is string => !!l);

const render = async (props: Record<string, unknown>, ctx = ctxFor(1600, 1200)): Promise<MosaicDocument> =>
  (await MultiPanelFigure.render(props, ctx)) as MosaicDocument;

describe("@m0saic-dev/science/multi-panel-figure/v1 — template shell", () => {
  it("metadata: id, core tier, lossless PNG output hints", () => {
    expect(String(MultiPanelFigure.id)).toBe("@m0saic-dev/science/multi-panel-figure/v1");
    expect(MultiPanelFigure.version).toBe(1);
    expect(MultiPanelFigure.capabilities).toEqual({ tier: "core" });
    expect(MultiPanelFigure.outputHints?.format).toEqual({ kind: "image", container: "png" });
  });

  it("defaults: demo panels + letters + caption render standalone, m0 valid, frames == sources", async () => {
    const doc = await render({ ...MultiPanelFigure.defaultProps });
    expect(isErrorMosaic(doc)).toBe(false);
    expect(validateM0String(String(doc.m0)).ok).toBe(true);
    // 6 demo panels + 6 letters + 1 caption
    expect(doc.sources.length).toBe(DEMO_PANEL_COUNT * 2 + 1);
    const parsed = parseM0StringComplete(String(doc.m0), 1600, 1200);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
    expect(doc.size).toEqual({ width: 1600, height: 1200 });
    expect(doc.backgroundColor).toBe("#ffffff");
    expect(doc.fps).toBe(30);
    const labels = editorLabels(doc);
    expect(labels).toContain("panel:0");
    expect(labels).toContain("panel:5");
    expect(labels).toContain("label:A");
    expect(labels).toContain("label:F");
    expect(labels).toContain("caption");
  });

  it("determinism: double render is JSON-identical", async () => {
    const a = await render({ ...MultiPanelFigure.defaultProps });
    const b = await render({ ...MultiPanelFigure.defaultProps });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('labelCase "lower" letters a, b, c…', async () => {
    const doc = await render({ ...MultiPanelFigure.defaultProps, labelCase: "lower" });
    expect(editorLabels(doc)).toContain("label:a");
  });

  it("labels off removes the letter strips; empty caption removes the rail", async () => {
    const doc = await render({ labels: false, caption: "" });
    expect(isErrorMosaic(doc)).toBe(false);
    expect(doc.sources.length).toBe(DEMO_PANEL_COUNT);
    // Demo panels are the bundled mock charts (media); colored lavfi is only
    // the stripped-build fallback.
    expect(doc.sources.every((s) => (s as MosaicSource).type === "media")).toBe(true);
  });

  it("rowCounts sizes demo mode (4+2 keeps 6 panels; 2+2+2 too)", async () => {
    for (const rowCounts of [[4, 2], [2, 2, 2]]) {
      const doc = await render({ ...MultiPanelFigure.defaultProps, rowCounts });
      expect(isErrorMosaic(doc)).toBe(false);
      expect(editorLabels(doc).filter((l) => l.startsWith("panel:")).length).toBe(6);
    }
  });

  it("auto grid is aspect-aware: tall/mobile → more rows, wide → more columns", () => {
    // 6 panels — columns track the canvas aspect (cols/rows ≈ W/H).
    expect(autoRowCounts(6, 1920, 1080)).toEqual([3, 3]); // wide: 2 rows × 3 cols
    expect(autoRowCounts(6, 1080, 1920)).toEqual([2, 2, 2]); // tall: 3 rows × 2 cols
    expect(autoRowCounts(6, 1000, 1000)).toEqual([2, 2, 2]); // square favors landscape cells
    expect(autoRowCounts(6, 600, 3000)).toEqual([1, 1, 1, 1, 1, 1]); // very tall → 1 column
  });

  it("scale bar: non-empty label adds an ink bar + text", async () => {
    const doc = await render({ ...MultiPanelFigure.defaultProps, scaleBarLabel: "100 um" });
    const labels = editorLabels(doc);
    expect(labels).toContain("scalebar:bar");
    expect(labels).toContain("scalebar:label");
    const bar = doc.sources[labels.indexOf("scalebar:bar")] as { type: string; color?: string };
    expect(bar.type).toBe("lavfi");
    expect(bar.color).toBe("#16181d"); // light-preset ink
  });

  it("presets: dark duo pinned; explicit overrides win", async () => {
    const dark = await render({ ...MultiPanelFigure.defaultProps, preset: "dark" });
    expect(dark.backgroundColor).toBe("#101014");
    const over = await render({ ...MultiPanelFigure.defaultProps, background: "#123456", ink: "#abcdef", scaleBarLabel: "1 cm" });
    expect(over.backgroundColor).toBe("#123456");
    const labels = editorLabels(over);
    const bar = over.sources[labels.indexOf("scalebar:bar")] as { color?: string };
    expect(bar.color).toBe("#abcdef");
  });

  it("media mode: probed images become media sources + a manifest; panelFit flows through", async () => {
    const ids = ["/figs/scatter.png", "/figs/control.png", "/figs/heat.png"];
    const media = Object.fromEntries(ids.map((id) => [id, IMG(800, 600)]));
    const doc = await render({ sourceIds: ids, caption: "Fig" }, ctxFor(1600, 1200, media));
    expect(isErrorMosaic(doc)).toBe(false);
    const panels = doc.sources.filter((s) => (s as MosaicSource).type === "media") as Array<{
      assetId: string;
      placement?: { fit?: string };
    }>;
    expect(panels.length).toBe(3);
    expect(panels.every((p) => p.placement?.fit === "contain")).toBe(true);
    expect(Object.keys(doc.assets ?? {}).length).toBe(3);

    const cover = await render({ sourceIds: ids, panelFit: "cover" }, ctxFor(1600, 1200, media));
    const coverPanels = cover.sources.filter((s) => (s as MosaicSource).type === "media") as Array<{
      placement?: { fit?: string };
    }>;
    expect(coverPanels.every((p) => p.placement?.fit === "cover")).toBe(true);
  });

  it("panels sharing a basename get distinct asset keys (no silent same-image collision)", async () => {
    const ids = ["/runA/plot.png", "/runB/plot.png", "/runC/plot.png"];
    const media = Object.fromEntries(ids.map((id) => [id, IMG(800, 600)]));
    const doc = await render({ sourceIds: ids, caption: "" }, ctxFor(1600, 1200, media));
    expect(isErrorMosaic(doc)).toBe(false);
    const panels = doc.sources.filter((s) => (s as MosaicSource).type === "media") as Array<{ assetId: string }>;
    expect(new Set(panels.map((p) => p.assetId)).size).toBe(3);
    const assets = doc.assets as Record<string, { path?: string }>;
    expect(Object.keys(assets).length).toBe(3);
    // Each panel's manifest entry still points at ITS OWN file.
    expect(panels.map((p) => assets[p.assetId]?.path)).toEqual(ids);
  });

  it("custom panelLabels replace letters; an empty entry skips that label", async () => {
    const ids = ["/a.png", "/b.png", "/c.png"];
    const media = Object.fromEntries(ids.map((id) => [id, IMG(400, 400)]));
    const doc = await render({ sourceIds: ids, panelLabels: ["WT", "KO", ""] }, ctxFor(1600, 1200, media));
    const labels = editorLabels(doc).filter((l) => l.startsWith("label:"));
    expect(labels).toEqual(["label:WT", "label:KO"]);
  });

  it("fail-fast error mosaics: unprobed media, non-image media, rowCounts mismatch, label mismatch, too many panels, bad rowCounts entries", async () => {
    const img = { "/ok.png": IMG(400, 400) };
    expect(isErrorMosaic(await render({ sourceIds: ["/missing.png"] }))).toBe(true);
    expect(
      isErrorMosaic(await render({ sourceIds: ["/v.mp4"] }, ctxFor(1600, 1200, { "/v.mp4": { kind: "video", width: 640, height: 360 } }))),
    ).toBe(true);
    expect(isErrorMosaic(await render({ sourceIds: ["/ok.png"], rowCounts: [2] }, ctxFor(1600, 1200, img)))).toBe(true);
    expect(isErrorMosaic(await render({ sourceIds: ["/ok.png"], panelLabels: ["A", "B"] }, ctxFor(1600, 1200, img)))).toBe(true);
    expect(isErrorMosaic(await render({ rowCounts: [9, 9, 9] }))).toBe(true);
    expect(isErrorMosaic(await render({ rowCounts: [2.5, 2] }))).toBe(true);
    expect(isErrorMosaic(await render({ rowCounts: [] }))).toBe(true);
  });

  it("canvas too small for the requested grid renders an error mosaic, never throws", async () => {
    const doc = await render({ ...MultiPanelFigure.defaultProps, rowCounts: [6] }, ctxFor(80, 60));
    expect(isErrorMosaic(doc)).toBe(true);
  });

  it("text cells use the deterministic svg rasterizer as single-frame stills", async () => {
    const doc = await render({ ...MultiPanelFigure.defaultProps, scaleBarLabel: "1 cm" });
    const texts = doc.sources.filter((s) => (s as MosaicSource).type === "text") as Array<{
      rasterizer?: string;
      renderMode?: { kind?: string };
    }>;
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t) => t.rasterizer === "svg")).toBe(true);
    expect(texts.every((t) => t.renderMode?.kind === "image")).toBe(true);
  });
});
