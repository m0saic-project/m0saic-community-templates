import { DVD_WRAP_DEFAULT_PROPS, dvdWrapPropsSchema } from "./props";

describe("DVD wrap props", () => {
  it("keeps every media picker top-level and makes title the only required content prop", () => {
    expect(dvdWrapPropsSchema.title.required).toBe(true);
    for (const key of ["frontArt", "backArt", "spineArt", "titleTreatmentArt", "stills", "ratingBadgeArts"]) {
      expect(dvdWrapPropsSchema[key as keyof typeof dvdWrapPropsSchema].type).toMatch(/^media/);
    }
    expect(dvdWrapPropsSchema.variants.type).toBe("json");
    expect(dvdWrapPropsSchema.ratingBadgeCerts.meta?.constraints?.lengthOf).toBe("ratingBadgeArts");
  });

  it("ships deterministic single-SKU print defaults", () => {
    expect(DVD_WRAP_DEFAULT_PROPS).toMatchObject({ territory: "US", dpi: 300, bleedMm: 3, artifacts: ["wrap"] });
    expect(DVD_WRAP_DEFAULT_PROPS.title).toBeTruthy();
  });
});
