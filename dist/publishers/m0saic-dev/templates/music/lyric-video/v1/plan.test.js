"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const plan_1 = require("./plan");
const win = (startMs, endMs, text = `line@${startMs}`) => ({
    startMs,
    endMs,
    text,
});
const fwin = (startMs, endMs, lines = [`line@${startMs}`], fontPx = 50) => ({ startMs, endMs, lines, fontPx });
const STYLE = (0, plan_1.resolveLyricStyle)({});
describe("resolveLyricStyle", () => {
    test("defaults + clamps", () => {
        expect(STYLE).toEqual({
            position: "middle",
            align: "center",
            textScale: 1,
            textColor: "#FFFFFF",
            backgroundColor: "#000000",
            revealStyle: "fade",
            karaoke: "off",
            karaokeColor: "#FFC53D",
            bestEffort: false,
        });
        expect((0, plan_1.resolveLyricStyle)({ bestEffortTiming: true }).bestEffort).toBe(true);
        expect((0, plan_1.resolveLyricStyle)({ bestEffortTiming: "yes" }).bestEffort).toBe(false);
        expect((0, plan_1.resolveLyricStyle)({ karaoke: "sparkles" }).karaoke).toBe("off");
        expect((0, plan_1.resolveLyricStyle)({ karaoke: "dot" }).karaoke).toBe("dot");
        expect((0, plan_1.resolveLyricStyle)({ textScale: 9 }).textScale).toBe(2);
        expect((0, plan_1.resolveLyricStyle)({ textScale: 0.1 }).textScale).toBe(0.5);
        expect((0, plan_1.resolveLyricStyle)({ position: "sideways", align: "justify", revealStyle: "spin" })).toMatchObject({ position: "middle", align: "center", revealStyle: "fade" });
        expect((0, plan_1.resolveLyricStyle)({ textColor: "  " }).textColor).toBe("#FFFFFF");
    });
    test("font size scales with canvas height and textScale, floored", () => {
        expect((0, plan_1.computeLyricFontPx)(1080, 1)).toBe(Math.round(1080 * 0.046));
        expect((0, plan_1.computeLyricFontPx)(1080, 2)).toBe(Math.round(1080 * 0.046 * 2));
        expect((0, plan_1.computeLyricFontPx)(60, 0.5)).toBe(14);
    });
});
describe("fitLyricWindows — the band layout contract", () => {
    const GEO = (0, plan_1.computeLyricBandGeometry)({
        canvasW: 1920,
        canvasH: 1080,
        position: "middle",
        textScale: 1,
    });
    const FIT = { bandW: GEO.band.w, fontSizePx: GEO.fontSizePx };
    const usable = GEO.band.w * (1 - 2 * plan_1.LYRIC_PAD_X_FRAC);
    // The invariant every fitted window must satisfy: each line's estimated
    // width stays inside the band, the stack stays inside the 2-line band,
    // and no LF ever reaches drawtext.
    const fits = (w) => w.lines.length <= plan_1.MAX_LINES_PER_WINDOW &&
        w.lines.every((l) => l.length * w.fontPx * plan_1.LYRIC_CHAR_EM <= usable && !l.includes("\n"));
    test("a line wider than the frame wraps instead of painting off-frame", () => {
        const [w] = (0, plan_1.fitLyricWindows)([win(0, 1000, "Every single line shows up right on time (right on time, on time)")], FIT);
        expect(w.lines).toHaveLength(2);
        expect(w.fontPx).toBe(GEO.fontSizePx); // wrap alone fixes it — no shrink
        expect(fits(w)).toBe(true);
    });
    test("short lines pass through untouched at the base size", () => {
        const [w] = (0, plan_1.fitLyricWindows)([win(0, 1000, "short line")], FIT);
        expect(w).toMatchObject({ lines: ["short line"], fontPx: GEO.fontSizePx });
    });
    test("too much text for two base-size lines shrinks ONLY that window", () => {
        const long = Array.from({ length: 26 }, () => "word").join(" ");
        const [a, b] = (0, plan_1.fitLyricWindows)([win(0, 1000, long), win(1000, 2000, "next")], FIT);
        expect(a.fontPx).toBeLessThan(GEO.fontSizePx);
        expect(fits(a)).toBe(true);
        expect(b.fontPx).toBe(GEO.fontSizePx);
    });
    test("an unbreakable word wider than the band shrinks to fit", () => {
        const [w] = (0, plan_1.fitLyricWindows)([win(0, 1000, "W".repeat(60))], FIT);
        expect(w.lines).toHaveLength(1);
        expect(w.fontPx).toBeLessThan(GEO.fontSizePx);
        expect(fits(w)).toBe(true);
    });
    test("pathological text hard-truncates with an ellipsis at the floor scale", () => {
        const [w] = (0, plan_1.fitLyricWindows)([win(0, 1000, "M".repeat(2000))], FIT);
        expect(fits(w)).toBe(true);
        expect(w.lines[w.lines.length - 1].endsWith("…")).toBe(true);
    });
    test("CONTRACT: hostile inputs always come out fitting the band", () => {
        const hostile = [
            "Every single line shows up right on time (right on time, on time)",
            "a",
            "W".repeat(500),
            Array.from({ length: 40 }, () => "lyric").join(" "),
            "multi\nline\nauthored\ntext\nwith\nmany\nrows",
            "🎵🎵🎵 emoji heavy line 🎵🎵🎵 with plenty of extra words to stretch it out",
        ];
        const fitted = (0, plan_1.fitLyricWindows)(hostile.map((t, i) => win(i * 1000, i * 1000 + 900, t)), FIT);
        for (const w of fitted)
            expect(fits(w)).toBe(true);
    });
});
describe("autoTimeLyrics", () => {
    test("spreads lines contiguously across [leadIn, duration - tail]", () => {
        const w = (0, plan_1.autoTimeLyrics)(["a", "b", "c"], { durationMs: 183_000, leadInMs: 8000, tailMs: 5000 });
        expect(w[0].startMs).toBe(8000);
        expect(w[w.length - 1].endMs).toBe(178_000);
        for (let i = 1; i < w.length; i++)
            expect(w[i].startMs).toBe(w[i - 1].endMs);
        for (const x of w) {
            expect(Number.isInteger(x.startMs)).toBe(true);
            expect(Number.isInteger(x.endMs)).toBe(true);
            expect(x.endMs).toBeGreaterThan(x.startMs);
        }
    });
    test("pads default to 0: first line at 0, last line ends at the duration", () => {
        expect((0, plan_1.autoTimeLyrics)(["a", "b"], { durationMs: 10_000, leadInMs: 0, tailMs: 0 })).toEqual([
            { text: "a", startMs: 0, endMs: 5000 },
            { text: "b", startMs: 5000, endMs: 10_000 },
        ]);
    });
    test("pads that squeeze below 1ms per line are ignored; negatives clamp to 0", () => {
        const squeezed = (0, plan_1.autoTimeLyrics)(["a", "b"], { durationMs: 10_000, leadInMs: 9000, tailMs: 2000 });
        expect(squeezed[0].startMs).toBe(0);
        expect(squeezed[1].endMs).toBe(10_000);
        expect((0, plan_1.autoTimeLyrics)(["a"], { durationMs: 10_000, leadInMs: -500, tailMs: -1 })).toEqual([
            { text: "a", startMs: 0, endMs: 10_000 },
        ]);
    });
    test("empty in, empty out", () => {
        expect((0, plan_1.autoTimeLyrics)([], { durationMs: 10_000, leadInMs: 0, tailMs: 0 })).toEqual([]);
    });
});
describe("chunkLyricWindows", () => {
    test("empty in, empty out; small lists stay one chunk", () => {
        expect((0, plan_1.chunkLyricWindows)([])).toEqual([]);
        expect((0, plan_1.chunkLyricWindows)([fwin(0, 1000)])).toHaveLength(1);
    });
    test("61 single-line windows split 60 + 1", () => {
        const windows = Array.from({ length: plan_1.LAYERS_PER_TEXT_SOURCE + 1 }, (_, i) => fwin(i * 1000, i * 1000 + 900));
        const chunks = (0, plan_1.chunkLyricWindows)(windows);
        expect(chunks.map((c) => c.length)).toEqual([plan_1.LAYERS_PER_TEXT_SOURCE, 1]);
    });
    test("a multi-line window never straddles a chunk boundary", () => {
        const windows = [
            ...Array.from({ length: plan_1.LAYERS_PER_TEXT_SOURCE - 1 }, (_, i) => fwin(i * 1000, i * 1000 + 900)),
            fwin(999_000, 999_900, ["one", "two", "three"]),
        ];
        const chunks = (0, plan_1.chunkLyricWindows)(windows);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toHaveLength(plan_1.LAYERS_PER_TEXT_SOURCE - 1);
        expect(chunks[1]).toHaveLength(1);
    });
});
describe("buildLyricLayers", () => {
    const OPTS = { align: "center", revealStyle: "fade", bandH: 160, baseFontPx: 50 };
    test("the enable string and the structured window describe the same window", () => {
        const [layer] = (0, plan_1.buildLyricLayers)([fwin(12_040, 15_820)], OPTS);
        const m = /^between\(t,([\d.]+),([\d.]+)\)$/.exec(layer.overlay?.enable ?? "");
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBe(layer.overlay?.window?.startSec);
        expect(Number(m[2])).toBe(layer.overlay?.window?.endSec);
        expect(layer.overlay?.window).toEqual({ startSec: 12.04, endSec: 15.82 });
    });
    test("fade adds the alpha ramp; cut does not", () => {
        const [fade] = (0, plan_1.buildLyricLayers)([fwin(1000, 2000)], OPTS);
        expect(fade.overlay?.alpha).toBe(`min(1,max(0,(t-1.000)/${plan_1.REVEAL_FADE_SEC}))`);
        const [cut] = (0, plan_1.buildLyricLayers)([fwin(1000, 2000)], { ...OPTS, revealStyle: "cut" });
        expect(cut.overlay?.alpha).toBeUndefined();
    });
    test("fitted lines become stacked single-line layers sharing the window", () => {
        const layers = (0, plan_1.buildLyricLayers)([fwin(0, 2000, ["upper", "lower"])], OPTS);
        expect(layers).toHaveLength(2);
        expect(layers.map((l) => l.content.text)).toEqual(["upper", "lower"]);
        // Bottom-anchored stack: the FIRST visual line sits one line-height above the second.
        const lineHFrac = Math.round(OPTS.baseFontPx * 1.3) / OPTS.bandH;
        const pads = layers.map((l) => l.placement?.padding?.y ?? 0);
        expect(pads[0]).toBeCloseTo(pads[1] + lineHFrac, 5);
        expect(layers[0].overlay).toEqual(layers[1].overlay);
        for (const l of layers)
            expect(l.content.text).not.toContain("\n");
    });
    test("a shrunk window overrides fontSize per layer; base-size windows do not", () => {
        const [base] = (0, plan_1.buildLyricLayers)([fwin(0, 1000)], OPTS);
        expect(base.style).toBeUndefined();
        const [small] = (0, plan_1.buildLyricLayers)([fwin(0, 1000, ["tiny"], 30)], OPTS);
        expect(small.style).toEqual({ fontSize: 30 });
        // The shrunk stack spaces by ITS line height, not the base one.
        const smalls = (0, plan_1.buildLyricLayers)([fwin(0, 1000, ["a", "b"], 30)], OPTS);
        const pads = smalls.map((l) => l.placement?.padding?.y ?? 0);
        expect(pads[0]).toBeCloseTo(pads[1] + Math.round(30 * 1.3) / OPTS.bandH, 5);
    });
});
describe("karaoke rendering", () => {
    const OPTS = {
        align: "center",
        revealStyle: "cut",
        bandH: 160,
        bandW: 1616,
        baseFontPx: 50,
        karaokeColor: "#FFC53D",
    };
    const SPANS = [
        { text: "every", startMs: 1000, endMs: 1500 },
        { text: "line", startMs: 1500, endMs: 2200 },
        { text: "sings", startMs: 2200, endMs: 3000 },
    ];
    const kwin = () => ({
        startMs: 1000,
        endMs: 3000,
        lines: ["every line sings"],
        fontPx: 50,
        wordSpans: SPANS,
    });
    test("mapSpansToLines splits spans across wrapped lines; mismatch → null", () => {
        expect((0, plan_1.mapSpansToLines)(["a b", "c"], SPANS)).toEqual([SPANS.slice(0, 2), SPANS.slice(2)]);
        expect((0, plan_1.mapSpansToLines)(["a b"], SPANS)).toBeNull(); // truncation lost a token
    });
    test("highlight: one base + one CUMULATIVE prefix per word, sharing the left anchor", () => {
        const layers = (0, plan_1.buildLyricLayers)([kwin()], { ...OPTS, karaoke: "highlight" });
        expect(layers).toHaveLength(4); // base + 3 prefixes
        const texts = layers.map((l) => l.content.text);
        expect(texts).toEqual(["every line sings", "every", "every line", "every line sings"]);
        // Exact mutual alignment: every layer left-anchored at the same pad,
        // and BASELINE-PINNED on the same content-independent yExpr (text_h
        // varies with the glyphs present; ascent/descent are font constants).
        const pads = new Set(layers.map((l) => (l.placement?.padding).x));
        expect(pads.size).toBe(1);
        expect(layers.every((l) => l.placement?.hAlign === "left")).toBe(true);
        const yExprs = new Set(layers.map((l) => l.placement?.yExpr));
        expect(yExprs.size).toBe(1);
        // A plain constant — content-dependent metrics (text_h/ascent) drift
        // with the glyph mix, and commas kill the inlined filtergraph.
        expect([...yExprs][0]).toMatch(/^\d+$/);
        // Word 2's prefix: enabled from ITS start to line end, alpha ramps
        // over the word's own span (0.7s) — "fills for as long as it's sung".
        const w2 = layers[2];
        expect(w2.overlay?.enable).toBe("between(t,1.500,3.000)");
        expect(w2.overlay?.alpha).toBe("min(1,max(0,(t-1.500)/0.700))");
        expect(w2.style?.fontColor).toBe("#FFC53D");
    });
    test("dot: one COMMA-FREE parked layer per word, held until the next word", () => {
        const layers = (0, plan_1.buildLyricLayers)([kwin()], { ...OPTS, karaoke: "dot" });
        expect(layers).toHaveLength(4); // base + 3 dots
        const dots = layers.slice(1);
        for (const dot of dots) {
            expect(dot.content.text).toBe("●");
            // Placement exprs are inlined into the filtergraph verbatim — a
            // comma (any if()/lt()) kills the graph. Lock the safe shape.
            expect(dot.placement?.xExpr).not.toContain(",");
            expect(dot.placement?.yExpr).not.toContain(",");
            expect(dot.placement?.yExpr).toContain("abs(sin(");
        }
        // Word 1's dot holds until word 2 STARTS (no dead air between words).
        expect(dots[0].overlay?.window).toEqual({ startSec: 1, endSec: 1.5 });
        expect(dots[1].overlay?.window).toEqual({ startSec: 1.5, endSec: 2.2 });
        expect(dots[2].overlay?.window).toEqual({ startSec: 2.2, endSec: 3 });
    });
    test("windows without resolved spans fall back to plain line rendering", () => {
        const plain = { startMs: 0, endMs: 2000, lines: ["hello"], fontPx: 50 };
        const layers = (0, plan_1.buildLyricLayers)([plain], { ...OPTS, karaoke: "highlight" });
        expect(layers).toHaveLength(1);
        expect(layers[0].placement?.hAlign).toBe("center"); // the normal path
    });
    test("windowLayerCount matches what buildLyricLayers emits (chunk budget law)", () => {
        expect((0, plan_1.windowLayerCount)(kwin(), "highlight")).toBe(4);
        expect((0, plan_1.windowLayerCount)(kwin(), "dot")).toBe(4);
        expect((0, plan_1.windowLayerCount)(kwin(), "off")).toBe(1);
        expect((0, plan_1.windowLayerCount)({ startMs: 0, endMs: 1, lines: ["a"], fontPx: 50 }, "highlight")).toBe(1);
    });
    test("end-to-end: a karaoke document renders word layers and stays deterministic", () => {
        const args = {
            canvasW: 1280,
            canvasH: 720,
            fps: 30,
            durationMs: 10_000,
            song: { path: "/fixtures/song.mp3", assetMediaType: "audio" },
            windows: [
                {
                    startMs: 0,
                    endMs: 4000,
                    text: "two words",
                    words: [{ startMs: 0, endMs: 1500 }, { startMs: 1500 }],
                },
                { startMs: 4000, endMs: 10_000, text: "plain line" },
            ],
            style: (0, plan_1.resolveLyricStyle)({ karaoke: "highlight" }),
        };
        const doc = (0, plan_1.buildLyricDocument)(args);
        // base(2 words line) + 2 prefixes + base(plain) = 4 text layers.
        expect(doc.sources[1].layers).toHaveLength(4);
        expect(JSON.stringify((0, plan_1.buildLyricDocument)(args))).toBe(JSON.stringify((0, plan_1.buildLyricDocument)(args)));
    });
});
describe("best-effort timing (dev/debug)", () => {
    const OPTS = { durationMs: 20_000, leadInMs: 0, tailMs: 0 };
    test("spreads an untimed run evenly between its timed anchors", () => {
        const windows = (0, plan_1.bestEffortWindows)([
            { text: "a", startMs: 2000 },
            { text: "b" },
            { text: "c" },
            { text: "d", startMs: 8000 },
        ], OPTS);
        expect(windows.map((w) => w.startMs)).toEqual([2000, 4000, 6000, 8000]);
        // Contiguous: each guessed line runs to the next.
        expect(windows[0].endMs).toBe(4000);
        expect(windows[2].endMs).toBe(8000);
    });
    test("leading run spreads from leadIn; trailing run toward duration − tail", () => {
        const windows = (0, plan_1.bestEffortWindows)([{ text: "lead" }, { text: "anchor", startMs: 6000 }, { text: "tail" }], { durationMs: 20_000, leadInMs: 2000, tailMs: 2000 });
        expect(windows[0].startMs).toBe(2000); // leading run starts at the pad
        expect(windows[2].startMs).toBe(12_000); // half of [6000, 18000]
        expect(windows[2].endMs).toBe(20_000);
    });
    test("an inverted mis-tap keeps its line on screen for a beat instead of vanishing", () => {
        const windows = (0, plan_1.bestEffortWindows)([
            { text: "late", startMs: 9000 },
            { text: "earlier", startMs: 4000 },
        ], OPTS);
        expect(windows).toHaveLength(2);
        expect(windows[0]).toMatchObject({ startMs: 9000, endMs: 10_000 }); // start+1s hold
    });
    test("outside lines still skip; words ride through", () => {
        const windows = (0, plan_1.bestEffortWindows)([
            { text: "in", startMs: 1000, words: [{ startMs: 1000 }] },
            { text: "beyond", startMs: 30_000 },
        ], OPTS);
        expect(windows).toHaveLength(1);
        expect(windows[0].words).toEqual([{ startMs: 1000 }]);
    });
    test("synthesizeWordSpans: char-proportional, monotone, inside the window", () => {
        const spans = (0, plan_1.synthesizeWordSpans)("go gooo goooooo", { startMs: 1000, endMs: 5000 });
        expect(spans.map((s) => s.text)).toEqual(["go", "gooo", "goooooo"]);
        for (let i = 0; i < spans.length; i++) {
            expect(spans[i].endMs).toBeGreaterThan(spans[i].startMs);
            expect(spans[i].endMs).toBeLessThanOrEqual(5000);
            if (i > 0)
                expect(spans[i].startMs).toBe(spans[i - 1].endMs);
        }
        // Longer words hold longer.
        expect(spans[2].endMs - spans[2].startMs).toBeGreaterThan(spans[0].endMs - spans[0].startMs);
    });
    test("karaoke + bestEffort synthesizes spans for windows without word timing", () => {
        const args = {
            canvasW: 1280,
            canvasH: 720,
            fps: 30,
            durationMs: 10_000,
            song: { path: "/fixtures/song.mp3", assetMediaType: "audio" },
            windows: [{ startMs: 0, endMs: 5000, text: "no words here" }],
            style: (0, plan_1.resolveLyricStyle)({ karaoke: "highlight", bestEffortTiming: true }),
        };
        const doc = (0, plan_1.buildLyricDocument)(args);
        // base + 3 synthesized prefixes.
        expect(doc.sources[1].layers).toHaveLength(4);
    });
});
describe("buildLyricLayout", () => {
    test("emits valid carved m0 with base first, audio last", () => {
        const layout = (0, plan_1.buildLyricLayout)({
            canvasW: 1920,
            canvasH: 1080,
            position: "bottom",
            textScale: 1,
            chunkCount: 1,
        });
        expect((0, dsl_1.validateM0String)(layout.m0).ok).toBe(true);
        expect(layout.m0).not.toBe("F"); // the band is a real cell, not a full-frame overlay
        expect(layout.slotOrder[0]).toEqual({ kind: "base" });
        expect(layout.slotOrder[layout.slotOrder.length - 1]).toEqual({ kind: "audio" });
        expect(layout.slotOrder.filter((s) => s.kind === "lyrics")).toHaveLength(1);
        // Band stays inside the canvas with side margins.
        expect(layout.band.x).toBeGreaterThan(0);
        expect(layout.band.x + layout.band.w).toBeLessThan(1920);
        expect(layout.band.y + layout.band.h).toBeLessThanOrEqual(1080);
    });
    test("position moves the band; chunk count adds lyric slots", () => {
        const top = (0, plan_1.buildLyricLayout)({ canvasW: 1920, canvasH: 1080, position: "top", textScale: 1, chunkCount: 1 });
        const bottom = (0, plan_1.buildLyricLayout)({ canvasW: 1920, canvasH: 1080, position: "bottom", textScale: 1, chunkCount: 1 });
        expect(top.band.y).toBeLessThan(bottom.band.y);
        const two = (0, plan_1.buildLyricLayout)({ canvasW: 1920, canvasH: 1080, position: "middle", textScale: 1, chunkCount: 2 });
        expect((0, dsl_1.validateM0String)(two.m0).ok).toBe(true);
        expect(two.slotOrder.filter((s) => s.kind === "lyrics")).toHaveLength(2);
    });
});
describe("buildLyricDocument", () => {
    const BASE_ARGS = {
        canvasW: 1280,
        canvasH: 720,
        fps: 30,
        durationMs: 183_000,
        song: { path: "/fixtures/song.mp3", assetMediaType: "audio" },
        windows: [win(0, 5000, "First line I sing"), win(5000, 183_000, "Second line")],
        style: STYLE,
    };
    const docOf = (args) => (0, plan_1.buildLyricDocument)(args);
    test("no background: lavfi base, text band, audio leaf last — valid m0, authored duration", () => {
        const doc = docOf(BASE_ARGS);
        expect((0, dsl_1.validateM0String)(doc.m0).ok).toBe(true);
        expect(doc.durationMs).toBe(183_000);
        expect(doc.size).toEqual({ width: 1280, height: 720 });
        expect(doc.sources).toHaveLength(3);
        expect(doc.sources[0].type).toBe("lavfi");
        expect(doc.sources[0].color).toBe("#000000");
        expect(doc.sources[1].type).toBe("text");
        expect(doc.sources[1].layers).toHaveLength(2);
        const audio = doc.sources[2];
        expect(audio).toMatchObject({
            type: "media",
            mediaType: "audio",
            audio: { enabled: true, volume: 1 },
        });
        const songAsset = Object.values(doc.assets).find((a) => a.path === "/fixtures/song.mp3");
        expect(songAsset?.mediaType).toBe("audio");
    });
    test("background video shorter than the song loops; images do not get playback", () => {
        const withVideo = docOf({
            ...BASE_ARGS,
            background: { path: "/fixtures/bg.mp4", mediaType: "video", durationMs: 4000 },
        });
        expect(withVideo.sources[0]).toMatchObject({
            type: "media",
            mediaType: "video",
            placement: { fit: "cover" },
            playback: { clipStartMs: 0, clipDurationMs: 4000, loopMode: "loop" },
            audio: { enabled: false },
        });
        const withImage = docOf({
            ...BASE_ARGS,
            background: { path: "/fixtures/bg.png", mediaType: "image" },
        });
        expect(withImage.sources[0].playback).toBeUndefined();
        expect(withImage.sources[0].mediaType).toBe("image");
    });
    test("61 lines yield two text sources between base and audio", () => {
        const windows = Array.from({ length: plan_1.LAYERS_PER_TEXT_SOURCE + 1 }, (_, i) => win(i * 1000, i * 1000 + 900));
        const doc = docOf({ ...BASE_ARGS, windows });
        expect(doc.sources).toHaveLength(4);
        expect(doc.sources[1].type).toBe("text");
        expect(doc.sources[2].type).toBe("text");
        expect(doc.sources[1].layers).toHaveLength(plan_1.LAYERS_PER_TEXT_SOURCE);
        expect(doc.sources[2].layers).toHaveLength(1);
        expect(doc.sources[3].mediaType).toBe("audio");
    });
    test("LAYOUT CONTRACT: an over-wide line wraps into extra layers, never off-frame", () => {
        const doc = docOf({
            ...BASE_ARGS,
            windows: [win(0, 5000, "Every single line shows up right on time (right on time, on time)")],
        });
        const text = doc.sources[1];
        expect(text.layers.length).toBeGreaterThan(1);
        for (const layer of text.layers) {
            expect(layer.content.text).not.toContain("\n");
        }
    });
    test("wrapped lines count toward the chunk budget", () => {
        // Each of these wraps to 2 lines at this canvas: 31 windows = 62 layers → 2 text sources.
        const longLine = "Every single line shows up right on time (right on time, on time)";
        const windows = Array.from({ length: plan_1.LAYERS_PER_TEXT_SOURCE / 2 + 1 }, (_, i) => win(i * 1000, i * 1000 + 900, longLine));
        const doc = docOf({ ...BASE_ARGS, windows });
        expect(doc.sources).toHaveLength(4);
        expect(doc.sources[1].type).toBe("text");
        expect(doc.sources[2].type).toBe("text");
    });
    test("deterministic — identical args produce identical documents", () => {
        expect(JSON.stringify((0, plan_1.buildLyricDocument)(BASE_ARGS))).toBe(JSON.stringify((0, plan_1.buildLyricDocument)(BASE_ARGS)));
    });
});
