"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const dvd_wrap_tutorial_1 = require("./dvd-wrap-tutorial");
const ctx = {
    mode: "design",
    target: { width: 1280, height: 720, fps: 30, durationMs: 999999 },
    output: { width: 1280, height: 720, fps: 30, durationMs: 999999, workspaceDir: "" },
    media: {},
};
describe("DVD wrap tutorial", () => {
    it("owns a fixed five-page, 25-second production walkthrough", () => {
        const tutorial = (0, dvd_wrap_tutorial_1.renderDvdWrapTutorial)(ctx);
        expect(tutorial.steps.map((step) => step.name)).toEqual(["anatomy", "inputs", "territories", "artifacts", "preflight"]);
        expect(tutorial.durationMs).toBe(25000);
        for (const step of tutorial.steps)
            expect((0, dsl_1.isValidM0String)(step.file.m0)).toBe(true);
    });
    it("teaches variants, artifacts, sidecars, and preflight with ASCII-only copy", () => {
        const tutorial = (0, dvd_wrap_tutorial_1.renderDvdWrapTutorial)(ctx);
        const text = tutorial.steps.flatMap((step) => step.file.sources)
            .filter((source) => source.type === "text")
            .flatMap((source) => source.layers.map((layer) => layer.content.kind === "literal" ? layer.content.text : ""))
            .join(" ");
        for (const concept of ["territory", "WRAP", "PROOF", "sidecar", "CHECK DIGIT", "NO PLACEHOLDERS"])
            expect(text).toContain(concept);
        expect(text).toMatch(/^[\x20-\x7E]+$/);
    });
    it("snaps a prime stage canvas so every page's m0 stays lattice-cheap", () => {
        // The template's default device is the prime dieline canvas (3307×2244);
        // unsnapped, each of the five pages emitted hostile unit lattices.
        const primeCtx = {
            ...ctx,
            target: { ...ctx.target, width: 3307, height: 2244 },
            output: { ...ctx.output, width: 3307, height: 2244 },
        };
        const tutorial = (0, dvd_wrap_tutorial_1.renderDvdWrapTutorial)(primeCtx);
        for (const step of tutorial.steps) {
            const doc = step.file;
            expect(Math.abs(doc.size.width - 3307)).toBeLessThanOrEqual(3);
            expect(doc.size.width).not.toBe(3307);
            expect(doc.size.height).toBe(2244);
            expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
            // Densest page measures ~4.4K on the snapped lattice; an unsnapped
            // (hostile) page pays ~3307 tokens PER occupied band and lands well
            // above 15K. 8K is loose for content drift, tight against regression.
            expect(doc.m0.length).toBeLessThan(8_000);
        }
    });
});
