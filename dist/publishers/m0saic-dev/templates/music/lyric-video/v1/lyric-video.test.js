"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@m0saic/types");
const dsl_1 = require("@m0saic/dsl");
const lyric_video_1 = require("./lyric-video");
const SONG_PATH = "/fixtures/song.mp3";
const BG_VIDEO = "/fixtures/bg.mp4";
const BG_IMAGE = "/fixtures/bg.png";
function makeCtx(opts) {
    const songDurationMs = opts?.songDurationMs === undefined ? 183_000 : opts.songDurationMs;
    return {
        target: { width: 1280, height: 720, fps: 30, durationMs: 10_000 },
        ...(opts?.userDurationMs != null ? { userIntent: { durationMs: opts.userDurationMs } } : {}),
        media: {
            [(0, types_1.asAssetId)(SONG_PATH)]: {
                kind: "audio",
                width: 0,
                height: 0,
                ...(songDurationMs != null ? { durationMs: songDurationMs } : {}),
            },
            ...(opts?.extraMedia ?? {}),
        },
    };
}
const LYRICS = [
    { text: "First line I sing", startMs: 0 },
    { text: "Second line", startMs: 5000 },
];
const render = async (props, ctx) => (await lyric_video_1.LyricVideo.render(props, ctx));
const isErrorDoc = (doc) => doc.sources[0]?.engine?.renderStatus === "error";
const errorText = (doc) => String(doc.sources[0]?.engine?.renderError?.message ?? "");
describe("@m0saic-dev/music/lyric-video/v1", () => {
    it("ships the onboarding surfaces (cover + tutorial)", () => {
        expect(typeof lyric_video_1.LyricVideo.renderCover).toBe("function");
        expect(typeof lyric_video_1.LyricVideo.renderTutorial).toBe("function");
    });
    it("declares the cue-track picker bound to the song prop", () => {
        const lyricsDef = lyric_video_1.LyricVideo.propsSchema.lyrics;
        expect(lyricsDef.type).toBe("json");
        expect(lyricsDef.meta?.control?.picker).toBe("cue-track");
        expect(lyricsDef.meta?.control?.cueTrack).toEqual({
            mediaFromProp: "songId",
            maxCues: lyric_video_1.MAX_LYRIC_CUES,
            wordTiming: true,
            // The lyric words are DECLARED, not the control's defaults (the
            // control is generic) — dropping this block regresses the editor
            // to "No cues yet" / "Pick a media file first…".
            vocabulary: {
                item: "line",
                collection: "lyrics",
                media: "song",
                beatLabel: "[Instrumental]",
            },
        });
        expect(lyric_video_1.LyricVideo.propsSchema.songId.meta?.control?.accept).toEqual(["audio"]);
    });
    it("duration FOLLOWS THE SONG: probed length beats the 10s target hint", async () => {
        const doc = await render({ songId: SONG_PATH, lyrics: LYRICS }, makeCtx());
        expect(isErrorDoc(doc)).toBe(false);
        expect(doc.durationMs).toBe(183_000);
    });
    it("an explicit user ask (L0) still wins over the follow", async () => {
        const doc = await render({ songId: SONG_PATH, lyrics: LYRICS }, makeCtx({ userDurationMs: 9000 }));
        expect(doc.durationMs).toBe(9000);
    });
    it("without a probed song duration, the last timed line's end is the natural length", async () => {
        const doc = await render({ songId: SONG_PATH, lyrics: [{ text: "only", startMs: 1000, endMs: 6000 }] }, makeCtx({ songDurationMs: null }));
        expect(isErrorDoc(doc)).toBe(false);
        expect(doc.durationMs).toBe(6000);
    });
    it("renders the proven document shape: base, gated text band, audio leaf", async () => {
        const doc = await render({ songId: SONG_PATH, lyrics: LYRICS }, makeCtx());
        expect(doc.kind).toBe("mosaic_document");
        expect((0, dsl_1.validateM0String)(doc.m0).ok).toBe(true);
        expect(doc.sources).toHaveLength(3);
        expect(doc.sources[0].type).toBe("lavfi");
        const text = doc.sources[1];
        expect(text.type).toBe("text");
        expect(text.layers).toHaveLength(2);
        expect(text.layers[0].overlay.enable).toBe("between(t,0.000,5.000)");
        expect(text.layers[0].overlay.window).toEqual({ startSec: 0, endSec: 5 });
        // Ends inferred: line 2 runs to the song end.
        expect(text.layers[1].overlay.window).toEqual({ startSec: 5, endSec: 183 });
        expect(doc.sources[2]).toMatchObject({
            type: "media",
            mediaType: "audio",
            audio: { enabled: true, volume: 1 },
        });
    });
    it("background media becomes the base source (image: no playback; short video: loops)", async () => {
        const image = await render({ songId: SONG_PATH, lyrics: LYRICS, backgroundId: BG_IMAGE }, makeCtx({ extraMedia: { [(0, types_1.asAssetId)(BG_IMAGE)]: { kind: "image", width: 800, height: 600 } } }));
        expect(image.sources[0]).toMatchObject({ type: "media", mediaType: "image" });
        expect(image.sources[0].playback).toBeUndefined();
        const video = await render({ songId: SONG_PATH, lyrics: LYRICS, backgroundId: BG_VIDEO }, makeCtx({
            extraMedia: {
                [(0, types_1.asAssetId)(BG_VIDEO)]: { kind: "video", width: 640, height: 360, durationMs: 4000 },
            },
        }));
        expect(video.sources[0].playback).toEqual({
            clipStartMs: 0,
            clipDurationMs: 4000,
            loopMode: "loop",
        });
    });
    it("fails to a guidance mosaic: missing song / unprobed song", async () => {
        const missing = await render({ lyrics: LYRICS }, makeCtx());
        expect(isErrorDoc(missing)).toBe(true);
        expect(errorText(missing)).toContain("Song");
        const unprobed = await render({ songId: "/elsewhere/track.mp3", lyrics: LYRICS }, makeCtx());
        expect(isErrorDoc(unprobed)).toBe(true);
        expect(errorText(unprobed)).toContain("probe");
    });
    it("fails to guidance: unparsable, empty, and oversized lyrics", async () => {
        const bad = await render({ songId: SONG_PATH, lyrics: "{not json" }, makeCtx());
        expect(isErrorDoc(bad)).toBe(true);
        expect(errorText(bad)).toContain("did not parse");
        const empty = await render({ songId: SONG_PATH, lyrics: [] }, makeCtx());
        expect(isErrorDoc(empty)).toBe(true);
        expect(errorText(empty).toLowerCase()).toContain("paste");
        const over = await render({
            songId: SONG_PATH,
            lyrics: Array.from({ length: lyric_video_1.MAX_LYRIC_CUES + 1 }, (_, i) => ({ text: `l${i}`, startMs: i })),
        }, makeCtx());
        expect(isErrorDoc(over)).toBe(true);
        expect(errorText(over)).toContain(String(lyric_video_1.MAX_LYRIC_CUES));
    });
    it("a fully-untimed set auto-spreads across the song, bounded by the literal pads", async () => {
        const UNTIMED = [{ text: "one" }, { text: "two" }, { text: "three" }];
        const auto = await render({ songId: SONG_PATH, lyrics: UNTIMED }, makeCtx());
        expect(isErrorDoc(auto)).toBe(false);
        expect(auto.durationMs).toBe(183_000);
        const layers = auto.sources[1].layers;
        expect(layers).toHaveLength(3);
        // Defaults 0: start immediately, run to the very end.
        expect(layers[0].overlay.window.startSec).toBe(0);
        expect(layers[2].overlay.window.endSec).toBe(183);
        const padded = await render({ songId: SONG_PATH, lyrics: UNTIMED, leadInMs: 8000, tailMs: 5000 }, makeCtx());
        expect(isErrorDoc(padded)).toBe(false);
        expect(padded.sources[1].layers[0].overlay.window.startSec).toBe(8);
        expect(padded.sources[1].layers[2].overlay.window.endSec).toBe(178);
    });
    it("bestEffortTiming (dev): mixed sets render with guessed windows instead of guidance", async () => {
        const lyrics = [
            { text: "timed", startMs: 2000 },
            { text: "not yet" },
            { text: "also timed", startMs: 8000 },
        ];
        // Without the flag: the guidance card.
        const guided = await render({ songId: SONG_PATH, lyrics }, makeCtx());
        expect(isErrorDoc(guided)).toBe(true);
        // With the flag: a real render, the untimed line guessed between anchors.
        const doc = await render({ songId: SONG_PATH, lyrics, bestEffortTiming: true }, makeCtx());
        expect(isErrorDoc(doc)).toBe(false);
        const text = doc.sources[1];
        expect(text.layers).toHaveLength(3);
        expect(text.layers[1].overlay.window.startSec).toBe(5); // midpoint of [2000, 8000]
    });
    it("unresolved timing is guidance, not a render: untimed + out-of-order counts", async () => {
        const untimed = await render({
            songId: SONG_PATH,
            lyrics: [{ text: "timed", startMs: 0 }, { text: "not yet" }, { text: "me neither" }],
        }, makeCtx());
        expect(isErrorDoc(untimed)).toBe(true);
        expect(errorText(untimed)).toContain("2 lyric lines still need timing");
        expect(errorText(untimed)).toContain("tap pass");
        const inverted = await render({
            songId: SONG_PATH,
            lyrics: [
                { text: "late", startMs: 9000 },
                { text: "earlier", startMs: 4000 },
            ],
        }, makeCtx());
        expect(isErrorDoc(inverted)).toBe(true);
        expect(errorText(inverted)).toContain("out of order");
    });
    it("lines beyond a pinned shorter render are skipped; all-outside is guidance", async () => {
        const partial = await render({
            songId: SONG_PATH,
            lyrics: [
                { text: "in", startMs: 0 },
                { text: "beyond", startMs: 20_000 },
            ],
        }, makeCtx({ userDurationMs: 9000 }));
        expect(isErrorDoc(partial)).toBe(false);
        expect(partial.sources[1].layers).toHaveLength(1);
        const allOutside = await render({ songId: SONG_PATH, lyrics: [{ text: "beyond", startMs: 20_000 }] }, makeCtx({ userDurationMs: 9000 }));
        expect(isErrorDoc(allOutside)).toBe(true);
        expect(errorText(allOutside)).toContain("outside");
    });
    it("is deterministic — identical props produce identical documents", async () => {
        const props = { songId: SONG_PATH, lyrics: LYRICS, position: "bottom", revealStyle: "cut" };
        const a = JSON.stringify(await render(props, makeCtx()));
        const b = JSON.stringify(await render(props, makeCtx()));
        expect(a).toBe(b);
    });
});
