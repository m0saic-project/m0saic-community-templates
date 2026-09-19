import type { MosaicDocument, MosaicDocumentPipeline, MosaicEngineContext } from "@m0saic/types";
import { DvdWrapV1 } from "./dvd-wrap";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";

const ctx: MosaicEngineContext = {
  mode: "render",
  target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
  output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-template-test" },
  media: {},
};

describe("@m0saic-dev/print/dvd-wrap/v1", () => {
  it("declares the published template and both editor onboarding surfaces", () => {
    expect(String(DvdWrapV1.id)).toBe("@m0saic-dev/print/dvd-wrap/v1");
    expect(DvdWrapV1.capabilities).toEqual({ tier: "core" });
    expect(DvdWrapV1.outputHints?.format).toMatchObject({ kind: "image", container: "png" });
    expect(DvdWrapV1.sidecarsSchema?.packaging?.required).toBe(true);
    expect(typeof DvdWrapV1.renderCover).toBe("function");
    expect(typeof DvdWrapV1.renderTutorial).toBe("function");
  });

  it("renders deterministically as an emit:multi pipeline even for one SKU", async () => {
    const props = { ...DVD_WRAP_DEFAULT_PROPS, dpi: 72 };
    const a = await DvdWrapV1.render(props, ctx) as MosaicDocumentPipeline;
    const b = await DvdWrapV1.render(props, ctx) as MosaicDocumentPipeline;
    expect(a.kind).toBe("mosaic_pipeline");
    expect(a.emit).toBe("multi");
    expect(a.steps).toHaveLength(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("fails malformed variant JSON at the template boundary", async () => {
    const doc = await DvdWrapV1.render({ ...DVD_WRAP_DEFAULT_PROPS, variants: "{" }, ctx) as MosaicDocument;
    expect(doc.kind).toBe("mosaic_document");
    expect(JSON.stringify(doc.sources)).toContain("error");
  });
});
