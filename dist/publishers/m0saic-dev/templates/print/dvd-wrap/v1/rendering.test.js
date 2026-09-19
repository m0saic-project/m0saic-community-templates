"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const dieline_1 = require("./dieline");
const props_1 = require("./props");
const rendering_1 = require("./rendering");
const validation_1 = require("./validation");
const variants_1 = require("./variants");
const ctx = () => ({
    mode: "render",
    target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
    output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-render-test" },
    media: {},
});
describe("DVD artifact rendering", () => {
    const props = { ...props_1.DVD_WRAP_DEFAULT_PROPS, dpi: 72 };
    const dieline = (0, dieline_1.resolveDvdDieline)({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 72 });
    it("renders valid wrap geometry with nested panels, a barcode child, and the packaging sidecar", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props);
        const result = (0, rendering_1.renderDvdArtifact)({ artifact: "wrap", props, variant, validation: (0, validation_1.validateDvdVariant)(props, variant, ctx()), dieline, ctx: ctx() });
        expect((0, dsl_1.isValidM0String)(result.doc.m0)).toBe(true);
        expect((0, dsl_1.parseM0StringToRenderFrames)(result.doc.m0, result.doc.size.width, result.doc.size.height)).toHaveLength(result.doc.sources.length);
        expect(result.doc.sources).toHaveLength(3);
        expect(Object.keys(result.doc.children ?? {})).toEqual([
            "panel-back",
            "panel-spine",
            "panel-front",
        ]);
        const backPanel = result.doc.children?.["panel-back"];
        expect(Object.keys(backPanel.children ?? {})).toEqual(["barcode-us"]);
        expect(result.doc.sidecars?.packaging).toEqual(result.sidecar);
        expect(result.sidecar.dieline.pxSize).toEqual([dieline.canvas.width, dieline.canvas.height]);
        expect(result.layoutViolations).toEqual([]);
    });
    it("renders independent panel, proof, and 900px preview geometries", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props);
        const validation = (0, validation_1.validateDvdVariant)(props, variant, ctx());
        const front = (0, rendering_1.renderDvdArtifact)({ artifact: "front", props, variant, validation, dieline, ctx: ctx() }).doc;
        const proof = (0, rendering_1.renderDvdArtifact)({ artifact: "proof", props, variant, validation, dieline, ctx: ctx() }).doc;
        const preview = (0, rendering_1.renderDvdArtifact)({ artifact: "preview", props, variant, validation, dieline, ctx: ctx() }).doc;
        // 368, not the raw mm math's 369: the standalone-panel canvas is snapped
        // to a lattice-friendly width (369 = 3²·41 → 368 = 2⁴·23, ±1px @72dpi).
        expect(front.size).toEqual({ width: 368, height: 522 });
        expect(proof.size.height).toBeGreaterThan(dieline.canvas.height);
        expect(preview.size.width).toBe(900);
        expect(proof.sources).toHaveLength(5);
        const proofMetadata = proof.children?.["proof-metadata"];
        expect(proofMetadata.sources.some((source) => source.editor?.label === "proof metadata band")).toBe(true);
    });
    it("keeps the full-print DSL budget lattice-cheap (prime axes cost ~73K before snapping)", () => {
        const printProps = { ...props_1.DVD_WRAP_DEFAULT_PROPS, dpi: 300 };
        const printDieline = (0, dieline_1.resolveDvdDieline)({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 });
        const variant = (0, variants_1.resolveEffectiveVariant)(printProps);
        const validation = (0, validation_1.validateDvdVariant)(printProps, variant, ctx());
        const { doc } = (0, rendering_1.renderDvdArtifact)({
            artifact: "wrap",
            props: printProps,
            variant,
            validation,
            dieline: printDieline,
            ctx: ctx(),
        });
        let totalM0Chars = 0;
        const walk = (d) => {
            totalM0Chars += d.m0.length;
            for (const child of Object.values(d.children ?? {})) {
                const c = child;
                if (c?.kind === "mosaic_document")
                    walk(c);
            }
        };
        walk(doc);
        // Pre-snap this tree summed to 73,728 chars (96% passthrough donors from
        // hostile prime axes — see .scratch/claude/dvd-wrap-dsl-budget.md). The
        // bound is deliberately loose vs the measured post-snap size so content
        // tweaks don't flake it, while still catching any hostile-axis re-entry.
        expect(totalM0Chars).toBeLessThan(20_000);
    });
});
