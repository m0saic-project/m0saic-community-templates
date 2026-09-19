"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const profiles_1 = require("./profiles");
describe("DVD territory profiles", () => {
    it("seeds the seven promised markets with structural barcode and video facts", () => {
        expect(Object.keys(profiles_1.SEEDED_TERRITORY_PROFILES)).toEqual(["US", "CA", "UK", "DE", "FR", "AU", "JP"]);
        expect(profiles_1.SEEDED_TERRITORY_PROFILES.US.barcodeSymbology).toBe("upca");
        expect(profiles_1.SEEDED_TERRITORY_PROFILES.UK.barcodeSymbology).toBe("ean13");
        expect(profiles_1.SEEDED_TERRITORY_PROFILES.DE.ratingPlacements[0]).toMatchObject({ panelId: "front", corner: "bottom-left", required: true });
        expect(profiles_1.SEEDED_TERRITORY_PROFILES.FR.requiredEcoMarks).toContain("Triman");
    });
    it("builds an obviously neutral placeholder from labeled sources", () => {
        const sources = (0, profiles_1.placeholderBadgeSources)("BBFC:12");
        expect(sources).toHaveLength(2);
        expect(sources.every((source) => source.editor?.label)).toBe(true);
    });
});
