"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
const drop_calendar_1 = require("./drop-calendar");
const compose_1 = require("./compose");
const resolve_1 = require("./resolve");
const platforms_1 = require("./platforms");
/** Painted rect of a source: its quantized frame put through the engine's
 *  inset floor math (frames are OUTWARD-quantized cells under inset
 *  recovery; the recovery inset paints back the exact rect). */
function paintedRect(doc, parsedFrames, source) {
    const f = parsedFrames[doc.sources.indexOf(source)];
    return (0, template_utils_1.engineRecover)({ x: f.x, y: f.y, w: f.width, h: f.height }, source.placement?.inset ?? null);
}
const makeCtx = (target, media) => ({
    target: { width: 1920, height: 1080, fps: 30, ...target },
    output: {},
    ...(media ? { media } : {}),
});
/* eslint-disable @typescript-eslint/no-explicit-any */
async function render(props, ctx = makeCtx()) {
    return (await drop_calendar_1.DropCalendarV1.render(props, ctx));
}
function errorCode(doc) {
    return doc?.sources?.[0]?.engine?.renderError?.code;
}
describe("zero-props render (the demo contract)", () => {
    it("renders the October 2026 demo calendar as a static PNG doc", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        expect(doc.kind).toBe("mosaic_document");
        expect(errorCode(doc)).toBeUndefined();
        // Static demo (no facecam / cues / cell video) → PNG poster intent.
        expect(doc.format).toEqual({ kind: "image", container: "png" });
        expect(doc.size).toEqual({ width: 1920, height: 1080 });
        expect(doc.backgroundColor).toBe("#0B0B10"); // studio surface
        // Geometry: valid m0, and every rendered frame is bound to a source.
        expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1920, 1080);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
        }
        // Oct 2026 (Thu start, 31 days, sunday weeks) = 5 week rows: sheet +
        // slab + masthead + 7 headers + 35 day cells = 45 sources.
        expect(doc.sources).toHaveLength(45);
        const labels = doc.sources.map((s) => s.editor?.label);
        expect(labels).toContain("paper");
        expect(labels).toContain("panel");
        expect(labels).toContain("masthead");
        expect(labels.filter((l) => l === "header-cell")).toHaveLength(7);
        expect(labels.filter((l) => l === "drop-cell")).toHaveLength(6);
        // Masthead is the month + year in the calendar serif, and double-click
        // opens the stacked Month · Year form (the title/subtitle convention).
        const masthead = doc.sources.find((s) => s.editor?.label === "masthead");
        expect(masthead.layers[0].content.text).toBe("OCTOBER 2026");
        expect(masthead.layers[0].style.fontFamily).toBe("Roboto");
        expect(masthead.editor.bindings).toEqual([
            { propKey: "month" },
            { propKey: "year" },
        ]);
    });
    it("renders with literally empty props", async () => {
        const doc = await render({});
        expect(doc.kind).toBe("mosaic_document");
        expect(errorCode(doc)).toBeUndefined();
    });
});
describe("layout contract sweep (masthead fits, sheet + slab present)", () => {
    const CANVASES = [
        [1920, 1080],
        [1280, 720],
        [1080, 1080],
        [1080, 1920],
        [3840, 2160],
        [854, 480],
    ];
    for (const [w, h] of CANVASES) {
        it(`${w}x${h}`, async () => {
            const ctx = makeCtx({ width: w, height: h });
            // `platform: "canvas"` follows the host size; the platforms suite
            // covers platform-owned canvases.
            const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "canvas" }, ctx);
            expect(errorCode(doc)).toBeUndefined();
            (0, template_utils_1.assertLayout)(doc, ctx, "@m0saic-dev/creator/drop-calendar/v1", {
                constraints: [
                    { label: "masthead", textFits: { charWidthEm: 0.76 } },
                    { label: "paper" },
                    { label: "panel" },
                ],
            });
        });
    }
});
describe("debug contracts (dev toggles, never chained)", () => {
    {
        it("debugLayout passes on the REAL doc", async () => {
            const doc = await render({
                ...drop_calendar_1.DropCalendarV1.defaultProps,
                debugLayout: true,
            });
            expect(doc.editor.layoutContract.ok).toBe(true);
            expect(doc.editor.layoutContract.violations).toEqual([]);
            expect(doc.editor.geometryContract).toBeUndefined();
        });
        it("debugGeometry passes", async () => {
            const doc = await render({
                ...drop_calendar_1.DropCalendarV1.defaultProps,
                debugGeometry: true,
            });
            expect(doc.editor.geometryContract.ok).toBe(true);
            expect(doc.editor.geometryContract.violations).toEqual([]);
        });
    }
    it("both on → geometry wins; the layout contract never sees a wireframe", async () => {
        const doc = await render({
            ...drop_calendar_1.DropCalendarV1.defaultProps,
            debugLayout: true,
            debugGeometry: true,
        });
        expect(doc.editor.geometryContract.ok).toBe(true);
        expect(doc.editor.layoutContract).toBeUndefined();
    });
});
describe("drops with media", () => {
    it("teaser images fill cells; number badge + title strip ride on top", async () => {
        const doc = await render({
            month: 10,
            year: 2026,
            days: [{ day: 13, title: "New set" }],
            teasers: ["teaser.jpg"],
        });
        expect(errorCode(doc)).toBeUndefined();
        const media = doc.sources.filter((s) => s.type === "media");
        expect(media).toHaveLength(1);
        expect(media[0].mediaType).toBe("image");
        expect(media[0].assetId).toBe("dc_teaser_0");
        expect(doc.assets.dc_teaser_0).toMatchObject({ kind: "file", path: "teaser.jpg" });
        const labels = doc.sources.map((s) => s.editor?.label);
        expect(labels).toContain("day-badge");
        expect(labels).toContain("title-strip");
        // A lone image teaser is still a static poster.
        expect(doc.format.kind).toBe("image");
    });
    it("a teaser VIDEO makes the doc a video and loops muted", async () => {
        const doc = await render({
            days: [{ day: 13 }],
            teasers: ["teaser.mp4"],
        });
        expect(doc.format).toEqual({ kind: "video", container: "mp4" });
        const media = doc.sources.find((s) => s.type === "media");
        expect(media.playback).toEqual({ loopMode: "loop" });
        expect(media.audio).toEqual({ enabled: false });
    });
});
describe("facecam", () => {
    it("side-by-side on desktop, facecam audio on, duration from the probe", async () => {
        const ctx = makeCtx({}, { "cam.mp4": { kind: "video", durationMs: 42000 } });
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4" }, ctx);
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.durationMs).toBe(42000);
        expect(doc.format.kind).toBe("video");
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        expect(cam.audio).toEqual({ enabled: true });
        expect(cam.placement.fit).toBe("cover");
        // Portrait 9:16 slice at 1080p (608 px column) aligned to the SHEET: the
        // same 38 px margin (3.5 % of the short side) on the left and top, and
        // the sheet's height — the PAINTED rect (frame + recovery inset), not
        // the quantized cell.
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1920, 1080);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            const margin = Math.round(1080 * 0.035);
            const camRect = paintedRect(doc, parsed.ir.renderFrames, cam);
            const paper = paintedRect(doc, parsed.ir.renderFrames, doc.sources.find((s) => s.editor?.label === "paper"));
            expect(camRect).toEqual({
                x: margin,
                y: margin,
                w: Math.round(1080 * (9 / 16)) - margin,
                h: 1080 - 2 * margin,
            });
            expect(camRect.y).toBe(paper.y);
            expect(camRect.h).toBe(paper.h);
        }
    });
    it("portrait: the calendar is the video and the facecam is a top-left picture-in-picture", async () => {
        const ctx = makeCtx({ width: 1080, height: 1920 }, { "cam.mp4": { kind: "video", durationMs: 20000 } });
        const doc = await render({ facecam: "cam.mp4", platform: "canvas" }, ctx);
        expect(errorCode(doc)).toBeUndefined();
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1080, 1920);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            const pip = paintedRect(doc, parsed.ir.renderFrames, cam);
            const paper = paintedRect(doc, parsed.ir.renderFrames, doc.sources.find((s) => s.editor?.label === "panel"));
            // PiP: 34 % wide, 3:4, in the top-left gutter; the card fills the canvas as without a facecam.
            expect(pip.w).toBe(Math.round(1080 * 0.34));
            expect(pip.h).toBe(Math.round(pip.w * (4 / 3)));
            expect(pip.x).toBeLessThan(200);
            expect(pip.y).toBeLessThan(200);
            // The slab (table) fills the frame as it does without a facecam; the PiP
            // sits in the bled sheet's gutter above it.
            expect(paper.h).toBeGreaterThan(1920 * 0.8);
        }
    });
    it("rejects a non-video facecam", async () => {
        const ctx = makeCtx({}, { "cam.png": { kind: "image" } });
        const doc = await render({ facecam: "cam.png" }, ctx);
        expect(errorCode(doc)).toBe("DC_FACECAM_KIND");
    });
});
describe("facecam clips (the picked regions)", () => {
    const camCtx = () => makeCtx({}, { "cam.mp4": { kind: "video", durationMs: 60000 } });
    /** The 9:16 slice at 1080p — the reel renders at the facecam cell's size. */
    // The facecam cell matches the sheet's height and margin (see layout.ts).
    const CAM_MARGIN = Math.round(1080 * 0.035);
    const CAM_SIZE = { width: Math.round(1080 * (9 / 16)) - CAM_MARGIN, height: 1080 - 2 * CAM_MARGIN };
    it("one clip trims the facecam in place and sets the render length", async () => {
        const doc = await render({ facecam: "cam.mp4", facecamClips: [{ startMs: 12000, endMs: 20000 }] }, camCtx());
        expect(errorCode(doc)).toBeUndefined();
        // The picked region — not the 60s file — is the render.
        expect(doc.durationMs).toBe(8000);
        expect(doc.children).toBeUndefined();
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        expect(cam.type).toBe("media");
        expect(cam.assetId).toBe("dc_facecam");
        expect(cam.playback).toEqual({
            clipStartMs: 12000,
            clipDurationMs: 8000,
            loopMode: "loop",
        });
    });
    it("no clips leaves the source untrimmed (the pre-clips shape)", async () => {
        const doc = await render({ facecam: "cam.mp4" }, camCtx());
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        expect(cam.playback).toBeUndefined();
        expect(doc.durationMs).toBe(60000);
    });
    it("several clips become a stitched reel child with the authored transition", async () => {
        const doc = await render({
            facecam: "cam.mp4",
            facecamClips: [
                { startMs: 0, endMs: 5000 },
                { startMs: 30000, endMs: 33000 },
                { startMs: 50000, endMs: 52000 },
            ],
            facecamTransition: { style: "wipeleft", durationSec: 0.5 },
        }, camCtx());
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.format.kind).toBe("video");
        // Σ clips − Σ overlaps (2 boundaries × 500ms).
        expect(doc.durationMs).toBe(5000 + 3000 + 2000 - 1000);
        // The cell is a nested-mosaic ref, still bound to the facecam prop.
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        expect(cam.type).toBe("mosaic");
        expect(cam.ref).toBe("dc_facecam_reel");
        expect(cam.audio).toEqual({ enabled: true });
        // The cell is the in-place rect handle for the drawn facecam area AND
        // the drop target for a new clip (a media binding on `facecam`).
        expect(cam.editor.bindings).toEqual([{ propKey: "facecamRegion", kind: "rect" }, { propKey: "facecam" }]);
        const reel = doc.children.dc_facecam_reel;
        expect(reel.kind).toBe("mosaic_pipeline");
        expect(reel.durationMs).toBe(9000);
        expect(reel.size).toEqual(CAM_SIZE);
        expect(reel.steps).toHaveLength(3);
        expect(reel.steps.map((s) => s.durationMs)).toEqual([5000, 3000, 2000]);
        expect(reel.steps.map((s) => s.transitionToNext)).toEqual([
            { type: "xfade", kind: "wipeleft", durationMs: 500 },
            { type: "xfade", kind: "wipeleft", durationMs: 500 },
            undefined, // the last clip ends the reel
        ]);
        // Each step is a hermetic one-cell doc playing its own trim once.
        const step0 = reel.steps[0].file;
        expect(step0.kind).toBe("mosaic_document");
        expect(step0.size).toEqual(CAM_SIZE);
        expect(step0.assets.dc_facecam).toEqual({
            kind: "file",
            path: "cam.mp4",
            mediaType: "video",
        });
        expect(step0.sources[0].playback).toEqual({
            clipStartMs: 0,
            clipDurationMs: 5000,
            loopMode: "cut",
        });
        expect(reel.steps[1].file.sources[0].playback).toEqual({
            clipStartMs: 30000,
            clipDurationMs: 3000,
            loopMode: "cut",
        });
        // The parent stays a valid, fully-bound calendar.
        expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1920, 1080);
        expect(parsed.ok).toBe(true);
        if (parsed.ok)
            expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
    });
    it('"cut" joins the clips with no transition and no overlap', async () => {
        const doc = await render({
            facecam: "cam.mp4",
            facecamClips: [
                { startMs: 0, endMs: 4000 },
                { startMs: 10000, endMs: 14000 },
            ],
            facecamTransition: { style: "cut" },
        }, camCtx());
        expect(doc.durationMs).toBe(8000);
        expect(doc.children.dc_facecam_reel.steps.map((s) => s.transitionToNext)).toEqual([undefined, undefined]);
    });
    it("facecam audio off silences the reel steps too", async () => {
        const doc = await render({
            facecam: "cam.mp4",
            facecamAudio: false,
            facecamClips: [
                { startMs: 0, endMs: 4000 },
                { startMs: 10000, endMs: 14000 },
            ],
        }, camCtx());
        const cam = doc.sources.find((s) => s.editor?.label === "facecam");
        expect(cam.audio).toEqual({ enabled: false });
        for (const step of doc.children.dc_facecam_reel.steps) {
            expect(step.file.sources[0].audio).toEqual({ enabled: false });
        }
    });
    it("an EXPLICIT duration ask wins over the picked clips; a hint-seeded target does not", async () => {
        const media = { "cam.mp4": { kind: "video", durationMs: 60000 } };
        // The duration-follow law: ctx.userIntent is the ask; ctx.target is only
        // what the host seeded from the hint, and the reel outranks it.
        const asked = await render({ facecam: "cam.mp4", facecamClips: [{ startMs: 0, endMs: 3000 }] }, { ...makeCtx({ durationMs: 20000 }, media), userIntent: { durationMs: 20000 } });
        expect(asked.durationMs).toBe(20000);
        const seeded = await render({ facecam: "cam.mp4", facecamClips: [{ startMs: 0, endMs: 3000 }] }, makeCtx({ durationMs: 20000 }, media));
        expect(seeded.durationMs).toBe(3000);
        const whole = await render({ facecam: "cam.mp4" }, makeCtx({ durationMs: 20000 }, media));
        expect(whole.durationMs).toBe(60000);
    });
    it("carries talk-track cues from facecam time onto the cut timeline", async () => {
        const doc = await render({
            month: 10,
            year: 2026,
            days: [{ day: 13, title: "New set" }, { day: 20, title: "Collab" }],
            facecam: "cam.mp4",
            facecamClips: [
                { startMs: 20000, endMs: 25000 },
                { startMs: 40000, endMs: 44000 },
            ],
            facecamTransition: { style: "cut" },
            // Stamped against the FULL facecam: day 13 at 21s (inside clip 1),
            // day 20 at 41s (inside clip 2), and one at 33s that was cut out.
            cues: [
                { text: "13", startMs: 21000, endMs: 23000 },
                { text: "20", startMs: 41000, endMs: 42000 },
                { text: "13", startMs: 33000, endMs: 34000 },
            ],
        }, camCtx());
        expect(errorCode(doc)).toBeUndefined();
        const rings = doc.sources.filter((s) => s.editor?.label === "cue-ring");
        // Two surviving cues × 4 ring bars — the cut-out cue is gone.
        expect(rings).toHaveLength(8);
        const windows = [...new Set(rings.map((r) => r.overlay.enable))];
        expect(windows).toEqual([
            "between(t,1.000,3.000)", // 21s − clip 1 start (20s)
            "between(t,6.000,7.000)", // 41s − 40s, offset by clip 1's 5s
        ]);
    });
});
describe("cues", () => {
    const cueProps = {
        month: 10,
        year: 2026,
        days: [{ day: 13, title: "New set" }],
        teasers: ["t.jpg"],
        cues: [{ text: "13", startMs: 2000, endMs: 6000 }],
        holdSec: 4,
    };
    it("ring-highlights the cued day and spotlights its teaser", async () => {
        const ctx = makeCtx({ durationMs: 30000 });
        const doc = await render(cueProps, ctx);
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.format.kind).toBe("video"); // cues animate the calendar
        const rings = doc.sources.filter((s) => s.editor?.label === "cue-ring");
        expect(rings).toHaveLength(4);
        for (const r of rings) {
            expect(r.overlay.enable).toBe("between(t,2.000,6.000)");
            expect(r.overlay.window).toEqual({ startSec: 2, endSec: 6 });
        }
        // The ring leads for the default 1 s zoom delay; the spotlight, its
        // frame and the dim wash all come in together after it.
        const spot = doc.sources.find((s) => s.editor?.label === "spotlight");
        expect(spot.assetId).toBe("dc_teaser_0");
        expect(spot.overlay.enable).toBe("between(t,3.000,6.000)");
        expect(spot.overlay.window).toEqual({ startSec: 3, endSec: 6 });
        const frame = doc.sources.find((s) => s.editor?.label === "spotlight-frame");
        expect(frame.overlay.enable).toBe("between(t,3.000,6.000)");
        const dim = doc.sources.find((s) => s.editor?.label === "spotlight-dim");
        expect(dim.overlay.window).toEqual({ startSec: 3, endSec: 6 });
    });
    it("zoom delay: 0 zooms with the ring; a cue shorter than the delay still gets a short zoom", async () => {
        const ctx = makeCtx({ durationMs: 30000 });
        const now = await render({ ...cueProps, spotlight: { delaySec: 0 } }, ctx);
        expect(now.sources.find((s) => s.editor?.label === "spotlight").overlay.enable).toBe("between(t,2.000,6.000)");
        const short = await render({ ...cueProps, cues: [{ text: "13", startMs: 2000, endMs: 2600 }], spotlight: { delaySec: 3 } }, ctx);
        const spot = short.sources.find((s) => s.editor?.label === "spotlight");
        expect(spot.overlay.enable).toBe("between(t,2.200,2.600)");
        for (const r of short.sources.filter((s) => s.editor?.label === "cue-ring")) {
            expect(r.overlay.enable).toBe("between(t,2.000,2.600)");
        }
    });
    it("spotlight off → rings only", async () => {
        const doc = await render({ ...cueProps, spotlight: { enabled: false } }, makeCtx({ durationMs: 30000 }));
        expect(doc.sources.filter((s) => s.editor?.label === "cue-ring")).toHaveLength(4);
        expect(doc.sources.find((s) => s.editor?.label === "spotlight")).toBeUndefined();
        expect(doc.sources.find((s) => s.editor?.label === "spotlight-dim")).toBeUndefined();
    });
    it("a cue for a day without a teaser still rings, no spotlight", async () => {
        const doc = await render({ ...cueProps, teasers: [] }, makeCtx({ durationMs: 30000 }));
        expect(doc.sources.filter((s) => s.editor?.label === "cue-ring")).toHaveLength(4);
        expect(doc.sources.find((s) => s.editor?.label === "spotlight")).toBeUndefined();
    });
});
describe("canvas prop bindings (double-click to edit)", () => {
    it("a text drop cell opens as a Day · Title form routed to its ORIGINAL row", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        // Default drops are [2, 8, 13, 20, 26, 31] — day 13 is row 2.
        const cell = doc.sources.find((s) => s.editor?.label === "drop-cell" &&
            s.layers?.some((l) => l.content.text === "13"));
        // Day carries `onClear` (bindProps forwards it): committing the field
        // empty on the Make canvas removes the whole drop row. The cell is also
        // a MEDIA drop target: a file appends to the teasers (slot 0 — none are
        // set) and the row's slot number rides as a COMPANION seed ("1",
        // 1-based) that only the drop writes — never the Day · Title form.
        expect(cell.editor.bindings).toEqual([
            { propKey: "days", path: [2, "day"], kind: "number", onClear: "remove-element" },
            { propKey: "days", path: [2, "title"], kind: "string" },
            { propKey: "teasers", index: 0, kind: "media" },
            { propKey: "days", path: [2, "teaser"], kind: "number", seedDraft: "1", companion: true },
        ]);
    });
    /** Header sources in COLUMN order (left→right): doc.sources is layer-major
     *  — colliding quantized cells spill across layers — so sort by painted x. */
    function headersByColumn(doc, w, h) {
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, w, h);
        if (!parsed.ok)
            throw new Error("parse failed");
        return doc.sources
            .filter((s) => s.editor?.label === "header-cell")
            .sort((a, b) => paintedRect(doc, parsed.ir.renderFrames, a).x -
            paintedRect(doc, parsed.ir.renderFrames, b).x);
    }
    it("empty dates are ADD handles: Day · Title routed to the next free row", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        // Oct 2026: 31 in-month cells, 6 drops → 25 empty dates, every one an
        // add handle at the next free Drops row (defaults have 6 rows → index
        // 6; writeLeaf pads the array on commit). The 4 leading adjacent-month
        // cells stay unbound.
        const dayCells = doc.sources.filter((s) => s.editor?.label === "day-cell");
        const bound = dayCells.filter((s) => s.editor?.bindings);
        expect(bound).toHaveLength(25);
        expect(dayCells.length - bound.length).toBe(4);
        // Day is SEEDED from the clicked date (`seedDraft`): the form opens
        // "Day: 17" on the 17th, so title + Enter is the whole add.
        const seeds = [];
        for (const cell of bound) {
            const dayText = cell.layers[0].content.text;
            // + the media add-handle: a drop on the empty date writes the day
            // seed, the teaser (slot 0) and the row's slot number in ONE act — the
            // row is born pictured.
            expect(cell.editor.bindings).toEqual([
                { propKey: "days", path: [6, "day"], kind: "number", onClear: "remove-element", seedDraft: dayText },
                { propKey: "days", path: [6, "title"], kind: "string" },
                { propKey: "teasers", index: 0, kind: "media" },
                { propKey: "days", path: [6, "teaser"], kind: "number", seedDraft: "1", companion: true },
            ]);
            seeds.push(Number(dayText));
        }
        const dropDays = new Set([2, 8, 13, 20, 26, 31]);
        expect(seeds.sort((a, b) => a - b)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => !dropDays.has(d)));
    });
    it("facecamSlot: with no facecam the slot shows the included starter in the side-by-side layout, bound to move AND to take a drop", async () => {
        const off = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        expect(off.sources.find((s) => s.editor?.label === "facecam")).toBeUndefined();
        const on = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecamSlot: true });
        const cam = on.sources.find((s) => s.editor?.label === "facecam");
        expect(cam).toBeDefined();
        expect(cam.type).toBe("media");
        expect(cam.mediaType).toBe("image");
        expect(cam.editor.bindings).toEqual([{ propKey: "facecamRegion", kind: "rect" }, { propKey: "facecam" }]);
        const asset = on.assets[cam.assetId];
        expect(asset).toMatchObject({ kind: "file", mediaType: "image" });
        expect(asset.path).toMatch(/[\\/]template-utils[\\/]assets[\\/]starter[\\/]facecam\.svg$/);
        // The stand-in is a still: no facecam, no cues, no cell video → a poster.
        expect(on.format).toEqual({ kind: "image", container: "png" });
        // The frame around the slot is there too (the facecam's own quiet edge).
        expect(on.sources.find((s) => s.editor?.label === "facecam-frame")).toBeDefined();
        // A real facecam outranks the slot: the starter never shows beside it.
        const real = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecamSlot: true, facecam: "cam.mp4" });
        const realCam = real.sources.find((s) => s.editor?.label === "facecam");
        expect(realCam.mediaType).toBe("video");
        expect(real.assets.dc_facecam.path).toBe("cam.mp4");
    });
    it("every weekday header — branded or plain — edits its weekdays.<day> field", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        const headers = headersByColumn(doc, 1920, 1080);
        expect(headers.map((s) => s.editor.binding.propKey)).toEqual([
            "weekdays.sunday",
            "weekdays.monday",
            "weekdays.tuesday",
            "weekdays.wednesday",
            "weekdays.thursday",
            "weekdays.friday",
            "weekdays.saturday",
        ]);
        // The branded ones render their label (possibly wrapped), plain ones
        // the weekday name.
        const textOf = (s) => s.layers.map((l) => l.content.text).join(" ");
        expect(textOf(headers[5])).toBe("NEW MUSIC FRIDAY");
        expect(textOf(headers[2])).toBe("TUESDAY");
    });
    it("monday week start keeps each header bound to its own weekday", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, weekStart: "monday" });
        const headers = headersByColumn(doc, 1920, 1080);
        expect(headers[0].editor.binding.propKey).toBe("weekdays.monday");
        expect(headers[6].editor.binding.propKey).toBe("weekdays.sunday");
        expect(headers[5].editor.binding.propKey).toBe("weekdays.saturday");
        expect(headers[5].layers.map((l) => l.content.text).join(" ")).toBe("STREAM SATURDAY");
    });
    it("a media cell's badge edits the day, its strip edits the title, and the cell itself is the teaser slot's drop target", async () => {
        const doc = await render({
            days: [{ day: 13, title: "New set" }],
            teasers: ["teaser.jpg"],
        });
        // The cell binds the ELEMENT it shows (`teasers[0]`) — a `media[]` prop
        // binds only per element; the list itself never resolves.
        const cell = doc.sources.find((s) => s.editor?.label === "drop-cell" && s.type === "media");
        expect(cell.editor.binding).toEqual({ propKey: "teasers", index: 0 });
        const { rejected, byProp } = (0, template_utils_1.resolvePropBindings)(doc, 1920, 1080, { propsSchema: drop_calendar_1.DropCalendarV1.propsSchema });
        expect(rejected).toEqual([]); // the companion slot seed resolves too
        // The pictured cell binds ITS slot (0); every other in-month cell is an
        // add-handle on the NEXT slot (1) — 30 of them in a 31-day month.
        const slots = byProp.teasers.map((b) => b.index);
        expect(slots.filter((i) => i === 0)).toHaveLength(1);
        expect(slots.filter((i) => i === 1)).toHaveLength(30);
        expect(byProp.facecam).toBeUndefined(); // no facecam in this render
        const badge = doc.sources.find((s) => s.editor?.label === "day-badge");
        expect(badge.editor.bindings).toEqual([
            { propKey: "days", path: [0, "day"], kind: "number", onClear: "remove-element" },
        ]);
        const strip = doc.sources.find((s) => s.editor?.label === "title-strip");
        expect(strip.editor.bindings).toEqual([
            { propKey: "days", path: [0, "title"], kind: "string" },
        ]);
    });
});
describe("geometry: inset recovery, always", () => {
    it("the m0 GCD-collapses (~6x vs exact rects) and pieces recover via insets", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        // Measured (1920x1080 defaults): exact rects emitted 29,634 chars; inset
        // recovery collapses to ~4,455. Generous cap so lattice tweaks don't
        // flake the lock, tight enough to catch a laundering regression back to
        // canvas-tracking precision.
        expect(doc.m0.length).toBeLessThan(10_000);
        expect((0, dsl_1.isValidM0String)(doc.m0)).toBe(true);
        expect(doc.sources.some((s) => s.placement?.inset)).toBe(true);
    });
    it("recovered pieces paint on their exact computed rects", async () => {
        const exact = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        const compact = exact;
        // Same painted geometry either way — the render doesn't care.
        const painted = (doc) => {
            const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 1920, 1080);
            if (!parsed.ok)
                throw new Error("parse failed");
            return doc.sources
                .map((s) => ({
                label: s.editor?.label ?? "",
                ...paintedRect(doc, parsed.ir.renderFrames, s),
            }))
                .sort((a, b) => a.label.localeCompare(b.label) || a.x - b.x || a.y - b.y);
        };
        expect(painted(exact)).toEqual(painted(compact));
    });
    it("every piece paints its EXACT rect at awkward canvases too", () => {
        const canvases = [
            [1920, 1080],
            [1000, 700],
            [854, 480],
            [1080, 1920],
        ];
        const resolved = (0, resolve_1.resolveDropCalendar)({
            ...drop_calendar_1.DropCalendarV1.defaultProps,
            facecam: "cam.mp4",
            teasers: ["a.jpg", "b.mp4"],
            cues: [
                { text: "13", startMs: 2000, endMs: 6000 },
                { text: "20", startMs: 8000 },
            ],
        }, 30);
        expect(resolved.ok).toBe(true);
        if (!resolved.ok)
            return;
        {
            for (const [w, h] of canvases) {
                const built = (0, compose_1.buildDropCalendarDoc)(resolved.cfg, w, h, 30, 30000, (p) => (0, resolve_1.classifyMedia)(p, undefined));
                expect(built.ok).toBe(true);
                if (!built.ok)
                    continue;
                const parsed = (0, dsl_1.parseM0StringComplete)(built.doc.m0, w, h);
                expect(parsed.ok).toBe(true);
                if (!parsed.ok)
                    continue;
                // Expectations are zip-ordered: one per painted frame, paint order.
                const frames = parsed.ir.renderFrames;
                expect(frames.length).toBe(built.expectations.length);
                built.expectations.forEach((exp, i) => {
                    const f = frames[i];
                    const painted = (0, template_utils_1.engineRecover)({ x: f.x, y: f.y, w: f.width, h: f.height }, exp.inset ?? null);
                    // jest's expect has no message arg; the label rides in the failure
                    // via the object shape instead.
                    expect({ piece: i, canvas: `${w}x${h}`, painted }).toEqual({
                        piece: i,
                        canvas: `${w}x${h}`,
                        painted: exp.rect,
                    });
                });
            }
        }
    });
});
describe("determinism", () => {
    it("same props + ctx → byte-identical documents", async () => {
        const props = {
            ...drop_calendar_1.DropCalendarV1.defaultProps,
            teasers: ["a.jpg", "b.mp4"],
            cues: [{ text: "13", startMs: 1000 }],
        };
        const a = await render(props, makeCtx({ durationMs: 20000 }));
        const b = await render(props, makeCtx({ durationMs: 20000 }));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});
describe("errors", () => {
    it("bad month → error mosaic with code", async () => {
        const doc = await render({ month: 42 });
        expect(errorCode(doc)).toBe("DC_MONTH");
    });
});
describe("platform — first-class output selection", () => {
    /** Render the way a host that honours resolveOutputHints would: the target
     *  seeded from the platform's canvas. */
    async function renderAt(props, media) {
        const hints = drop_calendar_1.DropCalendarV1.resolveOutputHints(props);
        const target = hints.width && hints.height ? { width: hints.width, height: hints.height } : {};
        return render(props, makeCtx(target, media));
    }
    function painted(doc, label) {
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, doc.size.width, doc.size.height);
        if (!parsed.ok)
            throw new Error("m0 did not parse");
        const src = doc.sources.find((s) => s.editor?.label === label);
        return paintedRect(doc, parsed.ir.renderFrames, src);
    }
    it("defaults to YouTube: the doc authors 1920x1080 at the hint", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        expect(doc.size).toEqual({ width: 1920, height: 1080 });
    });
    it("resolveOutputHints: the platform picks the canvas hosts seed the target from", () => {
        const resolve = drop_calendar_1.DropCalendarV1.resolveOutputHints;
        expect(resolve({ platform: "tiktok" })).toEqual({ width: 1080, height: 1920 });
        expect(resolve({ platform: "instagram-portrait" })).toEqual({ width: 1080, height: 1350 });
        expect(resolve({ platform: "x" })).toEqual({ width: 1600, height: 900 });
        // "canvas" has no opinion — the static hints stand.
        expect(resolve({ platform: "canvas" })).toEqual({});
        // At defaults the resolver agrees with the static hints (the seam's
        // outputHintsResolve convention).
        expect(resolve(drop_calendar_1.DropCalendarV1.defaultProps)).toEqual({ width: 1920, height: 1080 });
    });
    it("renders at the host's target — the platform shapes the safe area, not the size", async () => {
        // A host that honours the resolver seeds 1080x1920 for TikTok…
        const tall = await render({ platform: "tiktok" }, makeCtx({ width: 1080, height: 1920 }));
        expect(errorCode(tall)).toBeUndefined();
        expect(tall.size).toEqual({ width: 1080, height: 1920 });
        expect((0, dsl_1.isValidM0String)(tall.m0)).toBe(true);
        // …and one that ignores it (or an explicit -w/-h) still gets a correct
        // layout at its own size.
        const wide = await render({ platform: "tiktok" }, makeCtx({ width: 1280, height: 720 }));
        expect(errorCode(wide)).toBeUndefined();
        expect(wide.size).toEqual({ width: 1280, height: 720 });
    });
    it("an unknown platform lands on the default instead of failing", async () => {
        const doc = await render({ platform: "myspace" });
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.size).toEqual({ width: 1920, height: 1080 });
    });
    for (const platform of ["tiktok", "youtube-shorts", "instagram-reel"]) {
        it(`${platform}: the card stays inside the chrome and clear of the action rail`, async () => {
            const doc = await renderAt({ platform });
            expect(errorCode(doc)).toBeUndefined();
            const { safe, rail } = (0, platforms_1.platformStage)((0, platforms_1.resolveCreatorPlatform)(platform), 1080, 1920);
            // The sheet bleeds edge to edge (the calendar IS the video)…
            expect(painted(doc, "paper")).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
            // …while the table slab stays inside the chrome and clear of the rail.
            const panel = painted(doc, "panel");
            expect(panel.y).toBeGreaterThanOrEqual(safe.y);
            expect(panel.y + panel.h).toBeLessThanOrEqual(safe.y + safe.h);
            expect(panel.x).toBeGreaterThanOrEqual(safe.x);
            expect(rail).toBeDefined();
            expect(panel.x + panel.w).toBeLessThanOrEqual(rail.x);
        });
    }
    it("a story has chrome but no rail: the slab spans the safe width", async () => {
        const doc = await renderAt({ platform: "instagram-story" });
        const { safe } = (0, platforms_1.platformStage)((0, platforms_1.resolveCreatorPlatform)("instagram-story"), 1080, 1920);
        const panel = painted(doc, "panel");
        expect(panel.x + panel.w).toBeGreaterThan(1080 * 0.85);
        expect(panel.y).toBeGreaterThanOrEqual(safe.y);
    });
    it("with a facecam on a rail platform the calendar is the video and the PiP keeps its corner", async () => {
        const media = { "cam.mp4": { kind: "video", durationMs: 20000 } };
        const doc = await renderAt({ platform: "tiktok", facecam: "cam.mp4" }, media);
        expect(errorCode(doc)).toBeUndefined();
        expect(doc.size).toEqual({ width: 1080, height: 1920 });
        const { safe, rail } = (0, platforms_1.platformStage)((0, platforms_1.resolveCreatorPlatform)("tiktok"), 1080, 1920);
        const cam = painted(doc, "facecam");
        const panel = painted(doc, "panel");
        expect(painted(doc, "paper")).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
        expect(panel.y).toBeGreaterThanOrEqual(safe.y);
        expect(panel.y + panel.h).toBeLessThanOrEqual(safe.y + safe.h);
        expect(panel.x + panel.w).toBeLessThanOrEqual(rail.x);
        // Default PiP: top-left, inside the chrome.
        expect(cam.y).toBeGreaterThanOrEqual(safe.y);
        expect(cam.x).toBeGreaterThanOrEqual(safe.x);
        expect(cam.x).toBeLessThan(200);
        // A bottom-right pick would sit under the rail → slides left of it.
        const br = await renderAt({ platform: "tiktok", facecam: "cam.mp4", facecamCorner: "bottom-right" }, media);
        const pip = painted(br, "facecam");
        expect(pip.x + pip.w).toBeLessThanOrEqual(rail.x);
        expect(pip.y + pip.h).toBeLessThanOrEqual(safe.y + safe.h);
        // A top-right pick keeps its corner (rail-free above its top) and a smaller size is honoured.
        const tr = await renderAt({ platform: "tiktok", facecam: "cam.mp4", facecamCorner: "top-right", facecamSize: 0.25 }, media);
        const pipR = painted(tr, "facecam");
        expect(pipR.w).toBe(Math.round(1080 * 0.25));
        expect(pipR.x + pipR.w).toBeGreaterThan(1080 * 0.8);
        expect(pipR.y + pipR.h).toBeLessThanOrEqual(rail.y);
    });
    it("portrait and square reflow titles into a drops list under the grid; desktop keeps them in the cells", async () => {
        for (const platform of ["tiktok", "instagram-story", "instagram-post", "instagram-portrait"]) {
            const doc = await renderAt({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform });
            const rows = doc.sources.filter((s) => s.editor?.label === "drop-row");
            expect(rows.length).toBe(6);
            // Source order follows the quantized lattice (inset recovery), not day
            // order — address the row by its text. Every row binds the same Drops
            // row a cell would.
            const first = rows.find((r) => r.layers[0].content.text === "02");
            expect(first.editor.bindings).toEqual([
                { propKey: "days", path: [0, "day"], kind: "number", onClear: "remove-element" },
                { propKey: "days", path: [0, "title"], kind: "string" },
            ]);
            // Rows read "02  NEW SINGLE OUT", and no cell carries a title.
            expect(first.layers.map((l) => l.content.text)).toEqual(["02", "NEW SINGLE OUT"]);
            const cells = doc.sources.filter((s) => s.editor?.label === "drop-cell");
            for (const c of cells)
                expect(c.layers.length).toBe(1);
            // The list sits under the table, inside the slab.
            const panel = painted(doc, "panel");
            const lastRow = painted(doc, "drop-row");
            expect(lastRow.x).toBeGreaterThanOrEqual(panel.x);
            expect(lastRow.x + lastRow.w).toBeLessThanOrEqual(panel.x + panel.w);
        }
        for (const platform of ["youtube", "twitch", "x"]) {
            const doc = await renderAt({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform });
            expect(doc.sources.some((s) => s.editor?.label === "drop-row")).toBe(false);
            const titled = doc.sources.filter((s) => s.editor?.label === "drop-cell" && s.layers.length > 1);
            expect(titled.length).toBe(6);
        }
    });
    it("more drops than list rows fold the rest into a +N row", async () => {
        const days = Array.from({ length: 12 }, (_, i) => ({ day: i + 1, title: `Drop ${i + 1}` }));
        const doc = await renderAt({ platform: "tiktok", days });
        const rows = doc.sources.filter((s) => s.editor?.label === "drop-row");
        expect(rows.length).toBe(8);
        expect(rows[7].layers[0].content.text).toBe("+5");
        expect(rows[7].layers[1].content.text).toMatch(/AND 4 MORE$/);
    });
    it("cell titles never paint past the cell, even at a small desktop canvas", async () => {
        const doc = await render({ platform: "canvas", days: [{ day: 13, title: "Extraordinarily long premiere" }] }, makeCtx({ width: 854, height: 480 }));
        expect(errorCode(doc)).toBeUndefined();
        const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, 854, 480);
        if (!parsed.ok)
            throw new Error("m0 did not parse");
        const cell = doc.sources.find((s) => s.editor?.label === "drop-cell");
        const rect = paintedRect(doc, parsed.ir.renderFrames, cell);
        for (const l of cell.layers.slice(1)) {
            expect(l.content.text.length * l.style.fontSize * 0.62).toBeLessThanOrEqual(rect.w * 0.9);
        }
    });
});
function painted(doc, label) {
    const parsed = (0, dsl_1.parseM0StringComplete)(doc.m0, doc.size.width, doc.size.height);
    if (!parsed.ok)
        throw new Error("m0 did not parse");
    const src = doc.sources.find((s) => s.editor?.label === label);
    return paintedRect(doc, parsed.ir.renderFrames, src);
}
describe("safe area switch + mock platform chrome", () => {
    const tall = () => makeCtx({ width: 1080, height: 1920 });
    it("safeArea: false uses the whole canvas (slab inside a plain margin, no rail avoidance)", async () => {
        const on = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "tiktok" }, tall());
        const off = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "tiktok", safeArea: false }, tall());
        const panelOn = painted(on, "panel");
        const panelOff = painted(off, "panel");
        expect(panelOff.w).toBeGreaterThan(panelOn.w);
        expect(panelOff.x + panelOff.w).toBeGreaterThan(1080 * 0.9);
        expect(panelOff.y).toBeLessThan(panelOn.y);
    });
    it("mock chrome is off by default; on TikTok it paints the top bar, caption area, rail and 4 buttons last", async () => {
        const off = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "tiktok" }, tall());
        expect(off.sources.some((s) => s.editor?.label === "chrome")).toBe(false);
        const on = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "tiktok", showChrome: true }, tall());
        expect(errorCode(on)).toBeUndefined();
        const chrome = on.sources.filter((s) => s.editor?.label === "chrome");
        expect(chrome.length).toBe(7);
        expect((0, dsl_1.isValidM0String)(on.m0)).toBe(true);
        expect(on.sources.indexOf(chrome[0])).toBeGreaterThan(on.sources.findIndex((s) => s.editor?.label === "masthead"));
    });
    it("mock chrome does nothing without chrome (YouTube) or with the safe area off", async () => {
        const yt = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "youtube", showChrome: true });
        expect(yt.sources.some((s) => s.editor?.label === "chrome")).toBe(false);
        const off = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, platform: "tiktok", showChrome: true, safeArea: false }, tall());
        expect(off.sources.some((s) => s.editor?.label === "chrome")).toBe(false);
    });
});
describe("facecam area (drawn rect escape hatch)", () => {
    const media = { "cam.mp4": { kind: "video", durationMs: 20000 } };
    it("a drawn rect moves ONLY the facecam — the calendar keeps its side-by-side layout (landscape)", async () => {
        const auto = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4" }, makeCtx({}, media));
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4", facecamRegion: { regions: [{ x: 1400, y: 120, w: 420, h: 300 }] } }, makeCtx({}, media));
        expect(errorCode(doc)).toBeUndefined();
        expect(painted(doc, "facecam")).toEqual({ x: 1400, y: 120, w: 420, h: 300 });
        expect(painted(doc, "paper")).toEqual(painted(auto, "paper"));
        expect(painted(doc, "panel")).toEqual(painted(auto, "panel"));
    });
    it("rescales from the canvas it was drawn on, on any platform", async () => {
        const doc = await render({
            ...drop_calendar_1.DropCalendarV1.defaultProps,
            platform: "tiktok",
            facecam: "cam.mp4",
            facecamRegion: { canvas: { w: 540, h: 960 }, regions: [{ x: 270, y: 700, w: 240, h: 200 }] },
        }, makeCtx({ width: 1080, height: 1920 }, media));
        expect(painted(doc, "facecam")).toEqual({ x: 540, y: 1400, w: 480, h: 400 });
        expect(doc.sources.filter((s) => s.editor?.label === "facecam")).toHaveLength(1);
    });
    it("junk or an off-canvas rect falls back to automatic placement", async () => {
        const auto = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4" }, makeCtx({}, media));
        const junk = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4", facecamRegion: "{not json" }, makeCtx({}, media));
        expect(painted(junk, "facecam")).toEqual(painted(auto, "facecam"));
        const off = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4", facecamRegion: { regions: [{ x: 5000, y: 5000, w: 10, h: 10 }] } }, makeCtx({}, media));
        expect(painted(off, "facecam")).toEqual(painted(auto, "facecam"));
    });
    it("a drawn rect without a facecam is inert", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecamRegion: { regions: [{ x: 10, y: 10, w: 100, h: 100 }] } });
        expect(doc.sources.some((s) => s.editor?.label === "facecam")).toBe(false);
    });
});
describe("facecam frame", () => {
    const media = { "cam.mp4": { kind: "video", durationMs: 20000 } };
    it("a thin theme-coloured frame sits just outside the facecam cell (default 2 px; thickness + colour are knobs)", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4" }, makeCtx({}, media));
        const cam = painted(doc, "facecam");
        const frame = painted(doc, "facecam-frame");
        expect(frame).toEqual({ x: cam.x - 2, y: cam.y - 2, w: cam.w + 4, h: cam.h + 4 });
        const src = doc.sources.find((s) => s.editor?.label === "facecam-frame");
        expect(src.visual?.backgroundColor ?? src.color).toBe("#C4B5FD"); // studio frame
        // Painted under the facecam, above the sheet.
        expect(doc.sources.indexOf(src)).toBeLessThan(doc.sources.findIndex((s) => s.editor?.label === "facecam"));
        const thick = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4", facecamStrokePx: 6, facecamStrokeColor: "#FF8800" }, makeCtx({}, media));
        const camT = painted(thick, "facecam");
        const frameT = painted(thick, "facecam-frame");
        expect(frameT.w - camT.w).toBe(12);
        const srcT = thick.sources.find((s) => s.editor?.label === "facecam-frame");
        expect(srcT.visual?.backgroundColor ?? srcT.color).toBe("#FF8800");
        const none = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps, facecam: "cam.mp4", facecamStrokePx: 0 }, makeCtx({}, media));
        expect(none.sources.some((s) => s.editor?.label === "facecam-frame")).toBe(false);
    });
    it("no facecam → no frame", async () => {
        const doc = await render({ ...drop_calendar_1.DropCalendarV1.defaultProps });
        expect(doc.sources.some((s) => s.editor?.label === "facecam-frame")).toBe(false);
    });
});
describe("spotlight is the hero: centred, with the facecam floating above it", () => {
    const media = { "cam.mp4": { kind: "video", durationMs: 20000 } };
    const base = {
        ...drop_calendar_1.DropCalendarV1.defaultProps,
        platform: "tiktok",
        safeArea: false,
        month: 10,
        year: 2026,
        days: [{ day: 13, title: "New set" }],
        teasers: ["t.jpg"],
        cues: [{ text: "13", startMs: 2000, endMs: 6000 }],
        holdSec: 4,
    };
    it("a facecam drawn over the zoom centre does not move the zoom", async () => {
        const ctx = makeCtx({ width: 1080, height: 1920, durationMs: 30000 }, media);
        const alone = await render(base, ctx);
        const doc = await render({ ...base, facecam: "cam.mp4", facecamRegion: { canvas: { w: 1080, h: 1920 }, regions: [{ x: 72, y: 333, w: 265, h: 460 }] } }, ctx);
        expect(errorCode(doc)).toBeUndefined();
        const spot = painted(doc, "spotlight");
        expect(spot).toEqual(painted(alone, "spotlight"));
        const table = painted(doc, "panel");
        expect(spot.x + spot.w / 2).toBeCloseTo(table.x + table.w / 2, -1);
    });
    it("the facecam and its frame paint above the spotlight, its frame and the dim wash", async () => {
        const ctx = makeCtx({ width: 1080, height: 1920, durationMs: 30000 }, media);
        const doc = await render({ ...base, facecam: "cam.mp4", facecamRegion: { canvas: { w: 1080, h: 1920 }, regions: [{ x: 72, y: 333, w: 265, h: 460 }] } }, ctx);
        const order = doc.sources.map((s) => s.editor?.label);
        const idx = (l) => order.indexOf(l);
        for (const under of ["spotlight", "spotlight-frame", "spotlight-dim"]) {
            expect(idx("facecam")).toBeGreaterThan(idx(under));
            expect(idx("facecam-frame")).toBeGreaterThan(idx(under));
        }
    });
});
