"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const props_1 = require("./props");
describe("DVD wrap props", () => {
    it("keeps every media picker top-level and makes title the only required content prop", () => {
        expect(props_1.dvdWrapPropsSchema.title.required).toBe(true);
        for (const key of ["frontArt", "backArt", "spineArt", "titleTreatmentArt", "stills", "ratingBadgeArts"]) {
            expect(props_1.dvdWrapPropsSchema[key].type).toMatch(/^media/);
        }
        expect(props_1.dvdWrapPropsSchema.variants.type).toBe("json");
        expect(props_1.dvdWrapPropsSchema.ratingBadgeCerts.meta?.constraints?.lengthOf).toBe("ratingBadgeArts");
    });
    it("ships deterministic single-SKU print defaults", () => {
        expect(props_1.DVD_WRAP_DEFAULT_PROPS).toMatchObject({ territory: "US", dpi: 300, bleedMm: 3, artifacts: ["wrap"] });
        expect(props_1.DVD_WRAP_DEFAULT_PROPS.title).toBeTruthy();
    });
});
