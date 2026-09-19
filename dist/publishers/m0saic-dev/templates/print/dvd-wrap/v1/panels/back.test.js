"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const back_1 = require("./back");
const dsl_1 = require("@m0saic/dsl");
const props_1 = require("../props");
const variants_1 = require("../variants");
describe("back panel barcode", () => {
    it("uses the shared barcode helper with deterministic SVG HRI digits", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const built = (0, back_1.buildPackagingBarcode)(variant, "012345678905", 300);
        expect((0, dsl_1.isValidM0String)(built.child.m0)).toBe(true);
        expect(built.moduleWidthPx).toBe(4);
        expect(built.achievedMagnificationPct).toBeCloseTo(102.6, 0);
        expect(built.child.sources.some((source) => source.editor?.label?.startsWith("barcode digits"))).toBe(true);
    });
    // The bars ARE the symbology: EAN-13 at 4 px modules is a 113-column,
    // 70-row grid, and neither count is 5-smooth. The convention exempts a
    // baked raster by declaration, not by luck — pin the declaration.
    it("declares itself a bitmap raster, so its module grid is exempt from latticeSmooth", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const built = (0, back_1.buildPackagingBarcode)(variant, "012345678905", 300);
        expect(built.child.engine?.lattice?.mode).toBe("bitmap");
    });
});
