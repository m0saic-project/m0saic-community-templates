"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_utils_1 = require("@m0saic/template-utils");
const spine_1 = require("./spine");
const common_1 = require("./common");
const props_1 = require("../props");
const variants_1 = require("../variants");
const geometry = { id: "spine", trim: { x: 0, y: 0, w: 42, h: 552 }, paint: { x: 0, y: 0, w: 42, h: 552 }, safe: { x: 6, y: 6, w: 30, h: 540 }, widthMm: 14, heightMm: 184, dpi: 76.2 };
describe("spine panel", () => {
    it("turns the title into an ordered vertical run and includes the catalog number", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const built = (0, spine_1.buildSpinePanel)({ props: props_1.DVD_WRAP_DEFAULT_PROPS, variant, validation: { diagnostics: [], normalizedBarcode: variant.barcodeValue, checkDigitValid: true, assetDpi: [] }, geometry, assets: (0, common_1.createDvdAssetRegistry)() });
        expect(built.pieces.some((piece) => piece.source.editor?.label === "spine vertical title")).toBe(true);
        expect(built.children["spine-title"].sources.filter((source) => source.editor?.label?.startsWith("spine title")).length).toBeGreaterThan(5);
        expect(built.pieces.some((piece) => piece.source.editor?.label === "spine catalog number")).toBe(true);
    });
    // The title box is the union of text-metric glyph cells — a rough height by
    // default (this geometry's band is 335 px tall = 5·67). The height is grown
    // to the next 5-smooth size so placeInsetPieces never degrades to a rough
    // row lattice; the width stays the exact glyph span (one column — it never
    // splits, and padding it would cost a fine column lattice on every row).
    // Parent placement and child size stay one rect.
    it("gives the vertical title a 5-smooth height, the exact glyph width, and a box inside the panel", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const built = (0, spine_1.buildSpinePanel)({ props: props_1.DVD_WRAP_DEFAULT_PROPS, variant, validation: { diagnostics: [], normalizedBarcode: variant.barcodeValue, checkDigitValid: true, assetDpi: [] }, geometry, assets: (0, common_1.createDvdAssetRegistry)() });
        const child = built.children["spine-title"];
        const placement = built.pieces.find((piece) => piece.source.editor?.label === "spine vertical title").rect;
        expect((0, template_utils_1.isSmooth)(child.size.height)).toBe(true);
        // Width = the glyph span exactly: for this geometry sliceRect(safe, 0.05, …, 0.9, …) → 27 px.
        expect(child.size.width).toBe(Math.round(geometry.safe.w * 0.9));
        expect({ w: placement.w, h: placement.h }).toEqual({ w: child.size.width, h: child.size.height });
        expect(placement.x + placement.w).toBeLessThanOrEqual(geometry.paint.x + geometry.paint.w);
        expect(placement.y + placement.h).toBeLessThanOrEqual(geometry.paint.y + geometry.paint.h);
        // The thing the doctor measures: no rough split count above the content basis.
        const counts = (0, template_utils_1.splitCounts)(child.m0);
        for (const n of [...counts.cols, ...counts.rows]) {
            expect(n <= 12 || (0, template_utils_1.isSmooth)(n)).toBe(true);
        }
    });
});
