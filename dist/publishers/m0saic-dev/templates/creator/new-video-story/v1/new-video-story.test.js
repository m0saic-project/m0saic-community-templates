"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
const new_video_story_1 = require("./new-video-story");
/* eslint-disable @typescript-eslint/no-explicit-any */
const makeCtx = (target, media) => ({
    target: { width: 1080, height: 1920, fps: 30, durationMs: 8000, ...target },
    output: {},
    ...(media ? { media } : {}),
});
async function render(props, ctx = makeCtx()) {
    return (await new_video_story_1.NewVideoStoryV1.render(props, ctx));
}
function errorCode(doc) {
    return doc?.sources?.[0]?.engine?.renderError?.code;
}
describe("contract", () => {
    it("id, hints, tags and a complete default set", () => {
        expect(String(new_video_story_1.NewVideoStoryV1.id)).toBe("@m0saic-dev/creator/new-video-story/v1");
        expect(new_video_story_1.NewVideoStoryV1.outputHints).toMatchObject({
            width: 1080,
            height: 1920,
            fps: 30,
            durationMs: 8000,
            format: { kind: "video", container: "mp4" },
        });
        expect(new_video_story_1.NewVideoStoryV1.outputHints?.posterTimeMs).toBeGreaterThan(2000);
        expect(new_video_story_1.NewVideoStoryV1.tags).toContain("social");
        expect(new_video_story_1.NewVideoStoryV1.tags).toContain("animated");
        // A knob shows what it does: every optional boolean / closed-set knob
        // has a default, every plain string a default or a placeholder.
        expect((0, template_utils_1.auditDefaultProps)(new_video_story_1.NewVideoStoryV1)).toEqual([]);
        expect(new_video_story_1.NewVideoStoryV1.resolveOutputHints).toBeUndefined();
    });
    it("the schema's primary knobs are the ones a creator touches first", () => {
        const schema = new_video_story_1.NewVideoStoryV1.propsSchema;
        expect(schema.platform.meta.ui.primary).toBe(true);
        expect(schema.media.meta.ui.primary).toBe(true);
        expect(schema.headline.meta.ui.primary).toBe(true);
        expect(schema.mediaRegion.meta.control).toEqual({ picker: "regions", regions: { max: 1, shapes: ["rect"] } });
        expect(schema.badge.meta.constraints.oneOf).toEqual(["auto", "play", "note", "camera", "live", "none"]);
    });
});
describe("zero-props render (the demo contract)", () => {
    it("renders the YouTube demo as an animated MP4 story with a placeholder slot", async () => {
        const doc = await render({ ...new_video_story_1.NewVideoStoryV1.defaultProps });
        expect(doc.kind).toBe("mosaic_document");
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.format).toEqual({ kind: "video", container: "mp4" });
        expect(doc.size).toEqual({ width: 1080, height: 1920 });
        expect(doc.durationMs).toBe(8000);
        expect(doc.backgroundColor).toBe("#000000");
        expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1080, 1920);
        expect(parsed.ok).toBe(true);
        if (parsed.ok)
            expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
        expect(doc.sources).toHaveLength(18);
        const labels = doc.sources.map((s) => s.editor?.label);
        expect(labels).toContain("media-label");
        expect(labels).toContain("badge");
        expect(labels.filter((l) => l === "headline")).toHaveLength(3);
    });
    it("renders with literally empty props", async () => {
        const doc = await render({});
        expect(doc.kind).toBe("mosaic_document");
        expect(errorCode(doc)).toBeUndefined();
    });
    it("explicit defaults render the same as implicit ones", async () => {
        const a = await render({ ...new_video_story_1.NewVideoStoryV1.defaultProps });
        const b = await render({});
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});
describe("output format intent", () => {
    it("animate off + an image screenshot → PNG still", async () => {
        const doc = await render({ media: "shot.png", animate: false }, makeCtx({}, { "shot.png": { kind: "image" } }));
        expect(doc.format).toEqual({ kind: "image", container: "png" });
        for (const s of doc.sources)
            expect(s.overlay).toBeUndefined();
    });
    it("animate off + no screenshot → PNG still", async () => {
        const doc = await render({ animate: false });
        expect(doc.format).toEqual({ kind: "image", container: "png" });
    });
    it("a video screenshot is always a video", async () => {
        const doc = await render({ media: "rec.mp4", animate: false }, makeCtx({}, { "rec.mp4": { kind: "video", durationMs: 5000 } }));
        expect(doc.format).toEqual({ kind: "video", container: "mp4" });
    });
});
describe("duration-follow law", () => {
    const rec = { "rec.mp4": { kind: "video", durationMs: 12345 } };
    it("a video screenshot sets the render length when nothing is asked", async () => {
        const doc = await render({ media: "rec.mp4" }, makeCtx({}, rec));
        expect(doc.durationMs).toBe(12345);
    });
    it("an explicit ask (ctx.userIntent) wins over the screenshot", async () => {
        const ctx = { ...makeCtx({}, rec), userIntent: { durationMs: 4000 } };
        const doc = await render({ media: "rec.mp4" }, ctx);
        expect(doc.durationMs).toBe(4000);
    });
    it("an image screenshot follows the host target (seeded from the hint)", async () => {
        const doc = await render({ media: "shot.png" }, makeCtx({ durationMs: 6000 }, { "shot.png": { kind: "image" } }));
        expect(doc.durationMs).toBe(6000);
    });
    it("the probe decides the media kind over the extension", async () => {
        const doc = await render({ media: "weird.bin" }, makeCtx({}, { "weird.bin": { kind: "video", durationMs: 3000 } }));
        const m = doc.sources.find((s) => s.editor?.label === "media");
        expect(m.mediaType).toBe("video");
        expect(doc.durationMs).toBe(3000);
    });
});
describe("errors", () => {
    it("an audio screenshot → error mosaic with code", async () => {
        const doc = await render({ media: "song.mp3" }, makeCtx({}, { "song.mp3": { kind: "audio", durationMs: 1000 } }));
        expect(errorCode(doc)).toBe("NVS_MEDIA_KIND");
        expect(doc.durationMs).toBeGreaterThan(0);
    });
    it("a non-image badge image → error mosaic with code", async () => {
        const doc = await render({ badgeImage: "clip.mp4" }, makeCtx({}, { "clip.mp4": { kind: "video" } }));
        expect(errorCode(doc)).toBe("NVS_BADGE_KIND");
    });
});
describe("layout contract sweep (every element present at every canvas)", () => {
    const CANVASES = [
        [1080, 1920],
        [720, 1280],
        [540, 960],
        [1080, 1080],
        [1920, 1080],
        [1280, 720],
        [640, 360],
        [480, 270],
    ];
    for (const [w, h] of CANVASES) {
        it(`${w}x${h}`, async () => {
            const ctx = makeCtx({ width: w, height: h }, { "shot.png": { kind: "image" } });
            for (const props of [
                { ...new_video_story_1.NewVideoStoryV1.defaultProps, media: "shot.png" },
                { ...new_video_story_1.NewVideoStoryV1.defaultProps, platform: "podcast", headline: "brand new podcast episode" },
                { ...new_video_story_1.NewVideoStoryV1.defaultProps, platform: "x", headline: "premiere" },
            ]) {
                const doc = await render(props, ctx);
                expect(errorCode(doc)).toBeUndefined();
                expect(doc.size).toEqual({ width: w, height: h });
                (0, template_utils_1.assertLayout)(doc, ctx, "@m0saic-dev/creator/new-video-story/v1", {
                    constraints: [{ label: "headline" }, { label: "cta-box" }, { label: "pill" }, { label: "media" }],
                });
            }
        });
    }
});
describe("debug contracts (dev toggles, never chained)", () => {
    it("debugLayout passes on the REAL doc", async () => {
        const doc = await render({ ...new_video_story_1.NewVideoStoryV1.defaultProps, debugLayout: true });
        expect(doc.editor.layoutContract.ok).toBe(true);
        expect(doc.editor.layoutContract.violations).toEqual([]);
        expect(doc.editor.geometryContract).toBeUndefined();
    });
    it("debugGeometry passes (zero drift under inset recovery)", async () => {
        const doc = await render({ ...new_video_story_1.NewVideoStoryV1.defaultProps, media: "shot.png", debugGeometry: true }, makeCtx({}, { "shot.png": { kind: "image" } }));
        expect(doc.editor.geometryContract.ok).toBe(true);
        expect(doc.editor.geometryContract.violations).toEqual([]);
    });
    it("both on → geometry wins; the layout contract never sees a wireframe", async () => {
        const doc = await render({ ...new_video_story_1.NewVideoStoryV1.defaultProps, debugLayout: true, debugGeometry: true });
        expect(doc.editor.geometryContract.ok).toBe(true);
        expect(doc.editor.layoutContract).toBeUndefined();
    });
});
describe("determinism", () => {
    it("same props + ctx → byte-identical docs", async () => {
        const props = { ...new_video_story_1.NewVideoStoryV1.defaultProps, media: "shot.png", platform: "tiktok" };
        const a = await render(props, makeCtx({}, { "shot.png": { kind: "image" } }));
        const b = await render(props, makeCtx({}, { "shot.png": { kind: "image" } }));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});
