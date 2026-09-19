/**
 * Compose — every element of the story becomes a REAL m0 rect (the Rect
 * Thesis): pieces are gathered as integer pixel rects with paint importance
 * and laundered by `placeInsetPieces` (Recipe 2 inset recovery, basis 120),
 * which owns the frame↔source mapping and emits zip-ordered
 * `GeometryExpectation`s for the geometry contract.
 *
 * Paint order (importance, higher on top):
 *   screenshot / placeholder (0–1) → badge (2–3) → sticker lines (4–9, the
 *   big line over the badge's corner) → CTA frame + text (10–11) → arrows
 *   (12) → link pill body, glyph, text (13–15).
 *
 * Motion rides per-source `overlay` bundles from motion.ts; a still
 * (`animate: false`) carries no overlay at all. The stage colour is
 * `document.backgroundColor` (never a base layer).
 */

import type {
  MosaicAsset,
  MosaicColor,
  MosaicDocument,
  MosaicOverlayExpr,
  MosaicSource,
} from "@m0saic/types";
import {
  bindProp,
  bindPropRect,
  makeColorTile,
  placeInsetPieces,
  resolveRegionsToPx,
  tag,
  type GeometryExpectation,
} from "@m0saic/template-utils";

import { computeStoryLayout, stickerLine, textWidth, DESIGN_H, type Rect } from "./layout";
import {
  arrowSource,
  badgeSources,
  frameSource,
  linkGlyphSource,
  pillSource,
  plainTextSource,
  stickerSources,
} from "./glyphs";
import {
  arrowMotion,
  dropIn,
  popIn,
  riseIn,
  slideInX,
  DROP_SEC,
  POP_SEC,
  RISE_SEC,
  SLIDE_SEC,
  STORY_TIMELINE,
} from "./motion";
import type { MediaKind, ResolvedConfig } from "./resolve";

export type ComposeStats = {
  /** True when the doc has motion (animation on, or a video screenshot). */
  animated: boolean;
  hasMedia: boolean;
  mediaKind?: MediaKind;
  sourceCount: number;
  /** The rect the screenshot landed in (default slot or the drawn one). */
  mediaRect: Rect;
};

export type ComposeOutcome =
  | {
      ok: true;
      doc: MosaicDocument;
      stats: ComposeStats;
      warnings: string[];
      /** Zip-ordered zero-drift expectations (one per painted frame). */
      expectations: GeometryExpectation[];
    }
  | { ok: false; code: string; message: string };

type Piece = { rect: Rect; importance: number; source: MosaicSource };

const Z = {
  media: 0,
  mediaLabel: 1,
  badgeTile: 2,
  badgeGlyph: 3,
  headlineTop: 4,
  headlineMain: 7,
  ctaFrame: 10,
  ctaText: 11,
  arrow: 12,
  pill: 13,
  pillGlyph: 14,
  pillText: 15,
} as const;

const INK = "#FFFFFF";
const OUTLINE = "#000000";
const PLACEHOLDER_TILE = "#141414";
const PLACEHOLDER_INK = "#5C5C5C";

const asColor = (c: string): MosaicColor => c as MosaicColor;

function assetFor(path: string, mediaType: MediaKind): MosaicAsset {
  return /^https?:\/\//i.test(path)
    ? ({ kind: "url", url: path, mediaType } as MosaicAsset)
    : ({ kind: "file", path, mediaType } as MosaicAsset);
}

export function buildNewVideoStoryDoc(
  cfg: ResolvedConfig,
  W: number,
  H: number,
  fps: number,
  durationMs: number,
  classify: (path: string) => MediaKind,
): ComposeOutcome {
  const warnings: string[] = [];
  const anim = cfg.animate;
  const T = STORY_TIMELINE;

  // The drawn screenshot rect, rescaled from the canvas it was drawn on
  // onto this render and clamped inside it; a rect that lands entirely
  // outside falls back to the default slot.
  const drawn = cfg.mediaRegion ? resolveRegionsToPx(cfg.mediaRegion, { width: W, height: H })[0] : undefined;
  const mediaOverride: Rect | undefined = drawn && drawn.ok ? { x: drawn.x, y: drawn.y, w: drawn.w, h: drawn.h } : undefined;
  if (drawn && !drawn.ok) warnings.push(`mediaRegion ignored: ${drawn.reason}`);

  const hasBadge = cfg.badgeImage !== "" || cfg.badge !== "none";
  const L = computeStoryLayout(W, H, {
    headlineTop: cfg.headlineTop,
    headlineMain: cfg.headlineMain,
    cta: cfg.cta,
    linkText: cfg.linkText,
    hasBadge,
    ...(mediaOverride ? { mediaOverride } : {}),
  });

  const pieces: Piece[] = [];
  const assets: Record<string, MosaicAsset> = {};
  const on = (m: MosaicOverlayExpr): MosaicOverlayExpr | undefined => (anim ? m : undefined);

  // ── Screenshot ──
  // The slot binds to `mediaRegion` as a rect: double-click / the move badge
  // opens the draw session seeded from what is painted, and the template
  // re-renders with the new rect. Empty media = a placeholder that carries
  // the same handle, so the slot can be placed before the file is picked.
  const mediaKind: MediaKind | undefined = cfg.media !== "" ? classify(cfg.media) : undefined;
  const mediaMotion = on(riseIn(T.mediaAt, 0.6, Math.round(L.media.h * 0.12)));
  const rounding =
    cfg.mediaCorner >= 0.5
      ? ({ cornerStyle: "pill", rasterizer: "svg" } as const)
      : cfg.mediaCorner > 0
        ? ({ cornerStyle: "rounded", borderRadius: Math.min(1, cfg.mediaCorner * 2), rasterizer: "svg" } as const)
        : undefined;
  if (mediaKind !== undefined) {
    assets["nvs_media"] = assetFor(cfg.media, mediaKind);
    pieces.push({
      rect: L.media,
      importance: Z.media,
      source: bindPropRect(
        tag(
          {
            type: "media",
            mediaType: mediaKind,
            assetId: "nvs_media" as never,
            placement:
              cfg.mediaFit === "cover"
                ? { fit: "cover", focusX: 0.5, focusY: cfg.mediaFocus }
                : { fit: "contain" },
            ...(rounding ? { effects: { rounding } } : {}),
            ...(mediaKind === "video"
              ? { playback: { loopMode: "loop" }, audio: { enabled: cfg.mediaAudio } }
              : {}),
            ...(mediaMotion ? { overlay: mediaMotion } : {}),
          } as MosaicSource,
          "media",
        ),
        "mediaRegion",
      ),
    });
  } else {
    pieces.push({
      rect: L.media,
      importance: Z.media,
      source: bindPropRect(
        tag(
          makeColorTile(asColor(PLACEHOLDER_TILE), {
            ...(rounding ? { effects: { rounding } } : {}),
            ...(mediaMotion ? { overlay: mediaMotion } : {}),
          }),
          "media",
        ),
        "mediaRegion",
      ),
    });
    // "YOUR MEDIA (IMAGE, VIDEO)" centred in the slot, sized to the design column.
    const labelText = "YOUR MEDIA (IMAGE, VIDEO)";
    let labelSize = Math.max(10, Math.round(DESIGN_H * L.scale * 0.03));
    const maxLabelW = L.media.w * 0.8;
    if (textWidth(labelText, labelSize) > maxLabelW) {
      labelSize = Math.max(8, Math.floor((labelSize * maxLabelW) / textWidth(labelText, labelSize)));
    }
    const capTop = L.media.y + (L.media.h - labelSize * 0.711) / 2;
    const label = stickerLine(labelText, labelSize, L.media.x + L.media.w / 2, capTop, false);
    if (label.cell.h < L.media.h && label.cell.w < L.media.w) {
      pieces.push({
        rect: label.cell,
        importance: Z.mediaLabel,
        source: tag(plainTextSource(label, PLACEHOLDER_INK, mediaMotion), "media-label"),
      });
    }
  }

  // ── Badge ──
  if (L.badge) {
    const b = L.badge;
    const motion = on(dropIn(T.badgeAt, DROP_SEC, -(b.y + b.h + 8)));
    if (cfg.badgeImage !== "") {
      assets["nvs_badge"] = assetFor(cfg.badgeImage, "image");
      pieces.push({
        rect: b,
        importance: Z.badgeTile,
        source: tag(
          {
            type: "media",
            mediaType: "image",
            assetId: "nvs_badge" as never,
            placement: { fit: "contain" },
            ...(motion ? { overlay: motion } : {}),
          } as MosaicSource,
          "badge",
        ),
      });
    } else if (cfg.badge !== "none") {
      const [tile, glyph] = badgeSources(b, cfg.badge, cfg.accent, INK, motion);
      pieces.push({ rect: b, importance: Z.badgeTile, source: bindProp(tag(tile, "badge"), "accentColor") });
      pieces.push({ rect: b, importance: Z.badgeGlyph, source: tag(glyph, "badge-glyph") });
    }
  }

  // ── Sticker headline ──
  // Halo → stroke → fill on one shared outline path; every layer binds to
  // `headline` so a double-click anywhere on the ink opens it.
  const sticker = { fill: INK, stroke: OUTLINE, halo: INK };
  if (L.headlineTop) {
    const c = L.headlineTop.cell;
    const motion = on(slideInX(T.headlineTopAt, SLIDE_SEC, -(c.x + c.w + 8)));
    stickerSources(L.headlineTop, sticker, motion).forEach((src, i) => {
      pieces.push({
        rect: c,
        importance: Z.headlineTop + i,
        source: bindProp(tag(src, "headline-top"), "headline"),
      });
    });
  }
  {
    const c = L.headlineMain.cell;
    const motion = on(slideInX(T.headlineMainAt, SLIDE_SEC, W - c.x + 8));
    stickerSources(L.headlineMain, sticker, motion).forEach((src, i) => {
      pieces.push({
        rect: c,
        importance: Z.headlineMain + i,
        source: bindProp(tag(src, "headline"), "headline"),
      });
    });
  }

  // ── Boxed call-to-action ──
  {
    const motion = on(riseIn(T.ctaAt, RISE_SEC, Math.round(L.ctaBox.h * 0.3)));
    pieces.push({
      rect: L.ctaBox,
      importance: Z.ctaFrame,
      source: tag(frameSource(L.ctaBox, L.ctaStrokePx, INK, motion), "cta-box"),
    });
    pieces.push({
      rect: L.ctaText.cell,
      importance: Z.ctaText,
      source: bindProp(tag(plainTextSource(L.ctaText, INK, motion), "cta"), "cta"),
    });
  }

  // ── Arrows ──
  L.arrows.forEach((cell, i) => {
    const motion = on(arrowMotion(T.arrowsAt[i], Math.round(L.arrowInkH * 0.5), T.bobAt, L.arrowBobPx));
    pieces.push({
      rect: cell,
      importance: Z.arrow,
      source: tag(arrowSource(cell, L.arrowInkH, INK, motion), "arrow"),
    });
  });

  // ── Link pill ──
  {
    const motion = on(popIn(T.pillAt, POP_SEC, Math.round(L.pill.h * 0.6)));
    pieces.push({
      rect: L.pill,
      importance: Z.pill,
      source: tag(pillSource(L.pill, INK, motion), "pill"),
    });
    pieces.push({
      rect: L.pillIcon,
      importance: Z.pillGlyph,
      source: tag(linkGlyphSource(L.pillIcon, OUTLINE, motion), "pill-glyph"),
    });
    pieces.push({
      rect: L.pillText.cell,
      importance: Z.pillText,
      source: bindProp(tag(plainTextSource(L.pillText, OUTLINE, motion), "link"), "linkText"),
    });
  }

  // ── Launder pieces into m0 ──
  // `placeInsetPieces` owns the frame↔source mapping and wires any recovery
  // inset onto a clone; duplicate rects (the sticker layers) are bound by
  // index, not geometry. Hostile (prime-dim) axes degrade to exact placement
  // per axis — a runtime template must render at any canvas.
  let bound: ReturnType<typeof placeInsetPieces>;
  try {
    bound = placeInsetPieces({
      rootW: W,
      rootH: H,
      pieces: pieces.map((p) => ({
        rect: { ...p.rect, importance: p.importance },
        source: p.source,
      })),
    });
  } catch (err_) {
    return {
      ok: false,
      code: "NVS_LAYOUT_INTERNAL",
      message: `placeInsetPieces failed: ${err_ instanceof Error ? err_.message : String(err_)}`,
    };
  }

  const doc: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: bound.m0,
    assets,
    sources: bound.sources,
    size: { width: W, height: H },
    fps,
    durationMs,
    backgroundColor: asColor(cfg.background),
  };

  return {
    ok: true,
    doc,
    warnings,
    expectations: bound.expectations,
    stats: {
      animated: anim || mediaKind === "video",
      hasMedia: mediaKind !== undefined,
      ...(mediaKind !== undefined ? { mediaKind } : {}),
      sourceCount: bound.sources.length,
      mediaRect: L.media,
    },
  };
}
