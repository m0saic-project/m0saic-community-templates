import type { MosaicColor, MosaicSource, MosaicTextSource } from "@m0saic/types";
import type { TerritoryProfile } from "@m0saic/template-utils";
import { makeColorTile } from "@m0saic/template-utils";
import type { DvdTerritoryId } from "./props";

export type SeededTerritoryId = Exclude<DvdTerritoryId, "custom">;

const profile = (value: TerritoryProfile): TerritoryProfile => value;

export const SEEDED_TERRITORY_PROFILES: Readonly<Record<SeededTerritoryId, TerritoryProfile>> = {
  US: profile({
    id: "US", label: "United States", barcodeSymbology: "upca", regionCode: "1", videoStandard: "NTSC", ratingSystem: "MPAA",
    ratingPlacements: [{ panelId: "back", corner: "bottom-left", minSizeMm: 12, required: false }],
    legalClauseTokens: ["copyright", "all-rights-reserved", "anti-piracy:FBI"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: [],
    facts: { rating: "convention", barcode: "verified", antiPiracy: "convention" },
  }),
  CA: profile({
    id: "CA", label: "Canada", barcodeSymbology: "upca", regionCode: "1", videoStandard: "NTSC", ratingSystem: "CHVRS/Quebec",
    ratingPlacements: [{ panelId: "back", corner: "bottom-left", minSizeMm: 12, required: false }],
    legalClauseTokens: ["copyright", "bilingual-notice", "anti-piracy:RCMP"], spineTextDirection: "top-to-bottom", bilingual: true, requiredEcoMarks: [],
    facts: { bilingual: "statutory", rating: "convention", barcode: "verified" },
  }),
  UK: profile({
    id: "UK", label: "United Kingdom", barcodeSymbology: "ean13", regionCode: "2", videoStandard: "PAL", ratingSystem: "BBFC",
    ratingPlacements: [
      { panelId: "front", corner: "bottom-left", minSizeMm: 12, required: true },
      { panelId: "spine", corner: "bottom-left", minSizeMm: 8, required: true },
      { panelId: "back", corner: "bottom-left", minSizeMm: 12, required: true },
    ],
    legalClauseTokens: ["copyright", "all-rights-reserved", "anti-piracy:FACT"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: [],
    facts: { rating: "statutory", ratingSize: "verify-P2", barcode: "verified" },
  }),
  DE: profile({
    id: "DE", label: "Germany", barcodeSymbology: "ean13", regionCode: "2", videoStandard: "PAL", ratingSystem: "FSK",
    ratingPlacements: [
      { panelId: "front", corner: "bottom-left", minSizeMm: 35, required: true },
      { panelId: "back", corner: "bottom-left", minSizeMm: 18, required: true },
    ],
    legalClauseTokens: ["copyright", "all-rights-reserved", "anti-piracy:GVU"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: ["Green Dot"],
    facts: { rating: "statutory", frontArea: "verified", eco: "statutory", barcode: "verified" },
  }),
  FR: profile({
    id: "FR", label: "France", barcodeSymbology: "ean13", regionCode: "2", videoStandard: "PAL", ratingSystem: "CNC",
    ratingPlacements: [
      { panelId: "front", corner: "bottom-left", minSizeMm: 12, required: true },
      { panelId: "back", corner: "bottom-left", minSizeMm: 12, required: true },
    ],
    legalClauseTokens: ["copyright", "all-rights-reserved", "anti-piracy:ALPA"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: ["Triman"],
    facts: { rating: "statutory", ratingSize: "verify-P2", eco: "statutory", barcode: "verified" },
  }),
  AU: profile({
    id: "AU", label: "Australia", barcodeSymbology: "ean13", regionCode: "4", videoStandard: "PAL", ratingSystem: "ACB",
    ratingPlacements: [
      { panelId: "front", corner: "bottom-left", minSizeMm: 14, required: true },
      { panelId: "back", corner: "bottom-left", minSizeMm: 14, required: true },
    ],
    legalClauseTokens: ["copyright", "consumer-advice", "anti-piracy:AFACT"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: [],
    facts: { rating: "statutory", ratingSize: "verify-P2", barcode: "verified" },
  }),
  JP: profile({
    id: "JP", label: "Japan", barcodeSymbology: "ean13", regionCode: "2", videoStandard: "NTSC", ratingSystem: "Eirin/JVA",
    ratingPlacements: [{ panelId: "back", corner: "bottom-left", minSizeMm: 10, required: false }],
    legalClauseTokens: ["copyright", "all-rights-reserved", "anti-piracy:ACCS/JVA"], spineTextDirection: "top-to-bottom", bilingual: false, requiredEcoMarks: ["Recycling"],
    facts: { rating: "convention", obi: "convention", barcode: "verified" },
  }),
};

/** Clearly unofficial preview-only badge: neutral frame + literal certification. */
export function placeholderBadgeSources(
  certification: string,
  color: MosaicColor = "#111111",
): MosaicSource[] {
  const text: MosaicTextSource = {
    type: "text",
    rasterizer: "svg",
    style: { fontSize: 24, fontColor: "#ffffff" },
    layers: [{ content: { kind: "literal", text: certification || "RATING" } }],
    placement: { hAlign: "center", vAlign: "middle" },
    renderMode: { kind: "image" },
    editor: { owner: "template", label: "rating placeholder text" },
  };
  const base = makeColorTile(color);
  base.editor = { owner: "template", label: "rating placeholder" };
  return [base, text];
}
