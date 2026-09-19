"use strict";
/**
 * `@m0saic-dev/hero/search-typing/v1` — looping search-bar typing hero.
 *
 * One MosaicDocument with REAL GEOMETRY (the Rect Thesis — founder-directed
 * revision of plan D1's flat overlay stack): every element is a true m0 cell,
 * so the document carries selectable bounding boxes — card, icon, label zone,
 * word zone, underline band — instead of an opaque full-canvas stack.
 *
 * Placement is geometry-recipes Recipe 1: each cell SNAPS OUTWARD to an 8px
 * grid (`SNAP_PX`) before `placeRects`, which GCD-collapses the splits (all
 * edges share the grid) while every source is authored local to its SNAPPED
 * cell — masks bound to the cell's exact dims, glyph/track coordinates offset
 * by (exact − snapped). No `placement.inset` anywhere: lavfi drawbox tracks
 * render at their true cell size, which inset recovery cannot guarantee
 * (cell-filling track content is the documented non-fit for inset pieces).
 * The page background stays `document.backgroundColor` (never a base
 * overlay).
 *
 * Paint order via piece importance: card (0) → icon + label chrome (1) →
 * word strips (2, one layer each — same rect) → cover curtain + underline
 * grow (3) → caret (4). ffmpeg enable-gates only — no per-frame JS, no
 * drawtext, every track under the 500-box budget.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchTyping = void 0;
const types_1 = require("@m0saic/types");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
const template_utils_1 = require("@m0saic/template-utils");
const schema_1 = require("./schema");
const timeline_1 = require("./timeline");
const layout_1 = require("./layout");
const glyphs_1 = require("./glyphs");
const boxes_1 = require("./boxes");
/** Snap a rect outward to the shared SNAP_PX grid, clamped to the canvas —
 *  Recipe 1: placeRects GCD-collapses (px-per-weight ≥ 8) and no cell ever
 *  clips its content. */
function snapOut(rect, canvasW, canvasH) {
    const x0 = Math.max(0, Math.floor(rect.x / layout_1.SNAP_PX) * layout_1.SNAP_PX);
    const y0 = Math.max(0, Math.floor(rect.y / layout_1.SNAP_PX) * layout_1.SNAP_PX);
    const x1 = Math.min(canvasW, Math.ceil((rect.x + rect.w) / layout_1.SNAP_PX) * layout_1.SNAP_PX);
    const y1 = Math.min(canvasH, Math.ceil((rect.y + rect.h) / layout_1.SNAP_PX) * layout_1.SNAP_PX);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Translate canvas-absolute gated boxes into a zone cell's local space. */
function localBoxes(boxes, zone) {
    return boxes.map((box) => ({ ...box, x: box.x - zone.x, y: box.y - zone.y }));
}
/** Tight integer bbox of a box set, padded 1px and clamped to `within`. */
function boxesBBox(boxes, within) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const box of boxes) {
        x0 = Math.min(x0, box.x);
        y0 = Math.min(y0, box.y);
        x1 = Math.max(x1, box.x + box.w);
        y1 = Math.max(y1, box.y + box.h);
    }
    const cx0 = Math.max(within.x, Math.floor(x0) - 1);
    const cy0 = Math.max(within.y, Math.floor(y0) - 1);
    const cx1 = Math.min(within.x + within.w, Math.ceil(x1) + 1);
    const cy1 = Math.min(within.y + within.h, Math.ceil(y1) + 1);
    return { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 };
}
function errorDocument(message, ctx) {
    const width = Math.max(1, Math.round(ctx.target.width));
    const height = Math.max(1, Math.round(ctx.target.height));
    return {
        ...(0, template_utils_1.makeErrorMosaic)(message, {
            width,
            height,
            title: "Search Typing",
            errorCode: "SEARCH_TYPING",
        }),
        fps: ctx.target.fps,
        durationMs: ctx.target.durationMs,
        size: { width, height },
        format: { kind: "image", container: "png" },
        // Error cards rendered as video (the CLI honors the user's -o .mp4 over
        // the authored png) must not mux the anullsrc silence default — the
        // gate-20 silent-audio class via the split-mux path (gate-27 catch).
        audio: { mode: "off" },
    };
}
/** The outputHints duration — the DEFAULT words' natural cadence. Hosts
 *  (CLI make) seed their unpinned render length from this hint, so a ctx
 *  duration EQUAL to it with no explicit user ask is the host's seeding,
 *  not a pin (gate-27: custom words/timing were silently stretched to
 *  18.17s because the hint-seeded target read as a user pin). */
const NATURAL_HINT_MS = 18170;
exports.SearchTyping = {
    id: (0, types_1.asTemplateId)(schema_1.SEARCH_TYPING_ID),
    label: "Search Typing",
    version: 1,
    description: "Looping search-bar hero: a rounded card with a magnifier, a muted prompt, and rotating words typed and deleted character-by-character over a growing underline.",
    capabilities: { tier: "core" },
    tags: ["hero", "search", "typing", "animated", "loop", "marketing", "marketers", "designers", "landing-page", "hero-banner"],
    aspectRatio: { ideal: 1280 / 400, label: "16:5", mode: "none" },
    outputHints: {
        width: 1280,
        height: 400,
        fps: 30,
        // Natural duration of the default word set (hold-last).
        durationMs: NATURAL_HINT_MS,
        // Mid-hold of the last word — the poster is the fully-typed frame.
        posterTimeMs: 17200,
        note: 'A pinned output duration is fit exactly — typing speeds up or stretches uniformly (the hint matches the default words\' natural cadence). endBehavior "hold" keeps the last word typed for the poster; "loop" is seamless.',
    },
    propsSchema: schema_1.searchTypingPropsSchema,
    defaultProps: schema_1.defaultProps,
    async render(props, ctx) {
        const width = Math.max(1, Math.round(ctx.target.width));
        const height = Math.max(1, Math.round(ctx.target.height));
        try {
            const resolved = (0, schema_1.parseProps)(props);
            const timeline = (0, timeline_1.buildTypingTimeline)(resolved.words, resolved.timing, resolved.endBehavior, {
                // Q1 (gate-28 tree ruling): resolvePinnedDurationMs is now
                // userIntent-only, so the gate-27 hint-echo discriminator that
                // lived here is gone — an explicit ask pins, anything else
                // follows the natural cadence.
                pinnedDurationMs: (0, template_utils_1.resolvePinnedDurationMs)(ctx),
                fps: ctx.target.fps,
            });
            const layout = (0, layout_1.computeLayout)({
                canvasW: width,
                canvasH: height,
                words: resolved.words,
                label: resolved.label,
                frame: resolved.frame,
                showIcon: resolved.icon.show,
                barWidthFrac: resolved.style.barWidthFrac,
                barAspect: resolved.style.barAspect,
                cornerRadiusPx: resolved.style.cornerRadiusPx,
            });
            const pieces = [];
            // The bar is authored on the SNAP_PX grid (layout), so its cell IS the
            // visual card — a real bg fill with SVG-rounded corners, no mask.
            pieces.push({
                rect: { ...layout.bar, importance: 0 },
                source: (0, glyphs_1.cardSource)(layout, resolved.style.cardColor),
            });
            if (layout.icon) {
                const iconCell = snapOut(layout.icon, width, height);
                pieces.push({
                    rect: { ...iconCell, importance: 1 },
                    source: {
                        ...(0, glyphs_1.magnifierSource)(layout.icon, iconCell, resolved.style.labelColor),
                        editor: { owner: "template", label: "icon" },
                    },
                });
            }
            // The label chrome cell widens across the word zone when the static
            // underline must span label + word.
            const labelRect = resolved.underline === "static" && layout.labelZone
                ? {
                    ...layout.labelZone,
                    w: layout.wordZone.x + layout.wordZone.w - layout.labelZone.x,
                }
                : (layout.labelZone ??
                    (resolved.underline === "static"
                        ? {
                            x: layout.wordZone.x,
                            y: layout.wordZone.y,
                            w: layout.wordZone.w,
                            h: layout.underlineY + layout.underlineHeightPx - layout.wordZone.y,
                        }
                        : null));
            if (labelRect) {
                const labelCell = snapOut(labelRect, width, height);
                const labelSource = (0, glyphs_1.labelChromeSource)(layout, labelCell, resolved.style.labelColor, {
                    underline: resolved.underline,
                });
                if (labelSource) {
                    pieces.push({ rect: { ...labelCell, importance: 1 }, source: labelSource });
                }
            }
            // Word strips, each windowed to its band (R4). The strip opens half a
            // frame before typing starts so no frame lands exactly on the boundary
            // — but NEVER before the band's own covers arm: word k≥1's curtain
            // gates from band.startSec, and a rescaled empty hold can be shorter
            // than the half-frame eps (word 0's lt-gates are on from t=0).
            // The close trims 1ms: between(t,S,E) is END-inclusive in the engine,
            // and a frame landing exactly on a band end would composite the
            // outgoing strip with char 0 already uncovered (its delete box is the
            // skipped zero-duration one).
            const eps = 0.5 / Math.max(1, ctx.target.fps);
            const windows = timeline.bands.map((band, k) => ({
                startSec: Math.max(k === 0 ? 0 : band.startSec, band.typeStartSec - eps),
                endSec: band.endSec - 0.001,
            }));
            const wordCell = snapOut(layout.wordZone, width, height);
            for (const strip of (0, glyphs_1.wordStripSources)(layout, wordCell, resolved.style.inkColor, windows)) {
                pieces.push({ rect: { ...wordCell, importance: 2 }, source: strip });
            }
            // The curtain: card-color boxes over the glyph band, local to the word
            // cell. Same resolved value as the card tile (risk 7 — any drift shows
            // ghost rectangles).
            pieces.push({
                rect: { ...wordCell, importance: 3 },
                source: (0, template_utils_1.gatedBoxTrackSource)(localBoxes((0, boxes_1.buildCoverBoxes)(timeline, layout), wordCell), {
                    color: resolved.style.cardColor,
                }),
            });
            if (resolved.underline === "grow") {
                const underlineCell = snapOut(layout.underlineZone, width, height);
                pieces.push({
                    rect: { ...underlineCell, importance: 3 },
                    source: (0, template_utils_1.gatedBoxTrackSource)(localBoxes((0, boxes_1.buildUnderlineBoxes)(timeline, layout), underlineCell), { color: resolved.style.inkColor }),
                });
            }
            if (resolved.caret.show) {
                const caretBoxes = (0, boxes_1.buildCaretBoxes)(timeline, layout, resolved.caret);
                const caretCell = snapOut(boxesBBox(caretBoxes, layout.bar), width, height);
                pieces.push({
                    rect: { ...caretCell, importance: 4 },
                    source: (0, template_utils_1.gatedBoxTrackSource)(localBoxes(caretBoxes, caretCell), {
                        color: resolved.style.inkColor,
                    }),
                });
            }
            // Exact snapped cells through placeRects (the page-skeleton pureRects
            // idiom): layers pack by importance; sources bind in each layer's
            // band-emission order (y, then x).
            const placed = (0, dsl_stdlib_1.placeRects)({
                rootW: width,
                rootH: height,
                rects: pieces.map((piece) => ({
                    x: piece.rect.x,
                    y: piece.rect.y,
                    w: piece.rect.w,
                    h: piece.rect.h,
                    importance: piece.rect.importance,
                    claimant: "F",
                })),
            });
            const sources = [];
            for (const layer of placed.layers) {
                const ordered = [...layer.rectIndices].sort((a, b) => pieces[a].rect.y - pieces[b].rect.y || pieces[a].rect.x - pieces[b].rect.x);
                for (const index of ordered)
                    sources.push(pieces[index].source);
            }
            const doc = {
                kind: "mosaic_document",
                version: 1,
                assets: {},
                m0: placed.m0,
                sources,
                backgroundColor: resolved.style.pageColor,
                fps: ctx.target.fps,
                durationMs: timeline.durationMs,
                size: { width, height },
                format: { ...schema_1.SEARCH_TYPING_FORMAT },
                audio: { mode: "off" },
            };
            // Layout contract (debug-only, house law): the magnifier is SQUARE and
            // NEVER outgrows ICON_MAX_EM of the resolved font — the gate-27
            // founder catch ("this is not a good look"): the metric-scaled icon
            // hit 19.9× the shrink-fitted font at 1080². fontSize is resolved, so
            // the em bound compiles to exact canvas fractions; slack absorbs the
            // snapOut grid padding (±SNAP_PX per edge on the realized cell).
            const iconCapPx = layout_1.ICON_MAX_EM * layout.fontSize + 2 * 8;
            return (0, template_utils_1.withLayoutContract)(doc, ctx, {
                templateId: schema_1.SEARCH_TYPING_ID,
                constraints: layout.icon
                    ? [
                        {
                            label: "icon",
                            aspect: 1,
                            aspectTolerance: 0.2,
                            maxWidthFrac: iconCapPx / width,
                            maxHeightFrac: iconCapPx / height,
                        },
                    ]
                    : [],
                debug: props.debugLayout === true,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return errorDocument(message, ctx);
        }
    },
};
// Community convention: template modules export plain objects and do NOT
// self-register — the host (or the package entry) decides what to register.
exports.default = exports.SearchTyping;
