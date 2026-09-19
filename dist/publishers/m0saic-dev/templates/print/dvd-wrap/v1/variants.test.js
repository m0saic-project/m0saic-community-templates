"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const props_1 = require("./props");
const variants_1 = require("./variants");
describe("DVD variant algebra", () => {
    it("uses the single-SKU degenerate case when variants are absent", () => {
        expect((0, variants_1.requestedVariants)(props_1.DVD_WRAP_DEFAULT_PROPS)).toEqual([undefined]);
        const resolved = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        expect(resolved.territory).toBe("US");
        expect(resolved.profile.barcodeSymbology).toBe("upca");
    });
    it("applies variant data and structural overrides over base/global values", () => {
        const resolved = (0, variants_1.resolveEffectiveVariant)({ ...props_1.DVD_WRAP_DEFAULT_PROPS, profileOverrides: { videoStandard: "PAL" } }, { territory: "UK", titleOverride: "LOCAL TITLE", profile: { regionCode: "9" } });
        expect(resolved.title).toBe("LOCAL TITLE");
        expect(resolved.profile.videoStandard).toBe("PAL");
        expect(resolved.profile.regionCode).toBe("9");
        expect(resolved.profile.barcodeSymbology).toBe("ean13");
    });
    it("accepts parsed or string JSON and rejects incomplete custom profiles", () => {
        expect((0, variants_1.parseDvdVariants)('[{"territory":"DE"}]')).toEqual([{ territory: "DE" }]);
        expect(() => (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS, { territory: "custom", profile: { id: "x" } })).toThrow(/complete profile/);
        const custom = {
            id: "X", label: "Custom", barcodeSymbology: "ean13", regionCode: "0", videoStandard: "PAL", ratingSystem: "Custom",
            ratingPlacements: [], legalClauseTokens: [], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: [], facts: {},
        };
        expect((0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS, { territory: "custom", profile: custom }).profile.id).toBe("X");
    });
});
