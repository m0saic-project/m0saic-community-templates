import type { MosaicEngineContext } from "@m0saic/types";
import { asAssetId } from "@m0saic/types";
import { ean13Encode, upcaEncode } from "@m0saic/dsl-stdlib";
import {
  classifyEffectiveDpi,
  effectiveDpi,
  type DpiFloorClassification,
  type ResolvedDieline,
} from "@m0saic/template-utils";
import type { DvdPanelId } from "./dieline";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";
import type { EffectiveDvdVariant } from "./variants";

export type DvdDiagnostic = {
  severity: "error" | "warn";
  code: string;
  message: string;
};

export type DvdAssetDpiRecord = {
  prop: string;
  path: string;
  px?: [number, number];
  placedMm: [number, number];
  effectiveDpi?: number;
  classification: DpiFloorClassification | "unprobed";
};

export type DvdPackagingSidecar = {
  templateId: "@m0saic-dev/print/dvd-wrap/v1";
  schemaVersion: 1;
  artifact: DvdWrapArtifact;
  variant: { territory: string; skuLabel: string; catalogNumber: string };
  dieline: {
    caseType: string;
    spineMm: number;
    trimMm: [number, number];
    bleedMm: number;
    dpi: number;
    pxSize: [number, number];
    panelPx: Record<string, { x: number; y: number; width: number; height: number }>;
  };
  barcode: {
    symbology: string;
    payload: string;
    checkDigitValid: boolean;
    moduleWidthPx: number;
    achievedMagnificationPct: number;
  };
  elements: Array<{ id: string; panel: string; present: boolean; placeholder: boolean }>;
  text: Array<{ id: string; characters: number; overflowRisk: boolean }>;
  assets: DvdAssetDpiRecord[];
  layout: unknown[];
  colorSpace: "sRGB";
  notes: string[];
  postProcess: null;
  errors: DvdDiagnostic[];
  warnings: DvdDiagnostic[];
};

export type DvdValidationResult = {
  diagnostics: DvdDiagnostic[];
  normalizedBarcode: string;
  checkDigitValid: boolean;
  ratingBadgeArt?: string;
  distributorLogoArt?: string;
  assetDpi: DvdAssetDpiRecord[];
};

function joinedArt(keys: string[] | undefined, arts: string[] | undefined, key: string): string | undefined {
  if (!keys || !arts || !key) return undefined;
  const index = keys.indexOf(key);
  return index >= 0 ? arts[index] : undefined;
}

function assetRecord(
  prop: string,
  path: string,
  placedMm: [number, number],
  props: DvdWrapV1Props,
  ctx: MosaicEngineContext,
): DvdAssetDpiRecord {
  const meta = ctx.media[asAssetId(path)];
  if (!meta || meta.width <= 0 || meta.height <= 0) {
    return { prop, path, placedMm, classification: "unprobed" };
  }
  const dpi = effectiveDpi(
    { width: meta.width, height: meta.height },
    { width: placedMm[0], height: placedMm[1] },
  );
  return {
    prop,
    path,
    px: [meta.width, meta.height],
    placedMm,
    effectiveDpi: Math.round(dpi.min * 10) / 10,
    classification: classifyEffectiveDpi(dpi.min, props.dpiFloorPolicy ?? "warn"),
  };
}

function collectAssetDpi(props: DvdWrapV1Props, ctx: MosaicEngineContext): DvdAssetDpiRecord[] {
  const out: DvdAssetDpiRecord[] = [];
  const one = (prop: string, path: string | undefined, placed: [number, number]) => {
    if (path) out.push(assetRecord(prop, path, placed, props, ctx));
  };
  one("frontArt", props.frontArt, [130, 184]);
  one("backArt", props.backArt, [130, 184]);
  one("spineArt", props.spineArt, [props.spineWidthMm ?? 14, 184]);
  one("titleTreatmentArt", props.titleTreatmentArt, [105, 44]);
  one("studioLogoArt", props.studioLogoArt, [28, 14]);
  one("billingBlockArt", props.billingBlockArt, [70, 12]);
  (props.stills ?? []).slice(0, 6).forEach((path, index) => one(`stills[${index}]`, path, [55, 32]));
  (props.laurelArts ?? []).forEach((path, index) => one(`laurelArts[${index}]`, path, [22, 14]));
  (props.audioBadgeArts ?? []).forEach((path, index) => one(`audioBadgeArts[${index}]`, path, [16, 8]));
  (props.ratingBadgeArts ?? []).forEach((path, index) => one(`ratingBadgeArts[${index}]`, path, [18, 18]));
  (props.distributorLogoArts ?? []).forEach((path, index) => one(`distributorLogoArts[${index}]`, path, [24, 12]));
  return out;
}

export function validateDvdVariant(
  props: DvdWrapV1Props,
  variant: EffectiveDvdVariant,
  ctx: MosaicEngineContext,
): DvdValidationResult {
  const diagnostics: DvdDiagnostic[] = [];
  const error = (code: string, message: string) => diagnostics.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => diagnostics.push({ severity: "warn", code, message });

  if (!props.frontArt) warn("FRONT_ART_MISSING", "frontArt is recommended for a production master; the deterministic demo surface is being used");
  if (!variant.catalogNumber.trim()) error("CATALOG_NUMBER_MISSING", "catalogNumber is required for production packaging");
  if (!variant.distributorName.trim() || !variant.distributorAddress.trim()) {
    error("DISTRIBUTOR_BLOCK_MISSING", "distributorName and distributorAddress are required");
  }
  if (!props.copyrightText?.trim()) error("COPYRIGHT_MISSING", "copyrightText is required");
  if ((props.ratingBadgeArts?.length ?? 0) !== (props.ratingBadgeCerts?.length ?? 0)) {
    error("RATING_BADGE_JOIN_LENGTH", "ratingBadgeArts and ratingBadgeCerts must have equal lengths");
  }
  if ((props.distributorLogoArts?.length ?? 0) !== (props.distributorLogoKeys?.length ?? 0)) {
    error("DISTRIBUTOR_LOGO_JOIN_LENGTH", "distributorLogoArts and distributorLogoKeys must have equal lengths");
  }
  if ((props.stills?.length ?? 0) > 6) error("STILLS_LIMIT", "stills accepts at most 6 images");

  let normalizedBarcode = variant.barcodeValue;
  let checkDigitValid = false;
  try {
    const encoded = variant.profile.barcodeSymbology === "upca"
      ? upcaEncode(variant.barcodeValue)
      : ean13Encode(variant.barcodeValue);
    normalizedBarcode = encoded.payload;
    checkDigitValid = true;
  } catch (cause) {
    error("BARCODE_INVALID", cause instanceof Error ? cause.message : String(cause));
  }

  const ratingBadgeArt = joinedArt(
    props.ratingBadgeCerts,
    props.ratingBadgeArts,
    variant.ratingCertification,
  );
  const requiredRating = variant.profile.ratingPlacements.some((placement) => placement.required);
  if (requiredRating && !ratingBadgeArt) {
    if (props.usePlaceholderBadges) {
      warn("RATING_PLACEHOLDER", `No supplied artwork matches ${variant.ratingCertification || "the certification"}; using a neutral preview placeholder`);
    } else {
      error("RATING_BADGE_MISSING", `Territory ${variant.territory} requires rating artwork matching ${variant.ratingCertification || "ratingCertification"}`);
    }
  }
  if (variant.profile.requiredEcoMarks.length) {
    warn("ECO_MARK_ART_REQUIRED", `${variant.territory} profile calls for user-supplied ${variant.profile.requiredEcoMarks.join(", ")} artwork; neutral proof labels are emitted`);
  }
  if (variant.profile.bilingual && !/[;/]|\b(?:et|and)\b/i.test(variant.synopsis)) {
    warn("BILINGUAL_COPY_REVIEW", `${variant.territory} profile is bilingual; review localized title, synopsis, and mandatory copy`);
  }
  if (variant.synopsis.length > 950) warn("SYNOPSIS_FIT", "Synopsis is long enough to require production fit review");
  if (variant.title.length > 42) warn("SPINE_TITLE_FIT", "Title is long enough to require spine fit review");

  const assetDpi = collectAssetDpi(props, ctx);
  for (const record of assetDpi) {
    if (record.classification === "error") {
      error("ASSET_DPI_LOW", `${record.prop} is ${record.effectiveDpi} effective DPI (strict floor 150)`);
    } else if (record.classification === "warn") {
      warn("ASSET_DPI_WARN", `${record.prop} is ${record.effectiveDpi} effective DPI (preferred 300)`);
    } else if (record.classification === "unprobed") {
      warn("ASSET_UNPROBED", `${record.prop} has no probed pixel dimensions; effective DPI is unknown`);
    }
  }

  return {
    diagnostics,
    normalizedBarcode,
    checkDigitValid,
    ...(ratingBadgeArt ? { ratingBadgeArt } : {}),
    ...(joinedArt(props.distributorLogoKeys, props.distributorLogoArts, variant.distributorName)
      ? { distributorLogoArt: joinedArt(props.distributorLogoKeys, props.distributorLogoArts, variant.distributorName) }
      : {}),
    assetDpi,
  };
}

export function buildPackagingSidecar(args: {
  artifact: DvdWrapArtifact;
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  dieline: ResolvedDieline<DvdPanelId>;
  validation: DvdValidationResult;
  moduleWidthPx: number;
  achievedMagnificationPct: number;
  layout?: unknown[];
}): DvdPackagingSidecar {
  const errors = args.validation.diagnostics.filter((d) => d.severity === "error");
  const warnings = args.validation.diagnostics.filter((d) => d.severity === "warn");
  const spine = args.dieline.panels.find((panel) => panel.id === "spine");
  const ratingPresent = !!args.validation.ratingBadgeArt || !!args.props.usePlaceholderBadges;
  return {
    templateId: "@m0saic-dev/print/dvd-wrap/v1",
    schemaVersion: 1,
    artifact: args.artifact,
    variant: { territory: args.variant.territory, skuLabel: args.variant.skuLabel, catalogNumber: args.variant.catalogNumber },
    dieline: {
      caseType: args.props.caseType ?? "standard",
      spineMm: spine?.widthMm ?? 0,
      trimMm: [args.dieline.trimWidthMm, args.dieline.spec.heightMm],
      bleedMm: args.dieline.spec.bleedMm,
      dpi: args.dieline.dpi,
      pxSize: [args.dieline.canvas.width, args.dieline.canvas.height],
      panelPx: Object.fromEntries(args.dieline.panels.map((panel) => [panel.id, panel.trim])),
    },
    barcode: {
      symbology: args.variant.profile.barcodeSymbology,
      payload: args.validation.normalizedBarcode,
      checkDigitValid: args.validation.checkDigitValid,
      moduleWidthPx: args.moduleWidthPx,
      achievedMagnificationPct: Math.round(args.achievedMagnificationPct * 10) / 10,
    },
    elements: [
      { id: "ratingBadge", panel: "profile-driven", present: ratingPresent, placeholder: !args.validation.ratingBadgeArt && !!args.props.usePlaceholderBadges },
      ...args.variant.profile.requiredEcoMarks.map((id) => ({ id, panel: "back", present: true, placeholder: true })),
    ],
    text: [
      { id: "synopsis", characters: args.variant.synopsis.length, overflowRisk: args.variant.synopsis.length > 950 },
      { id: "spineTitle", characters: args.variant.title.length, overflowRisk: args.variant.title.length > 42 },
    ],
    assets: args.validation.assetDpi,
    layout: args.layout ?? [],
    colorSpace: "sRGB",
    notes: [
      "RGB master; CMYK conversion is downstream.",
      "Seeded territory profiles are production defaults, not legal advice.",
      ...(args.variant.profile.requiredEcoMarks.length ? ["Eco-mark proof labels are not licensed final artwork."] : []),
    ],
    postProcess: null,
    errors,
    warnings,
  };
}
