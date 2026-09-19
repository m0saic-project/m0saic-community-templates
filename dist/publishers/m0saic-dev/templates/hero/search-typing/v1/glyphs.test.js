"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_utils_1 = require("@m0saic/template-utils");
const layout_1 = require("./layout");
const glyphs_1 = require("./glyphs");
const INK = "#202124";
const MUTED = "#9AA0A6";
const layoutFor = (overrides = {}) => (0, layout_1.computeLayout)({
    canvasW: 1280,
    canvasH: 400,
    words: ["Ideas", "Answers"],
    label: "Search for",
    frame: "card",
    showIcon: true,
    barWidthFrac: 0.62,
    barAspect: 0.26,
    cornerRadiusPx: 16,
    ...overrides,
});
const maskOf = (source) => source.mask;
/** Signed shoelace area of an `M x y L x y … Z` polygon path. */
function shoelace(path) {
    const numbers = path
        .replace(/[MLZ]/g, " ")
        .trim()
        .split(/\s+/)
        .map(Number);
    let area = 0;
    for (let i = 0; i < numbers.length; i += 2) {
        const x0 = numbers[i];
        const y0 = numbers[i + 1];
        const x1 = numbers[(i + 2) % numbers.length];
        const y1 = numbers[(i + 3) % numbers.length];
        area += x0 * y1 - x1 * y0;
    }
    return area / 2;
}
describe("circlePolyPath", () => {
    it("emits a closed arc-free polygon with the requested side count", () => {
        const path = (0, glyphs_1.circlePolyPath)(100, 100, 40);
        expect(path.endsWith("Z")).toBe(true);
        expect(path).not.toMatch(/[AaCcQq]/);
        expect(path.match(/[ML]/g)).toHaveLength(glyphs_1.RING_SIDES);
    });
    it("reverse flips the winding", () => {
        const forward = shoelace((0, glyphs_1.circlePolyPath)(100, 100, 40));
        const reversed = shoelace((0, glyphs_1.circlePolyPath)(100, 100, 40, glyphs_1.RING_SIDES, true));
        expect(forward).toBeGreaterThan(0);
        expect(reversed).toBeLessThan(0);
        expect(Math.abs(forward + reversed)).toBeLessThan(1e-6);
    });
});
describe("magnifierPaths", () => {
    const icon = { x: 271, y: 158, w: 84, h: 84 };
    const [outer, inner, handle] = (0, glyphs_1.magnifierPaths)(icon);
    it("is exactly 3 arc-free subpaths", () => {
        expect((0, glyphs_1.magnifierPaths)(icon)).toHaveLength(3);
        for (const path of (0, glyphs_1.magnifierPaths)(icon)) {
            expect(path).not.toMatch(/[AaCcQq]/);
            expect(path.endsWith("Z")).toBe(true);
        }
    });
    it("winds the ring hole opposite to the shell (nonzero-fill ring, not a disc)", () => {
        expect(shoelace(outer)).toBeGreaterThan(0);
        expect(shoelace(inner)).toBeLessThan(0);
        // A real hole: the inner polygon is meaningfully smaller, not degenerate.
        expect(Math.abs(shoelace(inner))).toBeGreaterThan(0);
        expect(Math.abs(shoelace(inner))).toBeLessThan(Math.abs(shoelace(outer)));
    });
    it("winds the handle like the shell so the ring∩handle overlap stays filled", () => {
        expect(shoelace(handle)).toBeGreaterThan(0);
    });
    it("stays inside the icon square", () => {
        for (const path of [outer, inner, handle]) {
            const numbers = path.replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number);
            for (let i = 0; i < numbers.length; i += 2) {
                expect(numbers[i]).toBeGreaterThanOrEqual(icon.x - 0.5);
                expect(numbers[i]).toBeLessThanOrEqual(icon.x + icon.w + 0.5);
                expect(numbers[i + 1]).toBeGreaterThanOrEqual(icon.y - 0.5);
                expect(numbers[i + 1]).toBeLessThanOrEqual(icon.y + icon.h + 0.5);
            }
        }
    });
});
describe("cardSource", () => {
    const layout = layoutFor();
    const source = (0, glyphs_1.cardSource)(layout, "#ffffff");
    it("is a REAL background fill — no mask, SVG-rounded corners", () => {
        expect(source.mask).toBeUndefined();
        const rounding = source.effects
            ?.rounding;
        expect(rounding).toEqual({
            cornerStyle: "rounded",
            borderRadius: (2 * layout.cornerRadiusPx) / Math.min(layout.bar.w, layout.bar.h),
            rasterizer: "svg",
        });
    });
    it("near-half radii become a true pill", () => {
        const pill = (0, glyphs_1.cardSource)(layoutFor({ cornerRadiusPx: 500 }), "#ffffff");
        const rounding = pill.effects
            ?.rounding;
        expect(rounding?.cornerStyle).toBe("pill");
    });
    it("stays static — no overlay window ever", () => {
        expect(source.overlay).toBeUndefined();
    });
});
describe("magnifierSource", () => {
    it("is the 3 polygon subpaths local to the icon cell", () => {
        const layout = layoutFor();
        const source = (0, glyphs_1.magnifierSource)(layout.icon, layout.icon, MUTED);
        const mask = maskOf(source);
        expect(mask.bounds).toEqual({ x: 0, y: 0, width: layout.icon.w, height: layout.icon.h });
        expect(mask.localPath).toBe((0, glyphs_1.magnifierPaths)({ x: 0, y: 0, w: layout.icon.w, h: layout.icon.h }).join(" "));
        expect(mask.localPath).not.toMatch(/[AaCcQq]/);
    });
    it("keeps the EXACT icon square when the snapped cell is bigger", () => {
        const layout = layoutFor();
        const icon = layout.icon;
        const cell = { x: icon.x - 5, y: icon.y - 2, w: icon.w + 8, h: icon.h + 8 };
        const source = (0, glyphs_1.magnifierSource)(icon, cell, MUTED);
        const mask = maskOf(source);
        expect(mask.bounds).toEqual({ x: 0, y: 0, width: cell.w, height: cell.h });
        // The paths are authored for the exact icon rect at its local offset.
        expect(mask.localPath).toBe((0, glyphs_1.magnifierPaths)({ x: 5, y: 2, w: icon.w, h: icon.h }).join(" "));
    });
});
describe("labelChromeSource", () => {
    it("joins label glyphs + the label-underline into one cell-local atlas (grow)", () => {
        const layout = layoutFor();
        const rect = layout.labelZone;
        const source = (0, glyphs_1.labelChromeSource)(layout, rect, MUTED, { underline: "grow" });
        expect(source).not.toBeNull();
        const mask = maskOf(source);
        expect(mask.bounds).toEqual({ x: 0, y: 0, width: rect.w, height: rect.h });
        const underlineRect = (0, template_utils_1.roundedRectPathD)(Math.round(layout.labelUnderline.x0) - rect.x, layout.underlineY - rect.y, Math.round(layout.labelUnderline.x1 - layout.labelUnderline.x0), layout.underlineHeightPx, 0);
        expect(mask.localPath).toContain(underlineRect);
        // The atlas is arc-free everywhere (glyphs are M/L/C/Q, the underline r=0).
        expect(mask.localPath).not.toMatch(/A/);
    });
    it('extends the underline across a widened cell in "static" mode', () => {
        const layout = layoutFor();
        const rect = {
            ...layout.labelZone,
            w: layout.wordZone.x + layout.wordZone.w - layout.labelZone.x,
        };
        const source = (0, glyphs_1.labelChromeSource)(layout, rect, MUTED, { underline: "static" });
        const fullRect = (0, template_utils_1.roundedRectPathD)(Math.round(layout.labelUnderline.x0) - rect.x, layout.underlineY - rect.y, Math.round(layout.wordX + layout.maxWordWidthPx - layout.labelUnderline.x0), layout.underlineHeightPx, 0);
        expect(maskOf(source).localPath).toContain(fullRect);
    });
    it("returns null for an empty cell (no label, underline none)", () => {
        const layout = layoutFor();
        expect((0, glyphs_1.labelChromeSource)(layout, layout.labelZone, MUTED, { underline: "none" })).not.toBeNull(); // glyphs alone still paint
        const noLabel = layoutFor({ label: "" });
        expect((0, glyphs_1.labelChromeSource)(noLabel, { x: 0, y: 0, w: 10, h: 10 }, MUTED, { underline: "none" })).toBeNull();
    });
    it("counts REAL glyph contours against the subpath budget (plan D3)", () => {
        const layout = layoutFor();
        const source = (0, glyphs_1.labelChromeSource)(layout, layout.labelZone, MUTED, { underline: "grow" });
        const contours = (maskOf(source).localPath.match(/M/g) ?? []).length;
        // The label is split per contour before atlasing — well past one entry,
        // and safely under the resolver wall.
        expect(contours).toBeGreaterThan(5);
        expect(contours).toBeLessThanOrEqual(template_utils_1.MASK_SUBPATH_BUDGET);
    });
    it("stays under the budget even at the schema's label + words caps", () => {
        // Worst legal chrome: 40 densest-contour label chars. Layout needs a wide
        // canvas so the fit loop accepts it.
        const layout = layoutFor({
            canvasW: 1920,
            canvasH: 600,
            label: "8".repeat(40),
            words: ["WWWWWWWWWWWWWWWWWWWWWWWW"],
        });
        const rect = {
            ...layout.labelZone,
            w: layout.wordZone.x + layout.wordZone.w - layout.labelZone.x,
        };
        const source = (0, glyphs_1.labelChromeSource)(layout, rect, MUTED, { underline: "static" });
        const contours = (maskOf(source).localPath.match(/M/g) ?? []).length;
        expect(contours).toBeLessThanOrEqual(template_utils_1.MASK_SUBPATH_BUDGET);
    });
});
describe("wordStripSources", () => {
    const layout = layoutFor();
    const zone = layout.wordZone;
    it("emits one cell-local arc-free strip per word, unwindowed by default", () => {
        const strips = (0, glyphs_1.wordStripSources)(layout, zone, INK);
        expect(strips).toHaveLength(layout.words.length);
        for (const strip of strips) {
            const mask = maskOf(strip);
            expect(mask.kind).toBe("inline-mask");
            expect(mask.bounds).toEqual({ x: 0, y: 0, width: zone.w, height: zone.h });
            expect(mask.localPath.length).toBeGreaterThan(0);
            expect(mask.localPath).not.toMatch(/A/);
            expect(strip.overlay).toBeUndefined();
        }
    });
    it("attaches the given overlay window to the matching strip only", () => {
        const strips = (0, glyphs_1.wordStripSources)(layout, zone, INK, [
            undefined,
            { startSec: 3.4, endSec: 6.8 },
        ]);
        expect(strips[0].overlay).toBeUndefined();
        expect(strips[1].overlay).toEqual({
            window: { startSec: 3.4, endSec: 6.8 },
        });
    });
    it("is deterministic", () => {
        expect((0, glyphs_1.wordStripSources)(layout, zone, INK)).toEqual((0, glyphs_1.wordStripSources)(layout, zone, INK));
    });
});
