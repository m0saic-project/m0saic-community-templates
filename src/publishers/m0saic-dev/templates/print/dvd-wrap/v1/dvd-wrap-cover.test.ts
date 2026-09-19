import type { MosaicEngineContext } from "@m0saic/types";
import { isValidM0String, parseM0StringToRenderFrames } from "@m0saic/dsl";
import { renderDvdWrapCover } from "./dvd-wrap-cover";

const ctx = (width: number, height: number): MosaicEngineContext => ({
  mode: "design",
  target: { width, height, fps: 30, durationMs: 1000 },
  output: { width, height, fps: 30, durationMs: 1000, workspaceDir: "" },
  media: {},
});

describe("DVD wrap cover", () => {
  it("is self-contained real geometry across landscape and portrait", () => {
    for (const size of [[1280, 720], [720, 1280]] as const) {
      const doc = renderDvdWrapCover(ctx(size[0], size[1]));
      expect(isValidM0String(doc.m0)).toBe(true);
      expect(parseM0StringToRenderFrames(doc.m0, doc.size!.width, doc.size!.height)).toHaveLength(doc.sources.length);
      expect(doc.sources.some((source) => source.editor?.label === "cover back panel")).toBe(true);
      expect(doc.sources.some((source) => source.editor?.label === "cover spine panel")).toBe(true);
      expect(doc.sources.some((source) => source.editor?.label === "cover front panel")).toBe(true);
    }
  });

  it("keeps lattice-friendly dims already (1280×720 snap is identity)", () => {
    const doc = renderDvdWrapCover(ctx(1280, 720));
    expect(doc.size).toEqual({ width: 1280, height: 720 });
  });

  it("snaps a prime stage canvas so the m0 stays lattice-cheap", () => {
    // This template's default device IS the prime dieline canvas (3307×2244).
    const doc = renderDvdWrapCover(ctx(3307, 2244));
    expect(Math.abs(doc.size!.width - 3307)).toBeLessThanOrEqual(3);
    expect(doc.size!.height).toBe(2244); // already divisor-rich — never moves
    expect(doc.size!.width).not.toBe(3307); // the prime must have moved
    expect(isValidM0String(doc.m0)).toBe(true);
    // Pre-snap this canvas emitted hostile unit lattices (thousands of chars).
    expect(doc.m0.length).toBeLessThan(4_000);
  });
});
