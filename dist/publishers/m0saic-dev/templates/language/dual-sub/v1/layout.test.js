"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const layout_1 = require("./layout");
const BOTH = { target: true, native: true };
describe("buildDualSubLayout", () => {
    it("stack: canvas == video, slots carved as real cells, valid m0", () => {
        const l = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: BOTH });
        expect(l.canvasW).toBe(1920);
        expect(l.canvasH).toBe(1080);
        expect(l.slotOrder).toEqual(["video", "target", "native"]);
        expect((0, dsl_1.validateM0String)(l.m0).ok).toBe(true);
        // Bottom-anchored band: small fixed gap between the rects, both texts
        // bottom-aligned, tight safe margin.
        const gap = l.rects.native.y - (l.rects.target.y + l.rects.target.h);
        expect(gap).toBeGreaterThanOrEqual(4);
        expect(gap).toBeLessThanOrEqual(16);
        expect(l.rects.native.y + l.rects.native.h).toBeLessThan(1080);
        expect(l.textVAlign).toEqual({ target: "bottom", native: "bottom" });
    });
    it("bar: canvas extends below the video; the band lives in the bar", () => {
        const l = (0, layout_1.buildDualSubLayout)({ layout: "bar", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: BOTH });
        expect(l.canvasH).toBeGreaterThan(1080);
        expect(l.rects.video.h).toBe(1080);
        expect(l.rects.target.y).toBeGreaterThanOrEqual(1080);
        expect(l.rects.native.y).toBeGreaterThan(l.rects.target.y + l.rects.target.h);
        expect((0, dsl_1.validateM0String)(l.m0).ok).toBe(true);
    });
    it("solo target hugs the bottom: band tightens when native is absent", () => {
        const solo = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: { target: true, native: false } });
        const both = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: BOTH });
        expect(solo.rects.target.y).toBeGreaterThan(both.rects.target.y);
        expect(solo.textVAlign.target).toBe("bottom");
    });
    it("slot edges snap to the 4px grid (GCD-collapsible)", () => {
        const l = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1024, videoH: 576, sizeProfile: "tv", slots: BOTH });
        for (const id of ["target", "native"]) {
            expect(l.rects[id].x % 4).toBe(0);
            expect(l.rects[id].h % 4).toBe(0);
        }
    });
    it("hidden slots are not carved; raw pass-through is a bare F", () => {
        const solo = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: { target: true, native: false } });
        expect(solo.slotOrder).toEqual(["video", "target"]);
        const raw = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1920, videoH: 1080, sizeProfile: "tv", slots: { target: false, native: false } });
        expect(raw.m0).toBe("F");
        expect(raw.slotOrder).toEqual(["video"]);
    });
    it("is deterministic", () => {
        const a = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1280, videoH: 720, sizeProfile: "desktop", slots: BOTH });
        const b = (0, layout_1.buildDualSubLayout)({ layout: "stack", videoW: 1280, videoH: 720, sizeProfile: "desktop", slots: BOTH });
        expect(a).toEqual(b);
    });
});
