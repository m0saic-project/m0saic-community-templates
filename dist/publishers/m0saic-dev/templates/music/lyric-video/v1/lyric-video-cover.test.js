"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const lyric_video_cover_1 = require("./lyric-video-cover");
const lyric_video_tutorial_1 = require("./lyric-video-tutorial");
const ctx = (width, height) => ({
    mode: "design",
    target: { width, height, fps: 30, durationMs: 1000 },
    output: { width, height, fps: 30, durationMs: 1000, workspaceDir: "" },
    media: {},
});
describe("lyric-video cover (mosaic-branding kit)", () => {
    it("builds the branded pane cover across landscape and portrait", () => {
        for (const size of [[1280, 720], [720, 1280]]) {
            const doc = (0, lyric_video_cover_1.renderLyricVideoCover)(ctx(size[0], size[1]));
            expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
            expect(doc.size).toEqual({ width: size[0], height: size[1] });
            // Slot/source agreement — a culled cell (gate-17 min floor) desyncs
            // the m0 from doc.sources and fails the whole render.
            expect((0, dsl_1.parseM0StringToRenderFrames)(doc.m0, size[0], size[1])).toHaveLength(doc.sources.length);
            const labels = doc.sources.map((s) => s.editor?.label ?? "");
            // The family chat pane + this template's real-material hero.
            const has = (prefix) => labels.some((l) => l.startsWith(prefix));
            expect(has("cover title")).toBe(true);
            expect(has("cover start tip")).toBe(true);
            expect(has("hero lyric line")).toBe(true);
            expect(has("hero cue strip")).toBe(true);
            expect(has("m0saic M logo")).toBe(true);
        }
    });
    it("carries the brand mark assets and stays deterministic", () => {
        const a = (0, lyric_video_cover_1.renderLyricVideoCover)(ctx(1280, 720));
        const b = (0, lyric_video_cover_1.renderLyricVideoCover)(ctx(1280, 720));
        expect(Object.keys(a.assets ?? {}).length).toBeGreaterThan(0);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});
describe("lyric-video tutorial (SaaS beats)", () => {
    it("is a five-beat pipeline of validated pages with authored durations", () => {
        const pipeline = (0, lyric_video_tutorial_1.renderLyricVideoTutorial)(ctx(1280, 720));
        expect(pipeline.kind).toBe("mosaic_pipeline");
        expect(pipeline.steps).toHaveLength(5);
        expect(pipeline.durationMs).toBe(25_000);
        expect(pipeline.steps.map((s) => s.name)).toEqual(["song", "lyrics", "tap", "correct", "beats"]);
        for (const step of pipeline.steps) {
            const doc = step.file;
            expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
            expect((0, dsl_1.parseM0StringToRenderFrames)(doc.m0, 1280, 720)).toHaveLength(doc.sources.length);
            expect(step.durationMs).toBe(5000);
            const labels = doc.sources.map((s) => s.editor?.label ?? "");
            expect(labels.some((l) => l.startsWith("beat title"))).toBe(true);
        }
    });
    it("every beat carries the progress rail", () => {
        const pipeline = (0, lyric_video_tutorial_1.renderLyricVideoTutorial)(ctx(1280, 720));
        for (const step of pipeline.steps) {
            const doc = step.file;
            expect(doc.sources.some((s) => s.editor?.label === "beat counter")).toBe(true);
        }
    });
});
