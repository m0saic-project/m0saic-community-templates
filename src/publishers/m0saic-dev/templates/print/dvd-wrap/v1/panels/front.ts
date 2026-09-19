import type { MosaicColor } from "@m0saic/types";
import type { DvdWrapV1Props } from "../props";
import type { EffectiveDvdVariant } from "../variants";
import type { DvdValidationResult } from "../validation";
import {
  cornerRect,
  mediaPiece,
  pxPerMm,
  sliceRect,
  solidPiece,
  textBlockPieces,
  textSource,
  type DvdAssetRegistry,
  type PanelGeometry,
  type PanelPiece,
  type PxRect,
} from "./common";

function frontRatingPieces(args: {
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  geometry: PanelGeometry;
  assets: DvdAssetRegistry;
}): PanelPiece[] {
  const placement = args.variant.profile.ratingPlacements.find((item) => item.panelId === "front");
  if (!placement) return [];
  if (!args.validation.ratingBadgeArt && !args.props.usePlaceholderBadges) return [];
  const size = Math.max(16, Math.min(
    Math.round(placement.minSizeMm * pxPerMm(args.geometry.dpi)),
    Math.round(Math.min(args.geometry.trim.w, args.geometry.trim.h) * 0.3),
  ));
  const rect = cornerRect(args.geometry.trim, placement.corner, size, Math.max(2, Math.round(2 * pxPerMm(args.geometry.dpi))));
  if (args.validation.ratingBadgeArt) {
    return [mediaPiece(rect, args.assets.media(args.validation.ratingBadgeArt, "front rating badge"), 4)];
  }
  return [
    solidPiece(rect, "#20242c", "front rating placeholder", 4),
    {
      rect: { ...rect, importance: 5 },
      source: textSource({
        text: args.variant.ratingCertification || args.variant.profile.ratingSystem,
        fontSize: Math.max(7, size * 0.16),
        color: "#ffffff",
        label: "front rating placeholder text",
        hAlign: "center",
      }),
    },
  ];
}

export function buildFrontPanel(args: {
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  geometry: PanelGeometry;
  assets: DvdAssetRegistry;
}): PanelPiece[] {
  const { props, variant, geometry, assets } = args;
  const ink: MosaicColor = "#ffffff";
  const pieces: PanelPiece[] = [];
  if (props.frontArt) {
    pieces.push(mediaPiece(geometry.paint, assets.media(props.frontArt, "front key art", "cover"), 0));
  } else {
    pieces.push(solidPiece(geometry.paint, "#18263c", "front demo surface", 0));
    pieces.push(solidPiece(sliceRect(geometry.paint, 0, 0.55, 1, 0.45), "#0b1018@0.72", "front demo lower wash", 1));
  }

  const titleRect = sliceRect(geometry.safe, 0.05, 0.1, 0.9, 0.32);
  if (props.titleTreatmentArt) {
    pieces.push(mediaPiece(titleRect, assets.media(props.titleTreatmentArt, "front title treatment"), 3));
  } else {
    pieces.push(...textBlockPieces({
      text: variant.title.toUpperCase(), rect: titleRect,
      fontSize: Math.max(12, geometry.safe.w * 0.075), color: ink,
      label: "front title", maxLines: 3, hAlign: "center", importance: 3,
    }));
  }

  if (variant.editionFlash.trim()) {
    const flash = sliceRect(geometry.safe, 0.5, 0.01, 0.48, 0.08);
    pieces.push(solidPiece(flash, "#c24f18", "edition flash background", 3));
    pieces.push({ rect: { ...flash, importance: 4 }, source: textSource({ text: variant.editionFlash.toUpperCase(), fontSize: Math.max(7, flash.h * 0.34), color: "#ffffff", label: "edition flash", hAlign: "center" }) });
  }

  const laurels = (props.laurelArts ?? []).slice(0, 4);
  laurels.forEach((path, index) => {
    const width = geometry.safe.w / Math.max(2, laurels.length);
    const rect: PxRect = {
      x: Math.round(geometry.safe.x + index * width),
      y: Math.round(geometry.safe.y + geometry.safe.h * 0.68),
      w: Math.max(1, Math.round(width - pxPerMm(geometry.dpi))),
      h: Math.max(1, Math.round(geometry.safe.h * 0.11)),
    };
    pieces.push(mediaPiece(rect, assets.media(path, `front laurel ${index + 1}`), 3));
  });

  if (props.studioLogoArt) {
    pieces.push(mediaPiece(sliceRect(geometry.safe, 0.68, 0.86, 0.3, 0.1), assets.media(props.studioLogoArt, "front studio logo"), 3));
  } else if (props.studioName) {
    pieces.push({
      rect: { ...sliceRect(geometry.safe, 0.62, 0.88, 0.36, 0.08), importance: 3 },
      source: textSource({ text: props.studioName.toUpperCase(), fontSize: Math.max(7, geometry.safe.w * 0.025), color: ink, label: "front studio name", hAlign: "right" }),
    });
  }

  pieces.push(...frontRatingPieces(args));
  return pieces;
}
