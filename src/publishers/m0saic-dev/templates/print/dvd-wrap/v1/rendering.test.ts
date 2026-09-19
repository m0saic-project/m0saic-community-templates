import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import { isValidM0String, parseM0StringToRenderFrames } from "@m0saic/dsl";
import { resolveDvdDieline } from "./dieline";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";
import { renderDvdArtifact } from "./rendering";
import { validateDvdVariant } from "./validation";
import { resolveEffectiveVariant } from "./variants";

const ctx = (): MosaicEngineContext => ({
  mode: "render",
  target: { width: 794, height: 539, fps: 30, durationMs: 1000 },
  output: { width: 794, height: 539, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-render-test" },
  media: {},
});

describe("DVD artifact rendering", () => {
  const props = { ...DVD_WRAP_DEFAULT_PROPS, dpi: 72 };
  const dieline = resolveDvdDieline({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 72 });

  it("renders valid wrap geometry with nested panels, a barcode child, and the packaging sidecar", () => {
    const variant = resolveEffectiveVariant(props);
    const result = renderDvdArtifact({ artifact: "wrap", props, variant, validation: validateDvdVariant(props, variant, ctx()), dieline, ctx: ctx() });
    expect(isValidM0String(result.doc.m0)).toBe(true);
    expect(parseM0StringToRenderFrames(result.doc.m0, result.doc.size!.width, result.doc.size!.height)).toHaveLength(result.doc.sources.length);
    expect(result.doc.sources).toHaveLength(3);
    expect(Object.keys(result.doc.children ?? {})).toEqual([
      "panel-back",
      "panel-spine",
      "panel-front",
    ]);
    const backPanel = result.doc.children?.["panel-back"] as MosaicDocument;
    expect(Object.keys(backPanel.children ?? {})).toEqual(["barcode-us"]);
    expect(result.doc.sidecars?.packaging).toEqual(result.sidecar);
    expect(result.sidecar.dieline.pxSize).toEqual([dieline.canvas.width, dieline.canvas.height]);
    expect(result.layoutViolations).toEqual([]);
  });

  it("renders independent panel, proof, and 900px preview geometries", () => {
    const variant = resolveEffectiveVariant(props);
    const validation = validateDvdVariant(props, variant, ctx());
    const front = renderDvdArtifact({ artifact: "front", props, variant, validation, dieline, ctx: ctx() }).doc;
    const proof = renderDvdArtifact({ artifact: "proof", props, variant, validation, dieline, ctx: ctx() }).doc;
    const preview = renderDvdArtifact({ artifact: "preview", props, variant, validation, dieline, ctx: ctx() }).doc;
    // 368, not the raw mm math's 369: the standalone-panel canvas is snapped
    // to a lattice-friendly width (369 = 3²·41 → 368 = 2⁴·23, ±1px @72dpi).
    expect(front.size).toEqual({ width: 368, height: 522 });
    expect(proof.size!.height).toBeGreaterThan(dieline.canvas.height);
    expect(preview.size!.width).toBe(900);
    expect(proof.sources).toHaveLength(5);
    const proofMetadata = proof.children?.["proof-metadata"] as MosaicDocument;
    expect(proofMetadata.sources.some((source) => source.editor?.label === "proof metadata band")).toBe(true);
  });

  it("keeps the full-print DSL budget lattice-cheap (prime axes cost ~73K before snapping)", () => {
    const printProps = { ...DVD_WRAP_DEFAULT_PROPS, dpi: 300 };
    const printDieline = resolveDvdDieline({ caseType: "standard", discCount: 1, bleedMm: 3, dpi: 300 });
    const variant = resolveEffectiveVariant(printProps);
    const validation = validateDvdVariant(printProps, variant, ctx());
    const { doc } = renderDvdArtifact({
      artifact: "wrap",
      props: printProps,
      variant,
      validation,
      dieline: printDieline,
      ctx: ctx(),
    });
    let totalM0Chars = 0;
    const walk = (d: MosaicDocument): void => {
      totalM0Chars += d.m0.length;
      for (const child of Object.values(d.children ?? {})) {
        const c = child as MosaicDocument;
        if (c?.kind === "mosaic_document") walk(c);
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
