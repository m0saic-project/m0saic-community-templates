import type {
  MosaicDocument,
  MosaicRenderableFile,
  MosaicSource,
  MosaicTextSource,
} from "@m0saic/types";
import { toM0String } from "@m0saic/dsl-stdlib";
import { barcodeToRenderable } from "@m0saic/template-utils";
import type { DvdWrapV1Props } from "../props";
import type { EffectiveDvdVariant } from "../variants";
import type { DvdValidationResult } from "../validation";
import {
  cornerRect,
  gridRects,
  mediaPiece,
  pxPerMm,
  sliceRect,
  solidPiece,
  textBlockPieces,
  textSource,
  type DvdAssetRegistry,
  type PanelGeometry,
  type PanelPiece,
} from "./common";

export type BarcodeBuild = {
  child: MosaicDocument;
  moduleWidthPx: number;
  achievedMagnificationPct: number;
};

export function buildPackagingBarcode(
  variant: EffectiveDvdVariant,
  normalizedBarcode: string,
  dpi: number,
): BarcodeBuild {
  const nominalModulePx = (0.33 / 25.4) * dpi;
  const moduleWidthPx = Math.max(1, Math.round(nominalModulePx));
  const renderable = barcodeToRenderable({
    text: normalizedBarcode,
    format: variant.profile.barcodeSymbology,
    moduleColor: "#000000",
    moduleWidthPx,
    heightPx: Math.max(moduleWidthPx * 12, Math.round(20 * pxPerMm(dpi))),
    humanReadable: { mode: "carve", heightPct: 0.18 },
  });
  const sources: MosaicSource[] = [...renderable.sources];
  const numBars = renderable.channelByRole.bars?.frames.length ?? 0;
  for (let index = 0; index < sources.length; index++) {
    sources[index] = {
      ...(sources[index] as object),
      editor: { owner: "template", label: index < numBars ? `barcode bar ${index + 1}` : `barcode HRI ${index - numBars + 1}` },
    } as MosaicSource;
  }
  for (let index = 0; index < renderable.humanReadableFrames.length; index++) {
    const frame = renderable.humanReadableFrames[index];
    const sourceIndex = numBars + index;
    if (!frame.stableKey || sourceIndex >= sources.length) continue;
    const hri: MosaicTextSource = {
      type: "text",
      rasterizer: "svg",
      style: { fontSize: Math.max(6, Math.round(frame.bounds.height * 0.7)), fontColor: "#000000" },
      layers: [{ content: { kind: "literal", text: frame.text } }],
      placement: { hAlign: "center", vAlign: "middle" },
      renderMode: { kind: "image" },
      editor: { owner: "template", label: `barcode digits ${index + 1}` },
    };
    sources[sourceIndex] = hri;
  }
  return {
    child: {
      kind: "mosaic_document",
      version: 1,
      m0: toM0String(String(renderable.m0), "DVD packaging barcode"),
      sources,
      assets: {},
      size: { width: renderable.canvasW, height: renderable.canvasH },
      fps: 30,
      durationMs: 1000,
      backgroundColor: "#ffffff",
      // A barcode is a module grid — a baked raster whose split counts ARE the
      // symbology (EAN-13 at 4 px modules: 113 columns, 70 rows). The
      // latticeSmooth convention skips it by declaration, the per-document
      // form of `lattice.mode: "bitmap"` — same as the business card's QR.
      engine: { lattice: { mode: "bitmap" } },
    },
    moduleWidthPx,
    achievedMagnificationPct: (moduleWidthPx / nominalModulePx) * 100,
  };
}

function legalText(props: DvdWrapV1Props, variant: EffectiveDvdVariant): string {
  if (variant.legalTextOverride) return variant.legalTextOverride;
  const values: Record<string, string> = {
    copyright: `${props.year ?? ""} ${props.studioName ?? ""}. ${props.copyrightText ?? ""}`.trim(),
    "all-rights-reserved": "All rights reserved.",
    "bilingual-notice": "Mandatory information: English / Francais.",
    "consumer-advice": "Consumer advice must match the approved classification.",
  };
  return variant.profile.legalClauseTokens.map((token) => values[token] ?? token.replace("anti-piracy:", "Anti-piracy: ")).join(" ");
}

function techLines(variant: EffectiveDvdVariant): string[] {
  const specs = variant.techSpecs;
  return [
    specs.runtimeMinutes ? `RUNTIME ${specs.runtimeMinutes} MIN` : "",
    [specs.aspectRatio, specs.screenFormat].filter(Boolean).join(" / "),
    [specs.discFormat, `REGION ${variant.profile.regionCode}`, variant.profile.videoStandard].filter(Boolean).join(" / "),
    specs.audioTracks?.length ? `AUDIO ${specs.audioTracks.join(", ")}` : "",
    specs.subtitleLanguages?.length ? `SUBTITLES ${specs.subtitleLanguages.join(", ")}` : "",
  ].filter(Boolean);
}

export function buildBackPanel(args: {
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  geometry: PanelGeometry;
  assets: DvdAssetRegistry;
  children: Record<string, MosaicRenderableFile>;
}): { pieces: PanelPiece[]; barcode: BarcodeBuild } {
  const { props, variant, validation, geometry, assets, children } = args;
  const pieces: PanelPiece[] = [];
  if (props.backArt) pieces.push(mediaPiece(geometry.paint, assets.media(props.backArt, "back art", "cover"), 0));
  else pieces.push(solidPiece(geometry.paint, props.backColor ?? "#10141d", "back surface", 0));
  pieces.push(solidPiece(sliceRect(geometry.trim, 0, 0, 1, 1), "#080b11@0.5", "back readability wash", 1));

  pieces.push(...textBlockPieces({
    text: variant.synopsis || "Synopsis copy not supplied.",
    rect: sliceRect(geometry.safe, 0, 0.02, 1, 0.27),
    fontSize: Math.max(8, geometry.safe.w * 0.027), color: "#ffffff",
    label: "back synopsis", maxLines: 10, importance: 3,
  }));

  const stills = (props.stills ?? []).slice(0, 6);
  const stillBand = sliceRect(geometry.safe, 0, 0.31, 1, stills.length ? 0.25 : 0.04);
  if (stills.length) {
    gridRects(stillBand, stills.length, Math.max(1, Math.round(pxPerMm(geometry.dpi)))).forEach((rect, index) => {
      pieces.push(mediaPiece(rect, assets.media(stills[index], `back still ${index + 1}`, "cover"), 3));
    });
  }

  const tech = techLines(variant);
  const techBand = sliceRect(geometry.safe, 0, stills.length ? 0.59 : 0.34, 1, 0.13);
  const techCellH = Math.max(1, Math.floor(techBand.h / Math.max(1, tech.length)));
  tech.forEach((line, index) => pieces.push({
    rect: { x: techBand.x, y: techBand.y + index * techCellH, w: techBand.w, h: index === tech.length - 1 ? techBand.h - index * techCellH : techCellH, importance: 3 },
    source: textSource({ text: line, fontSize: Math.max(7, geometry.safe.w * 0.018), color: "#e4e9f0", label: `tech spec ${index + 1}`, hAlign: "left" }),
  }));

  const audioArts = (props.audioBadgeArts ?? []).slice(0, 5);
  audioArts.forEach((path, index) => pieces.push(mediaPiece(
    sliceRect(geometry.safe, index * 0.13, 0.735, 0.11, 0.055),
    assets.media(path, `audio badge ${index + 1}`),
    3,
  )));

  const billingRect = sliceRect(geometry.safe, 0, 0.74, 0.58, 0.08);
  if (props.billingBlockArt) pieces.push(mediaPiece(billingRect, assets.media(props.billingBlockArt, "billing block"), 3));
  else pieces.push(...textBlockPieces({ text: props.billingBlockText || "BILLING BLOCK ART REQUIRED", rect: billingRect, fontSize: Math.max(6, geometry.safe.w * 0.015), color: "#c7ccd4", label: "billing block fallback", maxLines: 3, importance: 3 }));

  pieces.push(...textBlockPieces({
    text: legalText(props, variant), rect: sliceRect(geometry.safe, 0, 0.82, 0.57, 0.12),
    fontSize: Math.max(6, geometry.safe.w * 0.013), color: "#c7ccd4", label: "legal block", maxLines: 6, importance: 3,
  }));
  pieces.push(...textBlockPieces({
    text: `${variant.distributorName} ${variant.distributorAddress}`,
    rect: sliceRect(geometry.safe, 0, 0.94, 0.57, 0.055),
    fontSize: Math.max(6, geometry.safe.w * 0.014), color: "#ffffff", label: "distributor block", maxLines: 2, importance: 3,
  }));

  const barcode = buildPackagingBarcode(variant, validation.normalizedBarcode, geometry.dpi);
  const barcodeRef = `barcode-${variant.territory.toLowerCase()}`;
  children[barcodeRef] = barcode.child;
  const barcodeSource: MosaicSource = {
    type: "mosaic",
    ref: barcodeRef,
    placement: { fit: "contain" },
    editor: { owner: "template", label: "packaging barcode" },
  };
  // Leave an extra one-percent rail at the safe edge. Nested flattening can
  // quantize a boundary by one pixel, and production content must remain
  // inside the safe box even after that engine rounding.
  const barcodeRect = sliceRect(geometry.safe, 0.61, 0.81, 0.38, 0.18);
  pieces.push(solidPiece(barcodeRect, "#ffffff", "packaging barcode box", 4));
  pieces.push({ rect: { ...barcodeRect, importance: 5 }, source: barcodeSource });

  const rating = variant.profile.ratingPlacements.find((item) => item.panelId === "back");
  if (rating && (validation.ratingBadgeArt || props.usePlaceholderBadges)) {
    const size = Math.max(14, Math.min(Math.round(rating.minSizeMm * pxPerMm(geometry.dpi)), Math.round(geometry.safe.h * 0.12)));
    const rect = cornerRect(sliceRect(geometry.safe, 0, 0.78, 0.57, 0.22), rating.corner, size, Math.max(1, Math.round(pxPerMm(geometry.dpi))));
    if (validation.ratingBadgeArt) pieces.push(mediaPiece(rect, assets.media(validation.ratingBadgeArt, "back rating badge"), 5));
    else {
      pieces.push(solidPiece(rect, "#20242c", "back rating placeholder", 5));
      pieces.push({ rect: { ...rect, importance: 6 }, source: textSource({ text: variant.ratingCertification || variant.profile.ratingSystem, fontSize: Math.max(6, size * 0.15), color: "#ffffff", label: "back rating placeholder text", hAlign: "center" }) });
    }
  }

  variant.profile.requiredEcoMarks.forEach((mark, index) => {
    const rect = sliceRect(geometry.safe, 0.42 + index * 0.08, 0.945, 0.075, 0.05);
    pieces.push(solidPiece(rect, "#e8ecef", `eco placeholder ${mark}`, 5));
    pieces.push({ rect: { ...rect, importance: 6 }, source: textSource({ text: mark.toUpperCase(), fontSize: Math.max(6, rect.h * 0.25), color: "#16191e", label: `eco placeholder text ${mark}`, hAlign: "center" }) });
  });

  if (validation.distributorLogoArt) {
    pieces.push(mediaPiece(sliceRect(geometry.safe, 0.48, 0.9, 0.1, 0.08), assets.media(validation.distributorLogoArt, "distributor logo"), 5));
  }
  return { pieces, barcode };
}
