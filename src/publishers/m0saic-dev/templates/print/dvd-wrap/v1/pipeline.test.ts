import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import { resolveDvdDieline } from "./dieline";
import { buildDvdStepNames, renderDvdWrapPipeline } from "./pipeline";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";
import type { DvdPackagingSidecar } from "./validation";

const ctx: MosaicEngineContext = {
  mode: "render",
  target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
  output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-pipeline-test" },
  media: {},
};
const dieline = resolveDvdDieline({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 72 });

describe("DVD fan-out pipeline", () => {
  it("builds stable territory-artifact names with duplicate ordinals", () => {
    expect(buildDvdStepNames([{ territory: "UK" }, { territory: "UK" }], ["wrap", "proof"], "US")).toEqual([
      ["uk-wrap", "uk-proof"], ["uk2-wrap", "uk2-proof"],
    ]);
  });

  it("fans variants by artifacts and degrades only a bad SKU", () => {
    const props = {
      ...DVD_WRAP_DEFAULT_PROPS,
      dpi: 72,
      artifacts: ["wrap", "back"] as Array<"wrap" | "back">,
      usePlaceholderBadges: true,
      variants: [
        { territory: "US", skuLabel: "GOOD-US" },
        { territory: "UK", skuLabel: "BAD-UK", barcodeValue: "not-a-code", ratingCertification: "BBFC:12" },
      ],
    };
    const pipeline = renderDvdWrapPipeline(props, ctx, dieline);
    expect(pipeline.emit).toBe("multi");
    expect(pipeline.steps.map((step) => step.name)).toEqual(["us-wrap", "us-back", "uk-wrap", "uk-back"]);
    const good = pipeline.steps[0].file as MosaicDocument;
    const bad = pipeline.steps[2].file as MosaicDocument;
    expect(good.children).toBeDefined();
    expect(bad.sidecars?.packaging).toBeDefined();
    expect(JSON.stringify(bad.sources)).toContain("error");
  });

  it("records a soft warning above the batch step threshold", () => {
    const props = {
      ...DVD_WRAP_DEFAULT_PROPS,
      dpi: 72,
      artifacts: ["wrap", "front", "spine", "back", "proof", "preview"] as Array<
        "wrap" | "front" | "spine" | "back" | "proof" | "preview"
      >,
      variants: Array.from({ length: 9 }, (_, index) => ({
        territory: "US",
        skuLabel: `US-${index + 1}`,
        barcodeValue: "invalid",
      })),
    };
    const pipeline = renderDvdWrapPipeline(props, ctx, dieline);
    const first = pipeline.steps[0].file as MosaicDocument;
    expect(pipeline.steps).toHaveLength(54);
    expect((first.sidecars?.packaging as DvdPackagingSidecar).warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BATCH_STEP_COUNT" }),
      ]),
    );
  });
});
