import type { MosaicEngineContext } from "@m0saic/types";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";
import { validateDvdVariant } from "./validation";
import { resolveEffectiveVariant } from "./variants";

const ctx = (): MosaicEngineContext => ({
  mode: "render",
  target: { width: 800, height: 540, fps: 30, durationMs: 1000 },
  output: { width: 800, height: 540, fps: 30, durationMs: 1000, workspaceDir: "/tmp/dvd-wrap-test" },
  media: {},
});

describe("DVD validation", () => {
  it("normalizes the default UPC and reports only non-fatal creative warnings", () => {
    const variant = resolveEffectiveVariant(DVD_WRAP_DEFAULT_PROPS);
    const result = validateDvdVariant(DVD_WRAP_DEFAULT_PROPS, variant, ctx());
    expect(result.normalizedBarcode).toBe("012345678905");
    expect(result.checkDigitValid).toBe(true);
    expect(result.diagnostics.some((item) => item.severity === "error")).toBe(false);
    expect(result.diagnostics.some((item) => item.code === "FRONT_ART_MISSING")).toBe(true);
  });

  it("isolates invalid barcodes and required missing rating artwork", () => {
    const props = { ...DVD_WRAP_DEFAULT_PROPS, usePlaceholderBadges: false };
    const variant = resolveEffectiveVariant(props, { territory: "UK", barcodeValue: "bad", ratingCertification: "BBFC:12" });
    const codes = validateDvdVariant(props, variant, ctx()).diagnostics.map((item) => item.code);
    expect(codes).toContain("BARCODE_INVALID");
    expect(codes).toContain("RATING_BADGE_MISSING");
  });

  it("downgrades missing required badge art to a placeholder warning", () => {
    const props = { ...DVD_WRAP_DEFAULT_PROPS, usePlaceholderBadges: true };
    const variant = resolveEffectiveVariant(props, { territory: "UK", barcodeValue: "501234567890" });
    const result = validateDvdVariant(props, variant, ctx());
    expect(result.diagnostics.some((item) => item.code === "RATING_PLACEHOLDER" && item.severity === "warn")).toBe(true);
    expect(result.diagnostics.some((item) => item.code === "RATING_BADGE_MISSING")).toBe(false);
  });
});
