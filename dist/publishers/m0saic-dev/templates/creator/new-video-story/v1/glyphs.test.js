"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const glyphs_1 = require("./glyphs");
const layout_1 = require("./layout");
/* eslint-disable @typescript-eslint/no-explicit-any */
const mask = (s) => s.mask;
const cell = { x: 10, y: 20, w: 200, h: 120 };
/** SVG arc commands are the one thing the mask rasterizer drops under motion. */
const ARC = /(^|[\s\d])A[\s\d]/;
describe("path primitives", () => {
    it("circlePolyPath: N vertices, closed, reverse flips the winding", () => {
        const d = (0, glyphs_1.circlePolyPath)(50, 50, 20, 8);
        expect(d.match(/[ML] /g)).toHaveLength(8);
        expect(d.endsWith("Z")).toBe(true);
        expect(d).not.toMatch(ARC);
        const fwd = (0, glyphs_1.circlePolyPath)(50, 50, 20, 8).split(/[ML] /).slice(1).map((s) => s.trim());
        const rev = (0, glyphs_1.circlePolyPath)(50, 50, 20, 8, true).split(/[ML] /).slice(1).map((s) => s.trim());
        // Same first vertex, second vertices on opposite sides of it.
        expect(fwd[0]).toBe(rev[0].replace(/ Z$/, ""));
        expect(fwd[1]).not.toBe(rev[1]);
    });
    it("roundedRectPolyPath: polygonal corners, clamps the radius, plain rect at 0", () => {
        const d = (0, glyphs_1.roundedRectPolyPath)(0, 0, 100, 50, 10);
        expect(d).not.toMatch(ARC);
        expect(d.match(/[ML] /g)).toHaveLength(4 * (glyphs_1.CORNER_SEGMENTS + 1));
        // Starts at the top-right corner's first chord (x + w - R, y).
        expect(d.startsWith("M 90 0")).toBe(true);
        expect((0, glyphs_1.roundedRectPolyPath)(0, 0, 100, 50, 0)).toBe("M 0 0 L 100 0 L 100 50 L 0 50 Z");
        // A pill (r = h/2) never exceeds the half-extents.
        expect((0, glyphs_1.roundedRectPolyPath)(0, 0, 100, 50, 999)).toContain("M 75 0");
        const rev = (0, glyphs_1.roundedRectPolyPath)(0, 0, 100, 50, 10, true);
        expect(rev).not.toBe(d);
        expect(rev.match(/[ML] /g)).toHaveLength(d.match(/[ML] /g).length);
    });
});
describe("text masks", () => {
    const line = (0, layout_1.stickerLine)("VIDEO", 120, 110, 40, true);
    it("linePath draws glyph outlines inside the cell, from the bold face", () => {
        const d = (0, glyphs_1.linePath)(line);
        expect(d.length).toBeGreaterThan(100);
        expect(d).not.toMatch(ARC);
        // Every coordinate lands inside the cell's local box (plus a hair for curves).
        const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
        const xs = nums.filter((_, i) => i % 2 === 0);
        const ys = nums.filter((_, i) => i % 2 === 1);
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1);
        expect(Math.max(...xs)).toBeLessThanOrEqual(line.cell.w + 1);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1);
        expect(Math.max(...ys)).toBeLessThanOrEqual(line.cell.h + 1);
    });
    it("stickerSources: halo → stroke → fill on one path; stroked layers dilate by 2·r", () => {
        const [halo, stroke, fill] = (0, glyphs_1.stickerSources)(line, { fill: "#FFF", stroke: "#000", halo: "#FFF" });
        const d = mask(fill).localPath;
        expect(mask(halo).localPath).toBe(d);
        expect(mask(stroke).localPath).toBe(d);
        expect(mask(halo).strokes).toEqual([{ d, width: 2 * line.haloPx }]);
        expect(mask(stroke).strokes).toEqual([{ d, width: 2 * line.strokePx }]);
        expect(mask(fill).strokes).toBeUndefined();
        expect(line.haloPx).toBeGreaterThan(line.strokePx);
        for (const s of [halo, stroke, fill]) {
            expect(s.type).toBe("lavfi");
            expect(mask(s).bounds).toEqual({ x: 0, y: 0, width: line.cell.w, height: line.cell.h });
            expect(s.overlay).toBeUndefined();
        }
        expect(halo.color).toBe("#FFF");
        expect(stroke.color).toBe("#000");
    });
    it("a shared overlay rides every layer; plain text has no strokes", () => {
        const overlay = { alpha: "1", startAtSec: 0 };
        for (const s of (0, glyphs_1.stickerSources)(line, { fill: "#FFF", stroke: "#000", halo: "#FFF" }, overlay)) {
            expect(s.overlay).toEqual(overlay);
        }
        const plain = (0, glyphs_1.plainTextSource)(line, "#123456", overlay);
        expect(mask(plain).strokes).toBeUndefined();
        expect(plain.color).toBe("#123456");
        expect(plain.overlay).toEqual(overlay);
    });
});
describe("chrome masks", () => {
    it("maskTile: bounds = the cell; no strokes at width 0", () => {
        const s = (0, glyphs_1.maskTile)("#FFF", cell, "M 0 0 L 1 0 L 1 1 Z", { strokeWidth: 0 });
        expect(mask(s).bounds).toEqual({ x: 0, y: 0, width: 200, height: 120 });
        expect(mask(s).strokes).toBeUndefined();
    });
    it("frameSource: four bars of the stroke thickness, clamped for tiny cells", () => {
        const s = (0, glyphs_1.frameSource)(cell, 8, "#FFF");
        expect(mask(s).localPath.match(/Z/g)).toHaveLength(4);
        expect(mask(s).localPath).toContain("M 0 0 L 200 0 L 200 8 L 0 8 Z");
        const tiny = (0, glyphs_1.frameSource)({ x: 0, y: 0, w: 6, h: 6 }, 8, "#FFF");
        expect(mask(tiny).localPath).toContain("L 6 3 L 0 3 Z");
    });
    it("arrowPath: a 7-vertex down arrow whose ink spans the cell width and inkH", () => {
        const d = (0, glyphs_1.arrowPath)(54, 70);
        expect(d.match(/[ML] /g)).toHaveLength(7);
        expect(d).toContain("L 54 ");
        expect(d).toContain("L 27 70");
        expect(d).not.toMatch(ARC);
        const s = (0, glyphs_1.arrowSource)({ x: 0, y: 0, w: 54, h: 92 }, 70, "#FFF");
        expect(mask(s).bounds).toEqual({ x: 0, y: 0, width: 54, height: 92 });
    });
    it("pillSource: a stadium filling the cell", () => {
        const s = (0, glyphs_1.pillSource)({ x: 0, y: 0, w: 400, h: 100 }, "#FFF");
        expect(mask(s).localPath.startsWith("M 350 0")).toBe(true);
        expect(mask(s).localPath).not.toMatch(ARC);
    });
    it("linkGlyphPath: two rings (outer + reversed inner) and a bar — 5 subpaths, arc-free", () => {
        const d = (0, glyphs_1.linkGlyphPath)(60);
        expect(d.match(/Z/g)).toHaveLength(5);
        expect(d).not.toMatch(ARC);
        const s = (0, glyphs_1.linkGlyphSource)({ x: 0, y: 0, w: 60, h: 60 }, "#000");
        expect(mask(s).bounds).toEqual({ x: 0, y: 0, width: 60, height: 60 });
    });
});
describe("badge", () => {
    const b = { x: 0, y: 0, w: 140, h: 100 };
    it("every drawn glyph is a closed, arc-free polygon set inside the badge", () => {
        for (const kind of ["play", "note", "camera", "live"]) {
            const d = (0, glyphs_1.badgeGlyphPath)(kind, b.w, b.h);
            expect(d).not.toMatch(ARC);
            expect(d.match(/Z/g).length).toBeGreaterThanOrEqual(1);
            const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
            expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
        }
        // The play triangle is three points, centred on the tile.
        const play = (0, glyphs_1.badgeGlyphPath)("play", b.w, b.h);
        expect(play.match(/[ML] /g)).toHaveLength(3);
    });
    it("badgeSources: an accent tile under a white glyph, both sharing the overlay", () => {
        const overlay = { yExpr: "0", startAtSec: 0.5 };
        const [tile, glyph] = (0, glyphs_1.badgeSources)(b, "play", "#FF0000", "#FFFFFF", overlay);
        expect(tile.color).toBe("#FF0000");
        expect(glyph.color).toBe("#FFFFFF");
        expect(mask(tile).localPath).toBe((0, glyphs_1.roundedRectPolyPath)(0, 0, b.w, b.h, b.h * 0.22));
        expect(mask(tile).bounds).toEqual({ x: 0, y: 0, width: 140, height: 100 });
        expect(tile.overlay).toEqual(overlay);
        expect(glyph.overlay).toEqual(overlay);
    });
    it("circle sides constant is what the rings are built from", () => {
        expect((0, glyphs_1.circlePolyPath)(0, 0, 10).match(/[ML] /g)).toHaveLength(glyphs_1.CIRCLE_SIDES);
    });
});
