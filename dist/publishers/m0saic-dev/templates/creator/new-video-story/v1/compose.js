"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNewVideoStoryDoc = buildNewVideoStoryDoc;
const template_utils_1 = require("@m0saic/template-utils");
const layout_1 = require("./layout");
const glyphs_1 = require("./glyphs");
const motion_1 = require("./motion");
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
};
const INK = "#FFFFFF";
const OUTLINE = "#000000";
const PLACEHOLDER_TILE = "#141414";
const PLACEHOLDER_INK = "#5C5C5C";
const asColor = (c) => c;
function assetFor(path, mediaType) {
    return /^https?:\/\//i.test(path)
        ? { kind: "url", url: path, mediaType }
        : { kind: "file", path, mediaType };
}
function buildNewVideoStoryDoc(cfg, W, H, fps, durationMs, classify) {
    const warnings = [];
    const anim = cfg.animate;
    const T = motion_1.STORY_TIMELINE;
    // The drawn screenshot rect, rescaled from the canvas it was drawn on
    // onto this render and clamped inside it; a rect that lands entirely
    // outside falls back to the default slot.
    const drawn = cfg.mediaRegion ? (0, template_utils_1.resolveRegionsToPx)(cfg.mediaRegion, { width: W, height: H })[0] : undefined;
    const mediaOverride = drawn && drawn.ok ? { x: drawn.x, y: drawn.y, w: drawn.w, h: drawn.h } : undefined;
    if (drawn && !drawn.ok)
        warnings.push(`mediaRegion ignored: ${drawn.reason}`);
    const hasBadge = cfg.badgeImage !== "" || cfg.badge !== "none";
    const L = (0, layout_1.computeStoryLayout)(W, H, {
        headlineTop: cfg.headlineTop,
        headlineMain: cfg.headlineMain,
        cta: cfg.cta,
        linkText: cfg.linkText,
        hasBadge,
        ...(mediaOverride ? { mediaOverride } : {}),
    });
    const pieces = [];
    const assets = {};
    const on = (m) => (anim ? m : undefined);
    // ── Screenshot ──
    // The slot binds to `mediaRegion` as a rect: double-click / the move badge
    // opens the draw session seeded from what is painted, and the template
    // re-renders with the new rect. Empty media = a placeholder that carries
    // the same handle, so the slot can be placed before the file is picked.
    const mediaKind = cfg.media !== "" ? classify(cfg.media) : undefined;
    const mediaMotion = on((0, motion_1.riseIn)(T.mediaAt, 0.6, Math.round(L.media.h * 0.12)));
    const rounding = cfg.mediaCorner >= 0.5
        ? { cornerStyle: "pill", rasterizer: "svg" }
        : cfg.mediaCorner > 0
            ? { cornerStyle: "rounded", borderRadius: Math.min(1, cfg.mediaCorner * 2), rasterizer: "svg" }
            : undefined;
    if (mediaKind !== undefined) {
        assets["nvs_media"] = assetFor(cfg.media, mediaKind);
        pieces.push({
            rect: L.media,
            importance: Z.media,
            source: (0, template_utils_1.bindPropRect)((0, template_utils_1.tag)({
                type: "media",
                mediaType: mediaKind,
                assetId: "nvs_media",
                placement: cfg.mediaFit === "cover"
                    ? { fit: "cover", focusX: 0.5, focusY: cfg.mediaFocus }
                    : { fit: "contain" },
                ...(rounding ? { effects: { rounding } } : {}),
                ...(mediaKind === "video"
                    ? { playback: { loopMode: "loop" }, audio: { enabled: cfg.mediaAudio } }
                    : {}),
                ...(mediaMotion ? { overlay: mediaMotion } : {}),
            }, "media"), "mediaRegion"),
        });
    }
    else {
        pieces.push({
            rect: L.media,
            importance: Z.media,
            source: (0, template_utils_1.bindPropRect)((0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(PLACEHOLDER_TILE), {
                ...(rounding ? { effects: { rounding } } : {}),
                ...(mediaMotion ? { overlay: mediaMotion } : {}),
            }), "media"), "mediaRegion"),
        });
        // "YOUR MEDIA (IMAGE, VIDEO)" centred in the slot, sized to the design column.
        const labelText = "YOUR MEDIA (IMAGE, VIDEO)";
        let labelSize = Math.max(10, Math.round(layout_1.DESIGN_H * L.scale * 0.03));
        const maxLabelW = L.media.w * 0.8;
        if ((0, layout_1.textWidth)(labelText, labelSize) > maxLabelW) {
            labelSize = Math.max(8, Math.floor((labelSize * maxLabelW) / (0, layout_1.textWidth)(labelText, labelSize)));
        }
        const capTop = L.media.y + (L.media.h - labelSize * 0.711) / 2;
        const label = (0, layout_1.stickerLine)(labelText, labelSize, L.media.x + L.media.w / 2, capTop, false);
        if (label.cell.h < L.media.h && label.cell.w < L.media.w) {
            pieces.push({
                rect: label.cell,
                importance: Z.mediaLabel,
                source: (0, template_utils_1.tag)((0, glyphs_1.plainTextSource)(label, PLACEHOLDER_INK, mediaMotion), "media-label"),
            });
        }
    }
    // ── Badge ──
    if (L.badge) {
        const b = L.badge;
        const motion = on((0, motion_1.dropIn)(T.badgeAt, motion_1.DROP_SEC, -(b.y + b.h + 8)));
        if (cfg.badgeImage !== "") {
            assets["nvs_badge"] = assetFor(cfg.badgeImage, "image");
            pieces.push({
                rect: b,
                importance: Z.badgeTile,
                source: (0, template_utils_1.tag)({
                    type: "media",
                    mediaType: "image",
                    assetId: "nvs_badge",
                    placement: { fit: "contain" },
                    ...(motion ? { overlay: motion } : {}),
                }, "badge"),
            });
        }
        else if (cfg.badge !== "none") {
            const [tile, glyph] = (0, glyphs_1.badgeSources)(b, cfg.badge, cfg.accent, INK, motion);
            pieces.push({ rect: b, importance: Z.badgeTile, source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)(tile, "badge"), "accentColor") });
            pieces.push({ rect: b, importance: Z.badgeGlyph, source: (0, template_utils_1.tag)(glyph, "badge-glyph") });
        }
    }
    // ── Sticker headline ──
    // Halo → stroke → fill on one shared outline path; every layer binds to
    // `headline` so a double-click anywhere on the ink opens it.
    const sticker = { fill: INK, stroke: OUTLINE, halo: INK };
    if (L.headlineTop) {
        const c = L.headlineTop.cell;
        const motion = on((0, motion_1.slideInX)(T.headlineTopAt, motion_1.SLIDE_SEC, -(c.x + c.w + 8)));
        (0, glyphs_1.stickerSources)(L.headlineTop, sticker, motion).forEach((src, i) => {
            pieces.push({
                rect: c,
                importance: Z.headlineTop + i,
                source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)(src, "headline-top"), "headline"),
            });
        });
    }
    {
        const c = L.headlineMain.cell;
        const motion = on((0, motion_1.slideInX)(T.headlineMainAt, motion_1.SLIDE_SEC, W - c.x + 8));
        (0, glyphs_1.stickerSources)(L.headlineMain, sticker, motion).forEach((src, i) => {
            pieces.push({
                rect: c,
                importance: Z.headlineMain + i,
                source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)(src, "headline"), "headline"),
            });
        });
    }
    // ── Boxed call-to-action ──
    {
        const motion = on((0, motion_1.riseIn)(T.ctaAt, motion_1.RISE_SEC, Math.round(L.ctaBox.h * 0.3)));
        pieces.push({
            rect: L.ctaBox,
            importance: Z.ctaFrame,
            source: (0, template_utils_1.tag)((0, glyphs_1.frameSource)(L.ctaBox, L.ctaStrokePx, INK, motion), "cta-box"),
        });
        pieces.push({
            rect: L.ctaText.cell,
            importance: Z.ctaText,
            source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, glyphs_1.plainTextSource)(L.ctaText, INK, motion), "cta"), "cta"),
        });
    }
    // ── Arrows ──
    L.arrows.forEach((cell, i) => {
        const motion = on((0, motion_1.arrowMotion)(T.arrowsAt[i], Math.round(L.arrowInkH * 0.5), T.bobAt, L.arrowBobPx));
        pieces.push({
            rect: cell,
            importance: Z.arrow,
            source: (0, template_utils_1.tag)((0, glyphs_1.arrowSource)(cell, L.arrowInkH, INK, motion), "arrow"),
        });
    });
    // ── Link pill ──
    {
        const motion = on((0, motion_1.popIn)(T.pillAt, motion_1.POP_SEC, Math.round(L.pill.h * 0.6)));
        pieces.push({
            rect: L.pill,
            importance: Z.pill,
            source: (0, template_utils_1.tag)((0, glyphs_1.pillSource)(L.pill, INK, motion), "pill"),
        });
        pieces.push({
            rect: L.pillIcon,
            importance: Z.pillGlyph,
            source: (0, template_utils_1.tag)((0, glyphs_1.linkGlyphSource)(L.pillIcon, OUTLINE, motion), "pill-glyph"),
        });
        pieces.push({
            rect: L.pillText.cell,
            importance: Z.pillText,
            source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)((0, glyphs_1.plainTextSource)(L.pillText, OUTLINE, motion), "link"), "linkText"),
        });
    }
    // ── Launder pieces into m0 ──
    // `placeInsetPieces` owns the frame↔source mapping and wires any recovery
    // inset onto a clone; duplicate rects (the sticker layers) are bound by
    // index, not geometry. Hostile (prime-dim) axes degrade to exact placement
    // per axis — a runtime template must render at any canvas.
    let bound;
    try {
        bound = (0, template_utils_1.placeInsetPieces)({
            rootW: W,
            rootH: H,
            pieces: pieces.map((p) => ({
                rect: { ...p.rect, importance: p.importance },
                source: p.source,
            })),
        });
    }
    catch (err_) {
        return {
            ok: false,
            code: "NVS_LAYOUT_INTERNAL",
            message: `placeInsetPieces failed: ${err_ instanceof Error ? err_.message : String(err_)}`,
        };
    }
    const doc = {
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
