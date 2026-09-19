"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@m0saic/types");
const dsl_1 = require("@m0saic/dsl");
const dual_sub_1 = require("./dual-sub");
const VIDEO_PATH = "/fixtures/episode.mkv";
function makeCtx(subtitles) {
    return {
        target: { width: 1280, height: 720, fps: 30, durationMs: 10_000 },
        media: {
            [(0, types_1.asAssetId)(VIDEO_PATH)]: {
                kind: "video",
                width: 1280,
                height: 720,
                durationMs: 30_000,
                subtitles,
            },
        },
    };
}
const cues = (n, prefix) => Array.from({ length: n }, (_, i) => ({
    startMs: i * 3000,
    endMs: i * 3000 + 2000,
    text: `${prefix} ${i}`,
}));
const track = (language, n = 60) => ({
    stream: { streamIndex: 0, codecName: "subrip", language, default: false, forced: false },
    cues: cues(n, language),
});
const CTX = () => makeCtx([track("spa"), track("eng")]);
const PROPS = { targetLanguage: "spa", nativeLanguage: "eng", preset: "try-first", seed: 7 };
describe("@m0saic-dev/language/dual-sub/v1", () => {
    it("renders a single-step pipeline with a valid real-geometry m0", async () => {
        const r = (await dual_sub_1.DualSub.render(PROPS, CTX()));
        expect(r.kind).toBe("mosaic_pipeline");
        expect(r.steps).toHaveLength(1);
        const doc = r.steps[0].file;
        expect((0, dsl_1.validateM0String)(doc.m0).ok).toBe(true);
        expect(doc.m0).not.toBe("F"); // slots are carved, not full-frame overlays
        expect(doc.size).toEqual({ width: 1280, height: 720 });
        expect(doc.sources).toHaveLength(3); // video + target + native
    });
    it("is deterministic — identical props produce identical documents", async () => {
        const a = JSON.stringify(await dual_sub_1.DualSub.render(PROPS, CTX()));
        const b = JSON.stringify(await dual_sub_1.DualSub.render(PROPS, CTX()));
        expect(a).toBe(b);
    });
    it("bar layout extends the canvas below the video", async () => {
        const r = (await dual_sub_1.DualSub.render({ ...PROPS, layout: "bar" }, CTX()));
        expect(r.steps[0].file.size.height).toBeGreaterThan(720);
    });
    it("unblur reveal adds the blurred twin slot; fade rides layer alpha", async () => {
        const r = (await dual_sub_1.DualSub.render({ ...PROPS, revealStyle: "unblur" }, CTX()));
        const sources = r.steps[0].file.sources;
        expect(sources).toHaveLength(4); // video + target + nativeBlur + native
        const blurred = sources.find((s) => (s.effects?.blur ?? 0) > 0);
        expect(blurred).toBeTruthy();
        const fade = (await dual_sub_1.DualSub.render({ ...PROPS, revealStyle: "fade" }, CTX()));
        expect(fade.steps[0].file.sources).toHaveLength(3);
        const native = fade.steps[0].file.sources[2];
        expect(native.layers?.some((l) => l.overlay?.alpha?.includes("min(1,max(0,"))).toBe(true);
    });
    it("cold-turkey renders the raw video only", async () => {
        const r = (await dual_sub_1.DualSub.render({ ...PROPS, preset: "cold-turkey" }, CTX()));
        expect(r.steps[0].file.m0).toBe("F");
        expect(r.steps[0].file.sources).toHaveLength(1);
    });
    it("fails fast with an error mosaic when the target track is missing (e.g. bitmap-only)", async () => {
        const ctx = makeCtx([{ stream: { streamIndex: 0, codecName: "hdmv_pgs_subtitle", default: false, forced: false }, cues: [] }]);
        const r = (await dual_sub_1.DualSub.render(PROPS, ctx));
        const doc = r.steps[0].file;
        // makeErrorMosaic documents render, but carry no subtitle slots
        expect(JSON.stringify(doc)).toContain("TARGET");
    });
    it("clip window trims duration and remaps cues", async () => {
        const r = (await dual_sub_1.DualSub.render({ ...PROPS, clipStartMs: 6000, clipEndMs: 12_000 }, CTX()));
        expect(r.steps[0].durationMs).toBe(6000);
        const text = r.steps[0].file.sources.find((s) => s.type === "text");
        for (const layer of text?.layers ?? []) {
            const m = /between\(t,([\d.]+),([\d.]+)\)/.exec(layer.overlay?.enable ?? "");
            expect(Number(m?.[2])).toBeLessThanOrEqual(6.0);
        }
    });
});
