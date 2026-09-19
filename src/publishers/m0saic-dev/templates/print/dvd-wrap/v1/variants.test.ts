import type { TerritoryProfile } from "@m0saic/template-utils";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";
import { parseDvdVariants, requestedVariants, resolveEffectiveVariant } from "./variants";

describe("DVD variant algebra", () => {
  it("uses the single-SKU degenerate case when variants are absent", () => {
    expect(requestedVariants(DVD_WRAP_DEFAULT_PROPS)).toEqual([undefined]);
    const resolved = resolveEffectiveVariant(DVD_WRAP_DEFAULT_PROPS);
    expect(resolved.territory).toBe("US");
    expect(resolved.profile.barcodeSymbology).toBe("upca");
  });

  it("applies variant data and structural overrides over base/global values", () => {
    const resolved = resolveEffectiveVariant(
      { ...DVD_WRAP_DEFAULT_PROPS, profileOverrides: { videoStandard: "PAL" } },
      { territory: "UK", titleOverride: "LOCAL TITLE", profile: { regionCode: "9" } },
    );
    expect(resolved.title).toBe("LOCAL TITLE");
    expect(resolved.profile.videoStandard).toBe("PAL");
    expect(resolved.profile.regionCode).toBe("9");
    expect(resolved.profile.barcodeSymbology).toBe("ean13");
  });

  it("accepts parsed or string JSON and rejects incomplete custom profiles", () => {
    expect(parseDvdVariants('[{"territory":"DE"}]')).toEqual([{ territory: "DE" }]);
    expect(() => resolveEffectiveVariant(DVD_WRAP_DEFAULT_PROPS, { territory: "custom", profile: { id: "x" } })).toThrow(/complete profile/);
    const custom: TerritoryProfile = {
      id: "X", label: "Custom", barcodeSymbology: "ean13", regionCode: "0", videoStandard: "PAL", ratingSystem: "Custom",
      ratingPlacements: [], legalClauseTokens: [], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: [], facts: {},
    };
    expect(resolveEffectiveVariant(DVD_WRAP_DEFAULT_PROPS, { territory: "custom", profile: custom }).profile.id).toBe("X");
  });
});
