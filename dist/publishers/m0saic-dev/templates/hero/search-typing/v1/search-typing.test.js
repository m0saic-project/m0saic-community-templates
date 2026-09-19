"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@m0saic/types");
const schema_1 = require("./schema");
const search_typing_1 = require("./search-typing");
const timeline_1 = require("./timeline");
const layout_1 = require("./layout");
const boxes_1 = require("./boxes");
/** This template always returns a plain document (never a pipeline). */
const renderDoc = async (props, ctx) => (await search_typing_1.SearchTyping.render(props, ctx));
/** Unpinned ctx: output.durationMs at the engine default so the template is
 *  free to recommend its natural duration (resolvePinnedDurationMs). */
const ctxFor = (width = 1280, height = 400, opts = {}) => {
    const target = { width, height, fps: 30, durationMs: types_1.DEFAULT_DURATION_MS };
    return {
        mode: "render",
        target,
        output: { ...target, workspaceDir: "/tmp/search-typing-test" },
        media: {},
        ...(opts.pinnedMs != null ? { userIntent: { durationMs: opts.pinnedMs } } : {}),
    };
};
// The real-geometry doc orders sources by placeRects layer packing, so
// tests discover sources by SIGNATURE, never by index.
const sourcesOf = (doc) => doc.sources;
const maskedOf = (doc) => sourcesOf(doc).filter((s) => s.mask != null);
const stripsOf = (doc) => sourcesOf(doc)
    .filter((s) => s.mask != null && s.overlay?.window != null)
    .sort((a, b) => (a.overlay?.window?.startSec ?? 0) - (b.overlay?.window?.startSec ?? 0));
const tracksOf = (doc) => sourcesOf(doc).filter((s) => (s.lavfi ?? "").includes("drawbox"));
const coverTrackOf = (doc, cardColor = "#ffffff") => tracksOf(doc).find((s) => (s.lavfi ?? "").includes(`color=${cardColor}`));
const underlineTrackOf = (doc) => tracksOf(doc).find((s) => (s.lavfi ?? "").includes(":h=2:"));
const caretTrackOf = (doc) => tracksOf(doc).find((s) => !(s.lavfi ?? "").includes(":h=2:") && !(s.lavfi ?? "").includes("color=#ffffff"));
describe("SearchTyping — real-geometry composition", () => {
    it("registers under the planned id with the schema defaults", () => {
        expect(search_typing_1.SearchTyping.id).toBe(schema_1.SEARCH_TYPING_ID);
        expect(search_typing_1.SearchTyping.defaultProps).toBe(schema_1.defaultProps);
    });
    it("places card, icon, label, 5 strips, cover, underline as real cells (10 sources)", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        expect(doc.format).toEqual({ kind: "video", container: "mp4" });
        expect(doc.sources).toHaveLength(10);
        // The m0 is a real placed-cell program now, not a bare overlay stack.
        expect(String(doc.m0).length).toBeGreaterThan(20);
        // icon + label + 5 strips carry masks; the card is a real bg fill
        // (rounding effect, no mask) and the 2 tracks are drawbox chains.
        expect(maskedOf(doc)).toHaveLength(7);
        expect(tracksOf(doc)).toHaveLength(2);
        expect(stripsOf(doc)).toHaveLength(5);
    });
    it("every mask is CELL-LOCAL: bounds at origin, sized to its own cell", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        for (const source of maskedOf(doc)) {
            const bounds = source.mask?.bounds;
            expect(bounds?.x).toBe(0);
            expect(bounds?.y).toBe(0);
            expect(bounds?.width).toBeGreaterThan(0);
            expect(bounds?.height).toBeGreaterThan(0);
            expect(bounds?.width).toBeLessThanOrEqual(1280);
            expect(bounds?.height).toBeLessThanOrEqual(400);
        }
    });
    it("the card is a REAL bg fill with SVG-rounded corners in both frame modes", async () => {
        const fill = await renderDoc(schema_1.defaultProps, ctxFor());
        const fillCard = sourcesOf(fill).find((s) => s.color === "#ffffff" && s.mask == null && !(s.lavfi ?? "").includes("drawbox"));
        // fill: bar == canvas 1280×400 → borderRadius = 2·16/400.
        expect(fillCard?.effects?.rounding).toMatchObject({
            cornerStyle: "rounded",
            borderRadius: 32 / 400,
            rasterizer: "svg",
        });
        const card = await renderDoc({ ...schema_1.defaultProps, frame: "card" }, ctxFor());
        const cardTile = sourcesOf(card).find((s) => s.color === "#ffffff" && s.mask == null && !(s.lavfi ?? "").includes("drawbox"));
        // card: grid-authored 792×200 bar → borderRadius = 2·16/200.
        expect(cardTile?.effects?.rounding).toMatchObject({
            cornerStyle: "rounded",
            borderRadius: 32 / 200,
            rasterizer: "svg",
        });
    });
    it("windows every word strip to its band (R4)", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        const strips = stripsOf(doc);
        let lastStart = -1;
        for (const strip of strips) {
            const window = strip.overlay?.window;
            expect(window?.startSec).toBeGreaterThan(lastStart);
            expect(window?.endSec).toBeGreaterThan(window?.startSec);
            lastStart = window?.startSec;
        }
        // The held last word's strip runs to the clip end, minus the 1ms
        // end-inclusive-between() trim.
        expect(strips[4].overlay?.window?.endSec).toBeCloseTo(18.169, 9);
    });
    it("no source anywhere carries SVG arcs (the card mask was the last one)", async () => {
        const doc = await renderDoc({ ...schema_1.defaultProps, frame: "card" }, ctxFor());
        for (const source of maskedOf(doc)) {
            const localPath = source.mask?.localPath ?? "";
            expect(localPath).not.toMatch(/A/);
        }
    });
    it("renders card mode deterministically at a pinned duration", async () => {
        const props = { ...schema_1.defaultProps, frame: "card" };
        const a = await renderDoc(props, ctxFor(1280, 400, { pinnedMs: 12000 }));
        const b = await renderDoc(props, ctxFor(1280, 400, { pinnedMs: 12000 }));
        expect(a).toEqual(b);
    });
    it("the cover track paints the EXACT card color with replace=1 and no geq", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        const cover = coverTrackOf(doc);
        expect(cover).toBeDefined();
        expect(cover?.lavfi).toContain("replace=1");
        expect(cover?.lavfi).not.toContain("geq");
        const underline = underlineTrackOf(doc);
        expect(underline?.lavfi).toContain("color=#9AA0A6");
        expect(underline?.lavfi).toContain("replace=1");
    });
    it("no drawtext or geq in ANY source's filter chain (caret on)", async () => {
        const doc = await renderDoc({ ...schema_1.defaultProps, caret: { ...schema_1.defaultProps.caret, show: true } }, ctxFor());
        for (const source of sourcesOf(doc)) {
            expect(source.type).toBe("lavfi");
            const lavfi = source.lavfi ?? "";
            expect(lavfi).not.toContain("drawtext");
            expect(lavfi).not.toContain("geq");
        }
    });
    it("gated tracks carry the right union windows (frame-0 guard on the cover)", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        const t = (0, timeline_1.buildTypingTimeline)(schema_1.defaultProps.words, schema_1.defaultProps.timing, "hold", { fps: 30 });
        // Cover: word 0's lt-gates have no fromSec → union startSec MUST be
        // omitted so the curtain composites from t=0 (no gate flip at frame 0).
        const cover = coverTrackOf(doc);
        expect(cover?.overlay?.window?.startSec).toBeUndefined();
        const lastBand = t.bands[t.bands.length - 1];
        expect(cover?.overlay?.window?.endSec).toBeCloseTo(lastBand.typedAtSec, 2);
        const underline = underlineTrackOf(doc);
        expect(underline?.overlay?.window?.startSec).toBeCloseTo(t.bands[0].chars[0].typeAtSec, 3);
        expect(underline?.overlay?.window?.endSec).toBeCloseTo(t.durationSec, 3);
    });
    it("the caret track is an ink replace=1 drawbox chain with one box per built caret", async () => {
        const doc = await renderDoc({ ...schema_1.defaultProps, caret: { ...schema_1.defaultProps.caret, show: true } }, ctxFor());
        const caretTrack = caretTrackOf(doc);
        expect(caretTrack).toBeDefined();
        expect(caretTrack?.lavfi).toContain("color=#9AA0A6");
        expect(caretTrack?.lavfi).toContain("replace=1");
        expect(caretTrack?.lavfi).toContain("enable=");
        const t = (0, timeline_1.buildTypingTimeline)(schema_1.defaultProps.words, schema_1.defaultProps.timing, "hold", { fps: 30 });
        const layout = (0, layout_1.computeLayout)({
            canvasW: 1280,
            canvasH: 400,
            words: schema_1.defaultProps.words,
            label: schema_1.defaultProps.label,
            frame: schema_1.defaultProps.frame,
            showIcon: true,
            barWidthFrac: schema_1.defaultProps.style.barWidthFrac,
            barAspect: schema_1.defaultProps.style.barAspect,
            cornerRadiusPx: schema_1.defaultProps.style.cornerRadiusPx,
        });
        const expected = (0, boxes_1.buildCaretBoxes)(t, layout, schema_1.defaultProps.caret);
        expect(caretTrack?.lavfi?.match(/drawbox/g) ?? []).toHaveLength(expected.length);
    });
    it("clamps a strip's window to its band start when the empty hold is sub-frame", async () => {
        const timing = { ...schema_1.defaultProps.timing, emptyHoldMs: 10 };
        const doc = await renderDoc({ ...schema_1.defaultProps, timing }, ctxFor());
        const t = (0, timeline_1.buildTypingTimeline)(schema_1.defaultProps.words, timing, "hold", { fps: 30 });
        const strips = stripsOf(doc);
        for (let k = 1; k < strips.length; k++) {
            // The 10ms empty hold is shorter than the half-frame eps — the strip
            // must not open before its band's covers arm.
            expect(strips[k].overlay?.window?.startSec).toBeCloseTo(t.bands[k].startSec, 9);
        }
    });
    it("caret adds one track; underline none removes one; 8 words stay ≤ 15 sources", async () => {
        const withCaret = await renderDoc({ ...schema_1.defaultProps, caret: { ...schema_1.defaultProps.caret, show: true } }, ctxFor());
        expect(withCaret.sources).toHaveLength(11);
        const noUnderline = await renderDoc({ ...schema_1.defaultProps, underline: "none" }, ctxFor());
        expect(noUnderline.sources).toHaveLength(9);
        const maxWords = await renderDoc({
            ...schema_1.defaultProps,
            words: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"],
            caret: { ...schema_1.defaultProps.caret, show: true },
        }, ctxFor());
        expect(maxWords.sources.length).toBeLessThanOrEqual(15);
    });
    it("drops icon and label cells when hidden — card + strips + cover remain", async () => {
        const doc = await renderDoc({
            ...schema_1.defaultProps,
            label: "",
            icon: { show: false },
            underline: "none",
        }, ctxFor());
        expect(doc.sources).toHaveLength(7);
        expect(maskedOf(doc)).toHaveLength(5); // 5 strips (the card is unmasked)
        expect(tracksOf(doc)).toHaveLength(1); // cover only
    });
    it("puts the page color on document.backgroundColor (never a base overlay)", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        expect(doc.backgroundColor).toBe("#F2F3F5");
    });
    it("derives the natural duration from the timeline (41 default chars → 18170ms)", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor());
        expect(doc.durationMs).toBe(18170);
        expect(doc.size).toEqual({ width: 1280, height: 400 });
        expect(doc.fps).toBe(30);
        expect(doc.audio).toEqual({ mode: "off" });
    });
    it("fits a pinned duration exactly", async () => {
        const doc = await renderDoc(schema_1.defaultProps, ctxFor(1280, 400, { pinnedMs: 8000 }));
        expect(doc.durationMs).toBe(8000);
    });
    it("maps invalid props to an error mosaic instead of throwing", async () => {
        const doc = await renderDoc({ ...schema_1.defaultProps, words: [] }, ctxFor());
        expect(doc.format).toEqual({ kind: "image", container: "png" });
    });
    it("maps an impossible fit to an error mosaic", async () => {
        const doc = await renderDoc({ ...schema_1.defaultProps, words: ["WWWWWWWWWWWWWWWWWWWWWWWW"] }, ctxFor(400, 100));
        expect(doc.format).toEqual({ kind: "image", container: "png" });
    });
    it("renders deterministically", async () => {
        const a = await renderDoc(schema_1.defaultProps, ctxFor());
        const b = await renderDoc(schema_1.defaultProps, ctxFor());
        expect(a).toEqual(b);
    });
    it("renders deterministically with caret on at a pinned duration", async () => {
        const props = { ...schema_1.defaultProps, caret: { ...schema_1.defaultProps.caret, show: true } };
        const a = await renderDoc(props, ctxFor(1280, 400, { pinnedMs: 12000 }));
        const b = await renderDoc(props, ctxFor(1280, 400, { pinnedMs: 12000 }));
        expect(a).toEqual(b);
    });
});
describe("gate-27 pre-audit locks", () => {
    it("PORTRAIT defaults render a REAL doc, not the error card (metric-base cap)", async () => {
        // 720×1280 fill mode: barH-scaled pads+icon used to exceed the bar width
        // (~900px of overhead in a 720px bar) so even the 14px floor threw and
        // DEFAULTS error-carded. The metric base caps at 0.6·barW when the bar
        // is taller than wide.
        const doc = await renderDoc({}, ctxFor(720, 1280));
        expect(String(doc.format?.kind)).toBe("video");
        const texts = JSON.stringify(doc.sources);
        expect(texts).not.toContain("ERROR");
        expect(doc.audio?.mode).toBe("off");
    });
    it("icon sizing: landscape keeps the approved metric size; constrained canvases em-cap", () => {
        const fillInput = {
            words: ["Ideas", "Answers", "Templates", "Tutorials", "Inspiration"],
            label: "Search for",
            frame: "fill",
            showIcon: true,
            barWidthFrac: 0.62,
            barAspect: 0.26,
            cornerRadiusPx: 16,
        };
        // Landscape default: metric icon (0.42·barH = 168) is UNDER the 2em cap
        // (font ~89) — the approved look stays byte-identical.
        const land = (0, layout_1.computeLayout)({ ...fillInput, canvasW: 1280, canvasH: 400 });
        expect(land.icon ? land.icon.w : 0).toBe(Math.round(0.42 * land.bar.h));
        // Square + portrait: the em cap binds — the magnifier tracks the
        // RESOLVED font (was 19.9×/5.2× the font pre-fix), and the freed
        // overhead lets the font resolve LARGER.
        for (const [w, h] of [[1080, 1080], [720, 1280]]) {
            const layout = (0, layout_1.computeLayout)({ ...fillInput, canvasW: w, canvasH: h });
            const iconW = layout.icon ? layout.icon.w : 0;
            expect(iconW).toBe(Math.round(2 * layout.fontSize));
            expect(iconW / layout.fontSize).toBeLessThanOrEqual(2.05);
        }
    });
    it("the ERROR document disables audio (silent-track class via split-mux)", async () => {
        // Force the words-cap fail-fast; the card must carry audio:{enabled:false}
        // so a video render of it never muxes the anullsrc silence default.
        const doc = await renderDoc({ words: ["supercalifragilisticexpialidocious"] }, ctxFor(1280, 400));
        expect(JSON.stringify(doc.sources)).toContain("at most 24 chars");
        expect(doc.audio?.mode).toBe("off");
    });
    it("declares NO cover — founder ruling gate-27 take 1 (the typing bar is its own face)", () => {
        expect(search_typing_1.SearchTyping.renderCover).toBeUndefined();
    });
});
describe("gate-27 stress catch: hint-echo is not a pin", () => {
    it("a ctx duration equal to outputHints (host seeding) leaves custom timing at natural cadence", async () => {
        const target = { width: 1280, height: 400, fps: 30, durationMs: 18170 };
        const ctx = {
            mode: "render",
            target,
            output: { ...target, workspaceDir: "/tmp/search-typing-test" },
            media: {},
        };
        const fast = await renderDoc({ timing: { typeCharMs: 30, deleteCharMs: 20, emptyHoldMs: 100, wordHoldMs: 200, leadMs: 100, trailMs: 100 } }, ctx);
        // Natural cadence for the fast timing is ~3.5s — NOT stretched to 18.17s.
        expect(fast.durationMs).toBeLessThan(6000);
    });
    it("an EXPLICIT ask of exactly 18170 still pins (userIntent wins)", async () => {
        const doc = await renderDoc({ timing: { typeCharMs: 30, deleteCharMs: 20, emptyHoldMs: 100, wordHoldMs: 200, leadMs: 100, trailMs: 100 } }, ctxFor(1280, 400, { pinnedMs: 18170 }));
        expect(doc.durationMs).toBe(18170);
    });
});
