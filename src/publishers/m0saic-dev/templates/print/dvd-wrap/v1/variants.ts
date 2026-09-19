import type { TerritoryProfile } from "@m0saic/template-utils";
import { SEEDED_TERRITORY_PROFILES } from "./profiles";
import type { DvdTechSpecs, DvdWrapV1Props, DvdWrapVariant } from "./props";

export type EffectiveDvdVariant = {
  territory: string;
  skuLabel: string;
  profile: TerritoryProfile;
  title: string;
  synopsis: string;
  editionFlash: string;
  barcodeValue: string;
  catalogNumber: string;
  ratingCertification: string;
  distributorName: string;
  distributorAddress: string;
  legalTextOverride?: string;
  techSpecs: DvdTechSpecs;
};

function objectValue(value: unknown, label: string): Record<string, unknown> | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be an object`);
  }
  return parsed as Record<string, unknown>;
}

export function parseDvdVariants(value: DvdWrapV1Props["variants"]): DvdWrapVariant[] {
  if (value == null || value === "") return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error("variants must be an array");
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`variants[${index}] must be an object`);
    }
    const candidate = entry as Partial<DvdWrapVariant>;
    if (typeof candidate.territory !== "string" || !candidate.territory.trim()) {
      throw new Error(`variants[${index}].territory is required`);
    }
    return candidate as DvdWrapVariant;
  });
}

function mergeProfile(
  base: TerritoryProfile,
  globalOverride: Partial<TerritoryProfile> | undefined,
  variantOverride: Partial<TerritoryProfile> | undefined,
): TerritoryProfile {
  const merged = { ...base, ...(globalOverride ?? {}), ...(variantOverride ?? {}) };
  return {
    ...merged,
    ratingPlacements: variantOverride?.ratingPlacements ?? globalOverride?.ratingPlacements ?? base.ratingPlacements,
    legalClauseTokens: variantOverride?.legalClauseTokens ?? globalOverride?.legalClauseTokens ?? base.legalClauseTokens,
    requiredEcoMarks: variantOverride?.requiredEcoMarks ?? globalOverride?.requiredEcoMarks ?? base.requiredEcoMarks,
    facts: { ...base.facts, ...(globalOverride?.facts ?? {}), ...(variantOverride?.facts ?? {}) },
  };
}

function completeCustomProfile(value: Partial<TerritoryProfile> | undefined): TerritoryProfile {
  const required: Array<keyof TerritoryProfile> = [
    "id", "label", "barcodeSymbology", "regionCode", "videoStandard", "ratingSystem",
    "ratingPlacements", "legalClauseTokens", "spineTextDirection", "bilingual", "requiredEcoMarks", "facts",
  ];
  const missing = required.filter((key) => value?.[key] == null);
  if (missing.length) {
    throw new Error(`territory custom requires a complete profile; missing ${missing.join(", ")}`);
  }
  return value as TerritoryProfile;
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "dvd";
}

export function resolveEffectiveVariant(
  props: DvdWrapV1Props,
  variant?: DvdWrapVariant,
): EffectiveDvdVariant {
  const territory = (variant?.territory ?? props.territory ?? "US").trim();
  const globalOverride = objectValue(props.profileOverrides, "profileOverrides") as Partial<TerritoryProfile> | undefined;
  const profile = territory === "custom"
    ? completeCustomProfile({ ...(globalOverride ?? {}), ...(variant?.profile ?? {}) })
    : (() => {
        const seeded = SEEDED_TERRITORY_PROFILES[territory as keyof typeof SEEDED_TERRITORY_PROFILES];
        if (!seeded) throw new Error(`unknown territory profile ${JSON.stringify(territory)}`);
        return mergeProfile(seeded, globalOverride, variant?.profile);
      })();

  const title = (variant?.titleOverride ?? props.title ?? "").trim();
  if (!title) throw new Error("title is required");
  const skuLabel = (variant?.skuLabel ?? `${slug(title)}-${territory}`).trim();
  return {
    territory,
    skuLabel,
    profile,
    title,
    synopsis: variant?.synopsisOverride ?? props.synopsis ?? "",
    editionFlash: variant?.editionFlashOverride ?? props.editionFlash ?? "",
    barcodeValue: variant?.barcodeValue ?? props.barcodeValue ?? "",
    catalogNumber: variant?.catalogNumber ?? props.catalogNumber ?? "",
    ratingCertification: variant?.ratingCertification ?? props.ratingCertification ?? "",
    distributorName: variant?.distributorName ?? props.distributorName ?? "",
    distributorAddress: variant?.distributorAddress ?? props.distributorAddress ?? "",
    ...(variant?.legalTextOverride ? { legalTextOverride: variant.legalTextOverride } : {}),
    techSpecs: { ...(props.techSpecs ?? {}), ...(variant?.techSpecOverrides ?? {}) },
  };
}

export function requestedVariants(props: DvdWrapV1Props): Array<DvdWrapVariant | undefined> {
  const variants = parseDvdVariants(props.variants);
  return variants.length ? variants : [undefined];
}
