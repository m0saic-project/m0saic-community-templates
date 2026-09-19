"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lyric_video_tutorial_1 = require("./lyric-video-tutorial");
const ctx = (width, height) => ({
    mode: "design",
    target: { width, height, fps: 30, durationMs: 1000 },
    output: { width, height, fps: 30, durationMs: 1000, workspaceDir: "" },
    media: {},
});
describe("lyric-video tutorial on the template-utils onboarding kit", () => {
    it("is deterministic and sized to the canvas on every beat", () => {
        const a = (0, lyric_video_tutorial_1.renderLyricVideoTutorial)(ctx(1280, 720));
        const b = (0, lyric_video_tutorial_1.renderLyricVideoTutorial)(ctx(1280, 720));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        for (const step of a.steps) {
            const doc = step.file;
            expect(doc.size).toEqual({ width: 1280, height: 720 });
        }
    });
    it("stacks the copy column over the visual in portrait", () => {
        const portrait = (0, lyric_video_tutorial_1.renderLyricVideoTutorial)(ctx(720, 1280));
        expect(portrait.steps).toHaveLength(5);
        for (const step of portrait.steps) {
            const doc = step.file;
            expect(doc.size).toEqual({ width: 720, height: 1280 });
        }
    });
});
