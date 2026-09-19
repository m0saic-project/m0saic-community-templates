"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dieline_1 = require("./dieline");
const pipeline_1 = require("./pipeline");
const props_1 = require("./props");
const ctx = {
    mode: "render",
    target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
    output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-pipeline-test" },
    media: {},
};
const dieline = (0, dieline_1.resolveDvdDieline)({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 72 });
describe("DVD fan-out pipeline", () => {
    it("builds stable territory-artifact names with duplicate ordinals", () => {
        expect((0, pipeline_1.buildDvdStepNames)([{ territory: "UK" }, { territory: "UK" }], ["wrap", "proof"], "US")).toEqual([
            ["uk-wrap", "uk-proof"], ["uk2-wrap", "uk2-proof"],
        ]);
    });
    it("fans variants by artifacts and degrades only a bad SKU", () => {
        const props = {
            ...props_1.DVD_WRAP_DEFAULT_PROPS,
            dpi: 72,
            artifacts: ["wrap", "back"],
            usePlaceholderBadges: true,
            variants: [
                { territory: "US", skuLabel: "GOOD-US" },
                { territory: "UK", skuLabel: "BAD-UK", barcodeValue: "not-a-code", ratingCertification: "BBFC:12" },
            ],
        };
        const pipeline = (0, pipeline_1.renderDvdWrapPipeline)(props, ctx, dieline);
        expect(pipeline.emit).toBe("multi");
        expect(pipeline.steps.map((step) => step.name)).toEqual(["us-wrap", "us-back", "uk-wrap", "uk-back"]);
        const good = pipeline.steps[0].file;
        const bad = pipeline.steps[2].file;
        expect(good.children).toBeDefined();
        expect(bad.sidecars?.packaging).toBeDefined();
        expect(JSON.stringify(bad.sources)).toContain("error");
    });
    it("records a soft warning above the batch step threshold", () => {
        const props = {
            ...props_1.DVD_WRAP_DEFAULT_PROPS,
            dpi: 72,
            artifacts: ["wrap", "front", "spine", "back", "proof", "preview"],
            variants: Array.from({ length: 9 }, (_, index) => ({
                territory: "US",
                skuLabel: `US-${index + 1}`,
                barcodeValue: "invalid",
            })),
        };
        const pipeline = (0, pipeline_1.renderDvdWrapPipeline)(props, ctx, dieline);
        const first = pipeline.steps[0].file;
        expect(pipeline.steps).toHaveLength(54);
        expect((first.sidecars?.packaging).warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: "BATCH_STEP_COUNT" }),
        ]));
    });
});
