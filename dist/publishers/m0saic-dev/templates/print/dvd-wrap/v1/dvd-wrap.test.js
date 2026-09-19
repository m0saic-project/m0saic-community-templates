"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dvd_wrap_1 = require("./dvd-wrap");
const props_1 = require("./props");
const ctx = {
    mode: "render",
    target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
    output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-template-test" },
    media: {},
};
describe("@m0saic-dev/print/dvd-wrap/v1", () => {
    it("declares the published template and both editor onboarding surfaces", () => {
        expect(String(dvd_wrap_1.DvdWrapV1.id)).toBe("@m0saic-dev/print/dvd-wrap/v1");
        expect(dvd_wrap_1.DvdWrapV1.capabilities).toEqual({ tier: "core" });
        expect(dvd_wrap_1.DvdWrapV1.outputHints?.format).toMatchObject({ kind: "image", container: "png" });
        expect(dvd_wrap_1.DvdWrapV1.sidecarsSchema?.packaging?.required).toBe(true);
        expect(typeof dvd_wrap_1.DvdWrapV1.renderCover).toBe("function");
        expect(typeof dvd_wrap_1.DvdWrapV1.renderTutorial).toBe("function");
    });
    it("renders deterministically as an emit:multi pipeline even for one SKU", async () => {
        const props = { ...props_1.DVD_WRAP_DEFAULT_PROPS, dpi: 72 };
        const a = await dvd_wrap_1.DvdWrapV1.render(props, ctx);
        const b = await dvd_wrap_1.DvdWrapV1.render(props, ctx);
        expect(a.kind).toBe("mosaic_pipeline");
        expect(a.emit).toBe("multi");
        expect(a.steps).toHaveLength(1);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
    it("fails malformed variant JSON at the template boundary", async () => {
        const doc = await dvd_wrap_1.DvdWrapV1.render({ ...props_1.DVD_WRAP_DEFAULT_PROPS, variants: "{" }, ctx);
        expect(doc.kind).toBe("mosaic_document");
        expect(JSON.stringify(doc.sources)).toContain("error");
    });
});
