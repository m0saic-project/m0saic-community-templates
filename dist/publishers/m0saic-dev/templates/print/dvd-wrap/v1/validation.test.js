"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const props_1 = require("./props");
const validation_1 = require("./validation");
const variants_1 = require("./variants");
const ctx = () => ({
    mode: "render",
    target: { width: 800, height: 540, fps: 30, durationMs: 1000 },
    output: { width: 800, height: 540, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-wrap-test" },
    media: {},
});
describe("DVD validation", () => {
    it("normalizes the default UPC and reports only non-fatal creative warnings", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const result = (0, validation_1.validateDvdVariant)(props_1.DVD_WRAP_DEFAULT_PROPS, variant, ctx());
        expect(result.normalizedBarcode).toBe("012345678905");
        expect(result.checkDigitValid).toBe(true);
        expect(result.diagnostics.some((item) => item.severity === "error")).toBe(false);
        expect(result.diagnostics.some((item) => item.code === "FRONT_ART_MISSING")).toBe(true);
    });
    it("isolates invalid barcodes and required missing rating artwork", () => {
        const props = { ...props_1.DVD_WRAP_DEFAULT_PROPS, usePlaceholderBadges: false };
        const variant = (0, variants_1.resolveEffectiveVariant)(props, { territory: "UK", barcodeValue: "bad", ratingCertification: "BBFC:12" });
        const codes = (0, validation_1.validateDvdVariant)(props, variant, ctx()).diagnostics.map((item) => item.code);
        expect(codes).toContain("BARCODE_INVALID");
        expect(codes).toContain("RATING_BADGE_MISSING");
    });
    it("downgrades missing required badge art to a placeholder warning", () => {
        const props = { ...props_1.DVD_WRAP_DEFAULT_PROPS, usePlaceholderBadges: true };
        const variant = (0, variants_1.resolveEffectiveVariant)(props, { territory: "UK", barcodeValue: "501234567890" });
        const result = (0, validation_1.validateDvdVariant)(props, variant, ctx());
        expect(result.diagnostics.some((item) => item.code === "RATING_PLACEHOLDER" && item.severity === "warn")).toBe(true);
        expect(result.diagnostics.some((item) => item.code === "RATING_BADGE_MISSING")).toBe(false);
    });
});
