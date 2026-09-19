import type { MosaicDocument, MosaicSource } from "@m0saic/types";
import { ceilToSmooth, placeInsetPieces } from "@m0saic/template-utils";
import type { DvdWrapV1Props } from "../props";
import type { EffectiveDvdVariant } from "../variants";
import type { DvdValidationResult } from "../validation";
import {
  cornerRect,
  mediaPiece,
  pxPerMm,
  sliceRect,
  solidPiece,
  textSource,
  type DvdAssetRegistry,
  type PanelGeometry,
  type PanelPiece,
} from "./common";

function verticalTitlePieces(
  title: string,
  geometry: PanelGeometry,
  direction: "top-to-bottom" | "bottom-to-top",
): PanelPiece[] {
  const clipped = title.trim().toUpperCase().slice(0, 28);
  const chars = [...clipped];
  if (direction === "bottom-to-top") chars.reverse();
  if (!chars.length) return [];
  const band = sliceRect(geometry.safe, 0.05, 0.16, 0.9, 0.62);
  const cellH = Math.max(1, Math.floor(band.h / chars.length));
  return chars.map((char, index) => ({
    rect: {
      x: band.x,
      y: band.y + index * cellH,
      w: band.w,
      h: index === chars.length - 1 ? band.h - index * cellH : cellH,
      importance: 3,
    },
    source: textSource({
      text: char === " " ? "·" : char,
      fontSize: Math.max(6, Math.min(band.w * 0.62, cellH * 0.82)),
      color: "#ffffff",
      label: `spine title ${index + 1}`,
      hAlign: "center",
    }),
  }));
}

export function buildSpinePanel(args: {
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  geometry: PanelGeometry;
  assets: DvdAssetRegistry;
}): { pieces: PanelPiece[]; children: Record<string, MosaicDocument> } {
  const { props, variant, validation, geometry, assets } = args;
  const pieces: PanelPiece[] = [];
  const children: Record<string, MosaicDocument> = {};
  if (props.spineArt) pieces.push(mediaPiece(geometry.paint, assets.media(props.spineArt, "spine art", "cover"), 0));
  else pieces.push(solidPiece(geometry.paint, props.backColor ?? "#10141d", "spine surface", 0));

  if (props.studioLogoArt) {
    pieces.push(mediaPiece(sliceRect(geometry.safe, 0.08, 0.01, 0.84, 0.1), assets.media(props.studioLogoArt, "spine studio logo"), 3));
  }
  const titlePieces = verticalTitlePieces(
    variant.title,
    geometry,
    variant.profile.spineTextDirection,
  );
  if (titlePieces.length) {
    const left = Math.min(...titlePieces.map((piece) => piece.rect.x));
    const top = Math.min(...titlePieces.map((piece) => piece.rect.y));
    const right = Math.max(...titlePieces.map((piece) => piece.rect.x + piece.rect.w));
    const bottom = Math.max(...titlePieces.map((piece) => piece.rect.y + piece.rect.h));
    // The glyph cells stack in ONE column, so the box's height is the only
    // axis the emitter ever splits — and it is whatever the text metrics give:
    // at 300 DPI the default title lands on 1318 = 2·659, which leaves
    // placeInsetPieces a 2 px unit and a 659-row lattice. Grow the height
    // (never shrink: shrinking clips glyphs) to the next 5-smooth size,
    // anchored at the top, so every divisor the emitter can pick is smooth.
    // The width stays the raw union on purpose: the glyphs span it exactly,
    // and widening it by even 1 px makes every row recover that pixel with a
    // fine column lattice — the m0 ballooning this template already fought
    // once (see dieline.ts). The glyphs keep their parent coordinates
    // exactly (the child's extra space is transparent), and the growth is
    // refused when it would leave the panel's paint rect — the convention
    // then reports the rough count honestly rather than the box lying.
    const rawBounds = { x: left, y: top, w: right - left, h: bottom - top };
    const grownH = ceilToSmooth(rawBounds.h);
    const titleBounds = {
      ...rawBounds,
      h: rawBounds.y + grownH <= geometry.paint.y + geometry.paint.h ? grownH : rawBounds.h,
    };
    const placed = placeInsetPieces({
      rootW: titleBounds.w,
      rootH: titleBounds.h,
      pieces: titlePieces.map((piece) => ({
        ...piece,
        rect: {
          ...piece.rect,
          x: piece.rect.x - titleBounds.x,
          y: piece.rect.y - titleBounds.y,
        },
      })),
    });
    children["spine-title"] = {
      kind: "mosaic_document",
      version: 1,
      m0: placed.m0,
      sources: placed.sources,
      assets: {},
      size: { width: titleBounds.w, height: titleBounds.h },
      fps: 30,
      durationMs: 1000,
      backgroundColor: "none",
      editor: { label: "spine vertical title" },
    };
    const titleSource: MosaicSource = {
      type: "mosaic",
      ref: "spine-title",
      placement: { fit: "contain" },
      editor: { owner: "template", label: "spine vertical title" },
    };
    pieces.push({
      rect: { ...titleBounds, importance: 3 },
      source: titleSource,
    });
  }

  const catalogRect = sliceRect(geometry.safe, 0.02, 0.8, 0.96, 0.08);
  pieces.push({
    rect: { ...catalogRect, importance: 3 },
    source: textSource({ text: variant.catalogNumber, fontSize: Math.max(6, geometry.safe.w * 0.25), color: "#ffffff", label: "spine catalog number", hAlign: "center" }),
  });

  const rating = variant.profile.ratingPlacements.find((item) => item.panelId === "spine");
  if (rating && (validation.ratingBadgeArt || props.usePlaceholderBadges)) {
    const size = Math.max(10, Math.min(
      Math.round(rating.minSizeMm * pxPerMm(geometry.dpi)),
      Math.round(geometry.trim.w * 0.82),
    ));
    const rect = cornerRect(geometry.trim, rating.corner, size, Math.max(1, Math.round(pxPerMm(geometry.dpi))));
    if (validation.ratingBadgeArt) pieces.push(mediaPiece(rect, assets.media(validation.ratingBadgeArt, "spine rating badge"), 4));
    else {
      pieces.push(solidPiece(rect, "#20242c", "spine rating placeholder", 4));
      pieces.push({ rect: { ...rect, importance: 5 }, source: textSource({ text: variant.profile.ratingSystem, fontSize: Math.max(6, size * 0.16), color: "#ffffff", label: "spine rating placeholder text", hAlign: "center" }) });
    }
  }
  return { pieces, children };
}
