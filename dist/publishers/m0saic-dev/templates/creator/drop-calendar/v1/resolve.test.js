"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resolve_1 = require("./resolve");
const facecamReel_1 = require("./facecamReel");
const DUR = 30; // seconds
function cfgOf(props, durationSec = DUR) {
    const out = (0, resolve_1.resolveDropCalendar)(props, durationSec);
    if (!out.ok)
        throw new Error(`${out.code}: ${out.message}`);
    return out;
}
describe("month/year validation", () => {
    it("hard-fails only on nonsense", () => {
        expect((0, resolve_1.resolveDropCalendar)({ month: 0 }, DUR).ok).toBe(false);
        expect((0, resolve_1.resolveDropCalendar)({ month: 13 }, DUR).ok).toBe(false);
        expect((0, resolve_1.resolveDropCalendar)({ year: 1800 }, DUR).ok).toBe(false);
        expect((0, resolve_1.resolveDropCalendar)({ month: 12, year: 2026 }, DUR).ok).toBe(true);
    });
});
describe("drops", () => {
    it("skips out-of-month days and duplicates, with warnings", () => {
        const { cfg, warnings } = cfgOf({
            month: 2,
            year: 2026, // 28 days
            days: [
                { day: 5, title: "ok" },
                { day: 30, title: "gone" },
                { day: 5, title: "dupe" },
            ],
        });
        expect([...cfg.dropsByDay.keys()]).toEqual([5]);
        expect(cfg.dropsByDay.get(5)?.title).toBe("ok");
        expect(warnings.some((w) => w.includes("30"))).toBe(true);
        expect(warnings.some((w) => w.includes("Duplicate"))).toBe(true);
    });
    it("defensive: numeric-string days tolerated, blank days render nothing silently", () => {
        const { cfg, warnings } = cfgOf({
            // Hostile input on purpose: the schema says number, the resolver must
            // still tolerate what a JSON editor hands it.
            days: [
                { day: "8", title: "string day" },
                { day: "", title: "parked" },
                { day: "abc", title: "junk" },
            ],
        });
        expect(cfg.dropsByDay.get(8)?.title).toBe("string day");
        expect(cfg.dropsByDay.size).toBe(1);
        // Parked (empty) rows are silent; junk warns.
        expect(warnings.some((w) => w.includes("parked"))).toBe(false);
        expect(warnings.some((w) => w.includes('"abc"'))).toBe(true);
        expect(warnings).toHaveLength(1);
    });
    it("rowIndex is the ORIGINAL props.days position, surviving skipped rows", () => {
        const { cfg } = cfgOf({
            days: [{ day: 99 }, { day: 5, title: "x" }, { day: 2 }],
        });
        // Row 0 is skipped (out of month) — bindings must still route row 1/2.
        expect(cfg.dropsByDay.get(5)?.rowIndex).toBe(1);
        expect(cfg.dropsByDay.get(2)?.rowIndex).toBe(2);
        // Add handles append AFTER every original row, skipped ones included.
        expect(cfg.dayRowCount).toBe(3);
    });
    it("auto-assigns teasers in day order", () => {
        const { cfg } = cfgOf({
            days: [{ day: 20 }, { day: 2 }, { day: 13 }],
            teasers: ["a.jpg", "b.jpg"],
        });
        expect(cfg.dropsByDay.get(2)?.teaserIndex).toBe(0);
        expect(cfg.dropsByDay.get(13)?.teaserIndex).toBe(1);
        expect(cfg.dropsByDay.get(20)?.teaserIndex).toBeUndefined();
    });
    it("explicit teaser slots win; auto fills around them", () => {
        const { cfg } = cfgOf({
            days: [
                { day: 2 },
                { day: 13, teaser: 1 }, // claims a.jpg explicitly
                { day: 20 },
            ],
            teasers: ["a.jpg", "b.jpg", "c.jpg"],
        });
        expect(cfg.dropsByDay.get(13)?.teaserIndex).toBe(0);
        expect(cfg.dropsByDay.get(2)?.teaserIndex).toBe(1);
        expect(cfg.dropsByDay.get(20)?.teaserIndex).toBe(2);
    });
    it("an out-of-range explicit slot degrades to text with a warning", () => {
        const { cfg, warnings } = cfgOf({
            days: [{ day: 4, title: "t", teaser: 9 }],
            teasers: ["a.jpg"],
        });
        // Slot 9 doesn't exist — the drop degrades, and the ONE teaser is
        // still free for auto-assignment to this (only) drop day.
        expect(cfg.dropsByDay.get(4)?.teaserIndex).toBe(0);
        expect(warnings.some((w) => w.includes("#9"))).toBe(true);
    });
});
describe("branded weekdays", () => {
    it("maps the group's fields by weekday, empty/whitespace = plain", () => {
        const { cfg } = cfgOf({
            weekdays: {
                monday: "Members' Monday",
                saturday: "Showtime Saturday",
                tuesday: "   ",
            },
        });
        expect(cfg.specialLabelByWeekday[1]).toBe("Members' Monday");
        expect(cfg.specialLabelByWeekday[6]).toBe("Showtime Saturday");
        expect(cfg.specialLabelByWeekday[2]).toBeUndefined();
        expect(cfg.specialLabelByWeekday[0]).toBeUndefined();
    });
});
describe("cues", () => {
    it("windows: explicit end > next cue start > holdSec, clamped to duration", () => {
        const { cfg } = cfgOf({
            month: 10,
            year: 2026,
            holdSec: 4,
            cues: [
                { text: "2", startMs: 1000, endMs: 3000 },
                { text: "13", startMs: 5000 },
                { text: "20", startMs: 27000 },
            ],
        });
        expect(cfg.cues).toEqual([
            { day: 2, startSec: 1, endSec: 3 },
            { day: 13, startSec: 5, endSec: 27 }, // runs to the next cue
            { day: 20, startSec: 27, endSec: 30 }, // holdSec clamped by duration
        ]);
    });
    it("skips untimed cues, unparsable days, and cues past the end", () => {
        const { cfg, warnings } = cfgOf({
            cues: [
                { text: "13" }, // untimed
                { text: "nope", startMs: 1000 },
                { text: "5", startMs: 99000 }, // past 30s
            ],
        });
        expect(cfg.cues).toEqual([]);
        expect(warnings.some((w) => w.includes("nope"))).toBe(true);
        expect(warnings.some((w) => w.includes("past the render end"))).toBe(true);
    });
});
describe("cues against picked facecam clips", () => {
    const props = {
        month: 10,
        year: 2026,
        holdSec: 4,
        cues: [
            { text: "2", startMs: 21000, endMs: 23000 }, // inside clip 1
            { text: "13", startMs: 33000 }, // cut out
            { text: "20", startMs: 41000, endMs: 47000 }, // end runs past clip 2
        ],
    };
    const reel = (0, facecamReel_1.resolveFacecamReel)([
        { startMs: 20000, endMs: 25000 },
        { startMs: 40000, endMs: 44000 },
    ], { transitionStyle: "cut" });
    it("maps source-stamped cues onto the cut and drops what was cut out", () => {
        const out = (0, resolve_1.resolveDropCalendar)(props, DUR, reel);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.cfg.cues).toEqual([
            { day: 2, startSec: 1, endSec: 3 },
            { day: 20, startSec: 6, endSec: 9 }, // end clamped to clip 2's out-point
        ]);
        expect(out.warnings.some((w) => w.includes("outside the picked facecam clips"))).toBe(true);
    });
    it("carries the reel onto the config and its warnings into the outcome", () => {
        const bad = (0, facecamReel_1.resolveFacecamReel)([{ startMs: 5, endMs: 4 }]);
        const out = (0, resolve_1.resolveDropCalendar)({}, DUR, bad);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.cfg.facecamReel).toBeUndefined();
        expect(out.warnings.some((w) => w.includes("clip #1"))).toBe(true);
        const good = (0, resolve_1.resolveDropCalendar)(props, DUR, reel);
        if (!good.ok)
            throw new Error(good.message);
        expect(good.cfg.facecamReel?.clips).toHaveLength(2);
        expect(good.cfg.facecamReel?.totalMs).toBe(9000);
    });
    it("without a reel, cue times stay output times (the pre-clips behavior)", () => {
        const out = (0, resolve_1.resolveDropCalendar)(props, DUR);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.cfg.cues[0]).toEqual({ day: 2, startSec: 21, endSec: 23 });
    });
});
describe("theme + overrides", () => {
    it("falls back to studio and applies accent/surface overrides", () => {
        const { cfg } = cfgOf({
            theme: "not-a-theme",
            accentColor: "#123456",
            backgroundColor: "#654321",
        });
        expect(cfg.theme.accent).toBe("#123456");
        expect(cfg.theme.surface).toBe("#654321");
        expect(cfg.theme.paper).toBe("#17171F"); // studio paper untouched
    });
    it("named themes swap the palette", () => {
        const { cfg } = cfgOf({ theme: "halloween" });
        expect(cfg.theme.accent).toBe("#F26419");
    });
});
describe("classifyMedia", () => {
    it("probe wins, then extension, image as default", () => {
        expect((0, resolve_1.classifyMedia)("x.jpg", "video")).toBe("video");
        expect((0, resolve_1.classifyMedia)("x.mp4", undefined)).toBe("video");
        expect((0, resolve_1.classifyMedia)("x.MOV", undefined)).toBe("video");
        expect((0, resolve_1.classifyMedia)("x.png", undefined)).toBe("image");
        expect((0, resolve_1.classifyMedia)("https://a/b.webm?tok=1", undefined)).toBe("video");
        expect((0, resolve_1.classifyMedia)("mystery", undefined)).toBe("image");
    });
});
