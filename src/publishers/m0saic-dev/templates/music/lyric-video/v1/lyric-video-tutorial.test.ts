import type { MosaicEngineContext } from "@m0saic/types";
import { renderLyricVideoTutorial } from "./lyric-video-tutorial";

const ctx = (width: number, height: number): MosaicEngineContext =>
  ({
    mode: "design",
    target: { width, height, fps: 30, durationMs: 1000 },
    output: { width, height, fps: 30, durationMs: 1000, workspaceDir: "" },
    media: {},
  }) as unknown as MosaicEngineContext;

describe("lyric-video tutorial on the template-utils onboarding kit", () => {
  it("is deterministic and sized to the canvas on every beat", () => {
    const a = renderLyricVideoTutorial(ctx(1280, 720));
    const b = renderLyricVideoTutorial(ctx(1280, 720));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const step of a.steps) {
      const doc = step.file as { size: { width: number; height: number } };
      expect(doc.size).toEqual({ width: 1280, height: 720 });
    }
  });

  it("stacks the copy column over the visual in portrait", () => {
    const portrait = renderLyricVideoTutorial(ctx(720, 1280));
    expect(portrait.steps).toHaveLength(5);
    for (const step of portrait.steps) {
      const doc = step.file as { size: { width: number; height: number } };
      expect(doc.size).toEqual({ width: 720, height: 1280 });
    }
  });
});
