"use strict";
/**
 * Compose — every element of the calendar becomes a REAL m0 rect (the Rect
 * Thesis): pieces are gathered as integer pixel rects with paint importance
 * and laundered by `placeInsetPieces`, which owns the frame↔source mapping
 * (layer-major, quantized y/x) and emits zip-ordered `GeometryExpectation`s.
 *
 * Geometry is Recipe 2 inset recovery (basis 120): the m0 GCD-collapses ~6x
 * for heavy scenes and each source carries a recovery `placement.inset` that
 * paints it back on the EXACT computed rect — the engine bakes text canvases
 * and shrinks media/color destinations at the inset box. The old "exact
 * rects" mode (lattice pitch forced to 1) existed only so canvas selection
 * overlays aligned; Make's selection overlay now bakes insets in, so
 * recovery is the one path (founder 2026-09-15).
 *
 * Timing (cue highlights, the dim wash, spotlights) rides per-source
 * `overlay.enable` gates (`between(t,a,b)` unions), the tip-goal flash-gate
 * shape. Everything else is static text/color/media tiles.
 *
 * The one non-tile piece is the facecam when several clips are picked: those
 * become a stitched pipeline child (`children.dc_facecam_reel`) referenced by
 * the facecam cell — see `buildFacecamReelPipeline`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACECAM_REEL_REF = void 0;
exports.buildDropCalendarDoc = buildDropCalendarDoc;
const defaultMedia_1 = require("@m0saic/template-utils/dist/media/defaultMedia");
const template_utils_1 = require("@m0saic/template-utils");
const calendar_1 = require("./calendar");
const layout_1 = require("./layout");
const platforms_1 = require("./platforms");
/** Rows the drops list shows before it collapses the rest into "+N more". */
const MAX_LIST_ROWS = 8;
/** The shortest zoom a cue gets when it is shorter than the spotlight delay. */
const SPOTLIGHT_MIN_SEC = 0.4;
/**
 * Paint z-order (higher on top). The facecam is the persistent layer — on a
 * tall canvas it is a picture-in-picture over the card — so it sits ABOVE
 * everything the calendar paints, the spotlight's dim wash AND the spotlight
 * itself (2026-09-15: a zoom must never bury the creator's face — the zoom
 * stays centred as the hero and the host floats over it).
 */
const Z = {
    paper: 0,
    panel: 1,
    content: 2,
    badge: 3,
    dim: 5,
    ring: 6,
    /** Spotlights stack two per cue above this (2 × cues, so a whole month fits under 200). */
    spotlight: 7,
    facecamFrame: 200,
    facecam: 201,
    /** Mock platform chrome — a preview aid painted over everything. */
    chrome: 400,
};
const asColor = (c) => c;
const round3 = (x) => Math.round(x * 1000) / 1000;
const fmt3 = (x) => x.toFixed(3);
const betweenExpr = (a, b) => `between(t,${fmt3(round3(a))},${fmt3(round3(b))})`;
function assetFor(path, mediaType) {
    return /^https?:\/\//i.test(path)
        ? { kind: "url", url: path, mediaType }
        : { kind: "file", path, mediaType };
}
const truncate = (s, max) => s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
function buildDropCalendarDoc(cfg, W, H, fps, durationMs, classify) {
    const warnings = [];
    const t = cfg.theme;
    const font = cfg.fontFamily;
    const aspect = (0, layout_1.selectAspect)(W, H);
    // The platform's safe area, or the whole canvas when the creator turned
    // it off (`safeArea: false` — chrome stand-ins are then meaningless too).
    const stage = cfg.safeArea
        ? (0, platforms_1.platformStage)(cfg.platform, W, H)
        : { safe: { x: 0, y: 0, w: W, h: H } };
    // The drawn facecam rect, rescaled from the canvas it was drawn on onto
    // this render and clamped inside it; a rect that lands entirely outside
    // falls back to automatic placement.
    const drawn = cfg.facecamRegion ? (0, template_utils_1.resolveRegionsToPx)(cfg.facecamRegion, { width: W, height: H })[0] : undefined;
    const facecamOverride = drawn && drawn.ok ? { x: drawn.x, y: drawn.y, w: drawn.w, h: drawn.h } : undefined;
    if (drawn && !drawn.ok)
        warnings.push(`facecamRegion ignored: ${drawn.reason}`);
    // The facecam AREA exists when there is a facecam — or when the slot is on
    // and the included starter is on disk: the layout goes side-by-side and
    // the cell shows the stand-in, bound as a drop target. A stripped build
    // with no starter falls back to today's calendar-only layout.
    const facecamStarter = cfg.facecam === "" && cfg.facecamSlot ? (0, defaultMedia_1.starterMedia)("facecam") : null;
    const hasFacecam = cfg.facecam !== "" || facecamStarter !== null;
    const regions = (0, layout_1.computeRegions)(W, H, hasFacecam, aspect, stage, { corner: cfg.facecamCorner, sizeFrac: cfg.facecamSize }, facecamOverride);
    const weekRows = cfg.grid.weeks.length;
    const mastheadText = `${calendar_1.MONTH_NAMES[cfg.month - 1].toUpperCase()} ${cfg.year}`;
    // Portrait / square reflow: seven columns across a phone-width canvas
    // leave no room for a title, so titled drops line up in a list under the
    // grid and their cells carry only an accent-marked day number.
    const titledDrops = [...cfg.dropsByDay.values()]
        .filter((d) => d.title !== "")
        .sort((a, b) => a.day - b.day);
    const listMode = cfg.showTitles && aspect !== "DESKTOP" && titledDrops.length > 0;
    const listRowCount = listMode ? Math.min(titledDrops.length, MAX_LIST_ROWS) : 0;
    const geom = (0, layout_1.computeCardGeometry)(regions.card, weekRows, mastheadText, listRowCount, regions.paper);
    const pieces = [];
    const assets = {};
    const teaserKind = new Map();
    const teaserAssetId = (i) => {
        const id = `dc_teaser_${i}`;
        if (!assets[id]) {
            const kind = classify(cfg.teasers[i]);
            teaserKind.set(i, kind);
            assets[id] = assetFor(cfg.teasers[i], kind);
        }
        return id;
    };
    // ── Base sheet + table slab ──
    pieces.push({
        rect: geom.paper,
        importance: Z.paper,
        source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(t.paper)), "paper"),
    });
    pieces.push({
        rect: geom.panel,
        importance: Z.panel,
        source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(t.line)), "panel"),
    });
    // ── Facecam ──
    // A thin frame under the facecam cell (its own quiet edge — the cell reads
    // as a window rather than a paste-on), then three shapes, one cell: the whole video (no clips picked), ONE picked
    // region (a plain playback trim), or a REEL of regions — a pipeline child
    // the engine stitches with the authored transition, referenced here as a
    // nested mosaic. Either way the cell carries TWO handles: move / resize
    // it in place (`facecamRegion`, a rect binding) and drop a clip on it
    // (`facecam`, a media binding — the picture glyph opens the picker).
    const children = {};
    const reel = cfg.facecamReel;
    const FACECAM_BINDINGS = [{ propKey: "facecamRegion", kind: "rect" }, { propKey: "facecam" }];
    if (hasFacecam && regions.facecam) {
        const strokePx = cfg.facecamStrokePx;
        const cam = regions.facecam;
        if (strokePx > 0) {
            pieces.push({
                rect: {
                    x: Math.max(0, cam.x - strokePx),
                    y: Math.max(0, cam.y - strokePx),
                    w: Math.min(W - Math.max(0, cam.x - strokePx), cam.w + 2 * strokePx),
                    h: Math.min(H - Math.max(0, cam.y - strokePx), cam.h + 2 * strokePx),
                },
                importance: Z.facecamFrame,
                source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(cfg.facecamStrokeColor || t.frame)), "facecam-frame"),
            });
        }
        if (facecamStarter) {
            // The slot before the footage: the included starter, a still image
            // (so a no-footage render stays a poster), in the same cell with the
            // same two handles — move it, or drop the clip on it.
            assets["dc_facecam"] = facecamStarter;
            pieces.push({
                rect: regions.facecam,
                importance: Z.facecam,
                source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)({
                    type: "media",
                    mediaType: "image",
                    assetId: "dc_facecam",
                    placement: { fit: "cover" },
                }, "facecam"), FACECAM_BINDINGS),
            });
        }
        else if (reel && reel.clips.length > 1) {
            children[exports.FACECAM_REEL_REF] = buildFacecamReelPipeline(cfg, regions.facecam, fps);
            pieces.push({
                rect: regions.facecam,
                importance: Z.facecam,
                source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)({
                    type: "mosaic",
                    ref: exports.FACECAM_REEL_REF,
                    placement: { fit: "cover" },
                    audio: { enabled: cfg.facecamAudio },
                }, "facecam"), FACECAM_BINDINGS),
            });
        }
        else {
            assets["dc_facecam"] = assetFor(cfg.facecam, "video");
            const clip = reel?.clips[0];
            pieces.push({
                rect: regions.facecam,
                importance: Z.facecam,
                source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)({
                    type: "media",
                    mediaType: "video",
                    assetId: "dc_facecam",
                    placement: { fit: "cover" },
                    audio: { enabled: cfg.facecamAudio },
                    // A picked region trims the source; the render still owns the
                    // length, so a shorter pick loops as the whole clip always did.
                    ...(clip
                        ? {
                            playback: {
                                clipStartMs: clip.startMs,
                                clipDurationMs: clip.durationMs,
                                loopMode: "loop",
                            },
                        }
                        : {}),
                }, "facecam"), FACECAM_BINDINGS),
            });
        }
    }
    // ── Masthead ──
    // Two bound leaves on one tile (the title/subtitle convention): double-
    // clicking the masthead opens a stacked Month · Year form instead of
    // splicing a raw number into the rendered text.
    pieces.push({
        rect: geom.masthead,
        importance: Z.content,
        source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)(textSource(t.paper, [
            layer(mastheadText, geom.mastheadFontPx, t.ink, font, {
                hAlign: "center",
            }),
        ]), "masthead"), [{ propKey: "month" }, { propKey: "year" }]),
    });
    // ── Weekday header ──
    // Every header cell — branded or plain — binds to its own weekdays.<day>
    // leaf, so double-click brands (or un-brands) that column in place.
    for (let c = 0; c < 7; c++) {
        const wd = cfg.grid.weekdayOfColumn[c];
        const cell = geom.headerCells[c];
        const special = cfg.specialLabelByWeekday[wd];
        pieces.push({
            rect: cell,
            importance: Z.content,
            source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)(textSource(t.paperMuted, headerLayers(special, wd, cell, geom.headerFontPx, t, font)), "header-cell"), `weekdays.${calendar_1.WEEKDAY_KEYS[wd]}`),
        });
    }
    // ── Day cells ──
    const cellRectByDay = new Map();
    for (let r = 0; r < weekRows; r++) {
        for (let c = 0; c < 7; c++) {
            const info = cfg.grid.weeks[r][c];
            const cell = geom.dayCells[r][c];
            if (info.inMonth)
                cellRectByDay.set(info.day, cell);
            const drop = info.inMonth ? cfg.dropsByDay.get(info.day) : undefined;
            const hasMedia = drop?.teaserIndex !== undefined && cfg.teasers[drop.teaserIndex] !== undefined;
            if (!hasMedia) {
                // One text source: cell fill + day number + (accent) title lines.
                const dim = !info.inMonth && cfg.dimAdjacent;
                const bg = dim ? t.paperMuted : t.paper;
                const numColor = info.inMonth ? t.ink : t.inkMuted;
                const layers = [];
                const marked = listMode && drop !== undefined && drop.title !== "";
                if (cfg.showDayNumbers) {
                    // List mode: the drop's day number IS the marker (accent, bold).
                    layers.push(dayNumberLayer(info.day, cell, geom.dayNumFontPx, marked ? t.accent : numColor, font, marked));
                }
                if (drop && cfg.showTitles && drop.title !== "" && !listMode) {
                    layers.push(...titleLayers(drop.title, cell, geom, cfg, t.accent, font));
                }
                let cellSrc = (0, template_utils_1.tag)(textSource(bg, layers), drop ? "drop-cell" : "day-cell");
                // Every in-month cell without a picture is also a MEDIA drop target:
                // a file dropped on it appends to the teasers (`teasers[len]`) and
                // the row's slot number rides along as a COMPANION seed (`len + 1`,
                // 1-based), so the picture lands on THIS date — not on the first
                // unpictured row the auto-assignment would pick. The companion is
                // the drop's own write: it never shows in the Day · Title form.
                const nextSlot = cfg.teasers.length;
                const dropHandle = (row) => [
                    { propKey: "teasers", index: nextSlot, kind: "media" },
                    { propKey: "days", path: [row, "teaser"], kind: "number", seedDraft: String(nextSlot + 1), companion: true },
                ];
                if (drop) {
                    // Canvas edit: double-click a drop cell → Day · Title form, routed
                    // to the ORIGINAL row of the Drops prop (an empty title is still an
                    // add handle). Committing Day empty removes the row (`onClear`).
                    cellSrc = (0, template_utils_1.bindProps)(cellSrc, [
                        {
                            propKey: "days",
                            path: [drop.rowIndex, "day"],
                            kind: "number",
                            onClear: "remove-element",
                        },
                        { propKey: "days", path: [drop.rowIndex, "title"], kind: "string" },
                        ...dropHandle(drop.rowIndex),
                    ]);
                }
                else if (info.inMonth) {
                    // Empty date: an ADD handle — the same Day · Title form, routed to
                    // the NEXT free Drops row (`writeLeaf` pads the array, so the
                    // commit appends). Day opens pre-filled with the clicked date
                    // (`seedDraft`), so typing the title + Enter is the whole add; a
                    // day-less commit is a no-op (`onClear` removes the unborn row).
                    // A DROP on the cell writes the day seed, the teaser and the slot
                    // in one act — the row is born pictured.
                    cellSrc = (0, template_utils_1.bindProps)(cellSrc, [
                        {
                            propKey: "days",
                            path: [cfg.dayRowCount, "day"],
                            kind: "number",
                            onClear: "remove-element",
                            seedDraft: String(info.day),
                        },
                        { propKey: "days", path: [cfg.dayRowCount, "title"], kind: "string" },
                        ...dropHandle(cfg.dayRowCount),
                    ]);
                }
                pieces.push({ rect: cell, importance: Z.content, source: cellSrc });
                continue;
            }
            // Media cell: teaser fills the cell; number badge + title strip ride on
            // top. The cell binds the teaser SLOT it shows (`teasers[idx]`) — a
            // drop target on the Make canvas: drag a new image / clip onto it.
            const idx = drop.teaserIndex;
            const id = teaserAssetId(idx);
            const kind = teaserKind.get(idx);
            pieces.push({
                rect: cell,
                importance: Z.content,
                source: (0, template_utils_1.bindProp)((0, template_utils_1.tag)({
                    type: "media",
                    mediaType: kind,
                    assetId: id,
                    placement: { fit: cfg.cellMediaFit },
                    visual: { backgroundColor: asColor("#000000") },
                    ...(kind === "video"
                        ? {
                            playback: { loopMode: "loop" },
                            audio: { enabled: !cfg.muteTeasers },
                        }
                        : {}),
                }, "drop-cell"), "teasers", idx),
            });
            if (cfg.showDayNumbers) {
                const bw = Math.min(cell.w, Math.round(geom.dayNumFontPx * 2.3));
                const bh = Math.min(cell.h, Math.round(geom.dayNumFontPx * 1.75));
                pieces.push({
                    rect: { x: cell.x, y: cell.y, w: bw, h: bh },
                    importance: Z.badge,
                    source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)(textSource(t.scrim, [
                        layer(String(info.day), geom.dayNumFontPx, "#FFFFFF", font, {
                            hAlign: "center",
                        }),
                    ]), "day-badge"), [
                        {
                            propKey: "days",
                            path: [drop.rowIndex, "day"],
                            kind: "number",
                            onClear: "remove-element",
                        },
                    ]),
                });
            }
            if (cfg.showTitles && drop.title !== "" && !listMode) {
                const sh = Math.max(Math.round(geom.dayNumFontPx * 1.6), Math.round(cell.h * 0.24));
                const stripH = Math.min(sh, cell.h);
                const stripFont = Math.max(8, Math.floor(stripH * 0.46));
                const maxChars = Math.max(4, Math.floor((cell.w * 0.92) / (stripFont * 0.62)));
                pieces.push({
                    rect: { x: cell.x, y: cell.y + cell.h - stripH, w: cell.w, h: stripH },
                    importance: Z.badge,
                    source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)(textSource(t.scrim, [
                        layer(truncate(drop.title.toUpperCase(), maxChars), stripFont, "#FFFFFF", font, {
                            hAlign: "center",
                        }),
                    ]), "title-strip"), [{ propKey: "days", path: [drop.rowIndex, "title"], kind: "string" }]),
                });
            }
        }
    }
    // ── Drops list (portrait / square reflow) ──
    // One row per titled drop, in day order: the day number in accent, the
    // title in ink, both bound to the same Drops row the cell binds to, so a
    // double-click on either edits the same fields. When there are more drops
    // than rows, the last row folds the rest into "+N".
    if (listMode) {
        const rows = geom.listRows;
        const shown = titledDrops.slice(0, rows.length);
        const overflow = titledDrops.length - shown.length;
        shown.forEach((drop, i) => {
            const row = rows[i];
            const folded = i === rows.length - 1 && overflow > 0;
            pieces.push({
                rect: row,
                importance: Z.content,
                source: (0, template_utils_1.bindProps)((0, template_utils_1.tag)(textSource(t.paper, folded
                    ? listRowLayers(`+${overflow + 1}`, `${drop.title.toUpperCase()} AND ${overflow} MORE`, row, geom.listFontPx, t, font)
                    : listRowLayers(String(drop.day).padStart(2, "0"), drop.title.toUpperCase(), row, geom.listFontPx, t, font)), "drop-row"), [
                    {
                        propKey: "days",
                        path: [drop.rowIndex, "day"],
                        kind: "number",
                        onClear: "remove-element",
                    },
                    { propKey: "days", path: [drop.rowIndex, "title"], kind: "string" },
                ]),
            });
        });
    }
    // ── Cue highlights, dim wash, spotlights ──
    const ringT = Math.max(2, geom.linePx * 2);
    const spotWindows = [];
    let spotlightCount = 0;
    cfg.cues.forEach((cue, i) => {
        const cell = cellRectByDay.get(cue.day);
        if (!cell)
            return;
        const window = { startSec: round3(cue.startSec), endSec: round3(cue.endSec) };
        const enable = betweenExpr(cue.startSec, cue.endSec);
        for (const bar of (0, layout_1.ringRects)(cell, ringT)) {
            pieces.push({
                rect: bar,
                importance: Z.ring,
                source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(t.accent), { overlay: { enable, window } }), "cue-ring"),
            });
        }
        const drop = cfg.dropsByDay.get(cue.day);
        if (cfg.spotlight.enabled &&
            drop?.teaserIndex !== undefined &&
            cfg.teasers[drop.teaserIndex] !== undefined) {
            const idx = drop.teaserIndex;
            const id = teaserAssetId(idx);
            const kind = teaserKind.get(idx);
            // Centred in the table, always — the hero; the facecam floats above it.
            const spot = (0, layout_1.spotlightRect)(geom.table, cfg.spotlight.sizeFrac);
            // The ring leads, the zoom follows: the spotlight (and its dim wash)
            // start `delaySec` into the cue — a beat where the creator is talking
            // about the day and the ring says which — and a cue shorter than the
            // delay still gets a short zoom at its end.
            const spotStart = Math.min(cue.startSec + cfg.spotlight.delaySec, Math.max(cue.startSec, cue.endSec - SPOTLIGHT_MIN_SEC));
            const spotWindow = { startSec: round3(spotStart), endSec: round3(cue.endSec) };
            const spotEnable = betweenExpr(spotStart, cue.endSec);
            const framePx = Math.max(3, Math.round(Math.min(W, H) * 0.006));
            const frame = {
                x: Math.max(0, spot.x - framePx),
                y: Math.max(0, spot.y - framePx),
                w: Math.min(W - Math.max(0, spot.x - framePx), spot.w + 2 * framePx),
                h: Math.min(H - Math.max(0, spot.y - framePx), spot.h + 2 * framePx),
            };
            spotWindows.push(spotWindow);
            pieces.push({
                rect: frame,
                importance: Z.spotlight + 2 * i,
                source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(t.accent), { overlay: { enable: spotEnable, window: spotWindow } }), "spotlight-frame"),
            });
            pieces.push({
                rect: spot,
                importance: Z.spotlight + 1 + 2 * i,
                source: (0, template_utils_1.tag)({
                    type: "media",
                    mediaType: kind,
                    assetId: id,
                    placement: { fit: "cover" },
                    overlay: { enable: spotEnable, window: spotWindow },
                    ...(kind === "video"
                        ? { playback: { loopMode: "loop" }, audio: { enabled: false } }
                        : {}),
                }, "spotlight"),
            });
            spotlightCount++;
        }
    });
    if (cfg.spotlight.dim && spotWindows.length > 0) {
        pieces.push({
            rect: geom.table,
            importance: Z.dim,
            source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(t.scrim), {
                overlay: {
                    enable: (0, template_utils_1.rebalanceAdditiveChains)(spotWindows.map((w) => betweenExpr(w.startSec, w.endSec)).join("+")),
                    window: {
                        startSec: Math.min(...spotWindows.map((w) => w.startSec)),
                        endSec: Math.max(...spotWindows.map((w) => w.endSec)),
                    },
                },
            }), "spotlight-dim"),
        });
    }
    // ── Mock platform chrome (preview aid) ──
    // Translucent stand-ins for what the app draws over the video: the top bar
    // (tabs), the bottom caption area (handle + caption), and the action rail
    // (avatar / like / comment / share as stacked tiles). Painted LAST so the
    // creator sees exactly what would be hidden; nothing on platforms without
    // chrome, or with the safe area off.
    if (cfg.showChrome && cfg.safeArea) {
        const safe = stage.safe;
        const rail = stage.rail;
        const hasChrome = safe.y > 0 || safe.y + safe.h < H || rail !== undefined;
        if (hasChrome) {
            const veil = "black@0.42";
            const glyph = "#FFFFFF@0.85";
            const chromeFont = Math.max(12, Math.round(Math.min(W, H) * 0.028));
            if (safe.y > 0) {
                pieces.push({
                    rect: { x: 0, y: 0, w: W, h: safe.y },
                    importance: Z.chrome,
                    source: (0, template_utils_1.tag)(textSource(veil, [
                        layer("Following        For You", chromeFont, glyph, font, { hAlign: "center", vAlign: "bottom", yExpr: `h-text_h-${Math.round(safe.y * 0.18)}` }, true),
                    ]), "chrome"),
                });
            }
            const bottomY = safe.y + safe.h;
            if (bottomY < H) {
                const bh = H - bottomY;
                const padX = Math.round(W * 0.055);
                pieces.push({
                    rect: { x: 0, y: bottomY, w: W, h: bh },
                    importance: Z.chrome,
                    source: (0, template_utils_1.tag)(textSource(veil, [
                        layer("@yourhandle", chromeFont, glyph, font, { hAlign: "left", vAlign: "top", xExpr: String(padX), yExpr: String(Math.round(bh * 0.12)) }, true),
                        layer("Your caption goes here #newmusic", chromeFont, glyph, font, { hAlign: "left", vAlign: "top", xExpr: String(padX), yExpr: String(Math.round(bh * 0.12) + Math.round(chromeFont * 1.5)) }),
                    ]), "chrome"),
                });
            }
            if (rail) {
                pieces.push({ rect: rail, importance: Z.chrome, source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor(veil)), "chrome") });
                // Four stacked stand-in buttons down the rail's centre.
                const btn = Math.round(rail.w * 0.42);
                const gap = Math.round(btn * 0.55);
                const total = 4 * btn + 3 * gap;
                const startY = rail.y + Math.round((rail.h - total) / 2);
                for (let i = 0; i < 4; i++) {
                    pieces.push({
                        rect: { x: rail.x + Math.round((rail.w - btn) / 2), y: startY + i * (btn + gap), w: btn, h: btn },
                        importance: Z.chrome + 1,
                        source: (0, template_utils_1.tag)((0, template_utils_1.makeColorTile)(asColor("#FFFFFF@0.28")), "chrome"),
                    });
                }
            }
        }
    }
    // ── Launder pieces into m0 ──
    // `placeInsetPieces` owns the frame↔source mapping and wires any recovery
    // inset onto a clone, so duplicate rects (stacked spotlights) are bound by
    // index, not geometry.
    //
    // Standard basis-120 inset recovery: ~6x smaller m0 than exact rects,
    // painted rects identical. Hostile (prime-dim) axes degrade to exact
    // placement per axis by default — a runtime template must render at any
    // canvas.
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
            code: "DC_LAYOUT_INTERNAL",
            message: `placeInsetPieces failed: ${err_ instanceof Error ? err_.message : String(err_)}`,
        };
    }
    const anyCellVideo = [...teaserKind.values()].some((k) => k === "video");
    const animated = cfg.facecam !== "" || cfg.cues.length > 0 || anyCellVideo;
    const doc = {
        kind: "mosaic_document",
        version: 1,
        m0: bound.m0,
        assets,
        sources: bound.sources,
        ...(Object.keys(children).length > 0 ? { children } : {}),
        size: { width: W, height: H },
        fps,
        durationMs,
        backgroundColor: asColor(t.surface),
    };
    return {
        ok: true,
        doc,
        warnings,
        expectations: bound.expectations,
        stats: {
            animated,
            weekRows,
            cueCount: cfg.cues.length,
            spotlightCount,
            sourceCount: bound.sources.length,
            facecamClips: reel?.clips.length ?? 0,
        },
    };
}
// ── Facecam reel ──────────────────────────────────────────────────────────
/** `children` key of the stitched facecam reel. */
exports.FACECAM_REEL_REF = "dc_facecam_reel";
/**
 * The picked facecam regions as a pipeline: one step per clip, each a
 * hermetic single-cell doc that plays its trim once (`loopMode: "cut"`), with
 * the authored transition on every boundary but the last. The engine renders
 * the steps and stitches them (`out = A + B − d`), so the reel's length is
 * exactly `reel.totalMs` — the number the render duration and the cue mapping
 * were computed from.
 *
 * Steps render at the facecam cell's own size: xfade requires equal
 * dimensions across a boundary, and it keeps the stitch off the full canvas.
 */
function buildFacecamReelPipeline(cfg, rect, fps) {
    const reel = cfg.facecamReel;
    const size = { width: rect.w, height: rect.h };
    const steps = reel.clips.map((clip, i) => ({
        name: `cam-${String(i).padStart(2, "0")}`,
        durationMs: clip.durationMs,
        ...(clip.overlapMs > 0 && reel.transition !== "cut"
            ? {
                transitionToNext: {
                    type: "xfade",
                    kind: reel.transition,
                    durationMs: clip.overlapMs,
                },
            }
            : {}),
        file: {
            kind: "mosaic_document",
            version: 1,
            m0: "F",
            assets: { dc_facecam: assetFor(cfg.facecam, "video") },
            sources: [
                {
                    type: "media",
                    mediaType: "video",
                    assetId: "dc_facecam",
                    placement: { fit: "cover" },
                    playback: {
                        clipStartMs: clip.startMs,
                        clipDurationMs: clip.durationMs,
                        loopMode: "cut",
                    },
                    audio: { enabled: cfg.facecamAudio },
                },
            ],
            size,
            fps,
            durationMs: clip.durationMs,
        },
    }));
    return {
        kind: "mosaic_pipeline",
        version: 1,
        steps,
        size,
        fps,
        durationMs: reel.totalMs,
    };
}
// ── Text helpers ──────────────────────────────────────────────────────────
function textSource(bg, layers) {
    return {
        type: "text",
        renderMode: { kind: "image" },
        visual: { backgroundColor: asColor(bg) },
        layers,
    };
}
function layer(text, fontSize, color, fontFamily, placement, bold = false) {
    return {
        content: { kind: "literal", text: text || " " },
        style: {
            fontSize,
            fontColor: asColor(color),
            fontFamily,
            ...(bold ? { fontWeight: 700 } : {}),
        },
        placement: { vAlign: "middle", ...placement },
    };
}
/** Day number pinned to the cell's top-left with a proportional pad. */
function dayNumberLayer(day, cell, fontPx, color, fontFamily, bold = false) {
    const pad = Math.max(3, Math.round(Math.min(cell.w, cell.h) * 0.055));
    return layer(String(day), fontPx, color, fontFamily, { hAlign: "left", vAlign: "top", xExpr: String(pad), yExpr: String(pad) }, bold);
}
/**
 * A drops-list row: the day (accent, bold) at the left pad, the title (ink)
 * after it, truncated to the row's remaining width.
 */
function listRowLayers(dayText, title, row, fontPx, t, fontFamily) {
    const pad = Math.max(4, Math.round(row.h * 0.35));
    const dayW = Math.round(fontPx * 0.62 * Math.max(2, dayText.length) + pad);
    const titleX = pad + dayW;
    const maxChars = Math.max(3, Math.floor((row.w - titleX - pad) / (fontPx * 0.62)));
    return [
        layer(dayText, fontPx, t.accent, fontFamily, { hAlign: "left", xExpr: String(pad) }, true),
        layer(truncate(title, maxChars), fontPx, t.ink, fontFamily, { hAlign: "left", xExpr: String(titleX) }),
    ];
}
/**
 * Fit a drop title into a text-only cell: shrink font until the wrapped
 * block fits below the day-number band AND every line fits the cell's
 * width (`wrapText` cannot break a single long word — "PREMIERE" in a
 * phone-width cell — so width is checked per line, not just per block),
 * then cap lines with an ellipsis. Lines stack centered (the
 * multilineTextLayers yExpr shape) nudged down past the number band.
 */
function titleLayers(title, cell, geom, cfg, color, fontFamily) {
    const text = title.toUpperCase();
    const availW = cell.w * 0.88;
    const availH = cell.h * (cfg.showDayNumbers ? 0.56 : 0.72);
    let fontPx = Math.max(9, Math.min(40, Math.round(cell.h * 0.15)));
    let lines = [text];
    let lineH = Math.round(fontPx * 1.22);
    let maxChars = Math.max(3, Math.floor(availW / (fontPx * 0.62)));
    for (let step = 0; step < 10; step++) {
        maxChars = Math.max(3, Math.floor(availW / (fontPx * 0.62)));
        lines = (0, template_utils_1.wrapText)(text, maxChars);
        lineH = Math.round(fontPx * 1.22);
        const fitsW = lines.every((l) => l.length <= maxChars);
        if ((fitsW && lines.length * lineH <= availH) || fontPx <= 9)
            break;
        fontPx = Math.max(9, Math.floor(fontPx * 0.85));
    }
    const maxLines = Math.max(1, Math.floor(availH / lineH));
    if (lines.length > maxLines)
        lines = lines.slice(0, maxLines);
    // Whatever still overflows at the floor size is cut, never painted past
    // the cell.
    lines = lines.map((l) => truncate(l, maxChars));
    const bandOff = cfg.showDayNumbers ? Math.round(geom.dayNumFontPx * 0.55) : 0;
    const n = lines.length;
    return lines.map((line, i) => {
        const offset = bandOff + Math.round((i - (n - 1) / 2) * lineH);
        return layer(line, fontPx, color, fontFamily, {
            hAlign: "center",
            yExpr: `(h-text_h)/2 + (${offset})`,
        });
    });
}
/** Header cell: branded label (accent, wrapped) or the plain weekday name. */
function headerLayers(special, weekday, cell, baseFontPx, t, fontFamily) {
    if (special === undefined) {
        const full = calendar_1.WEEKDAY_NAMES[weekday].toUpperCase();
        const fitsFull = full.length * baseFontPx * 0.66 <= cell.w * 0.88;
        const text = fitsFull ? full : calendar_1.WEEKDAY_ABBREV[weekday].toUpperCase();
        return [layer(text, baseFontPx, t.ink, fontFamily, { hAlign: "center" })];
    }
    const text = special.toUpperCase();
    let fontPx = Math.max(8, Math.round(baseFontPx * 1.02));
    let lines = [text];
    for (let step = 0; step < 4; step++) {
        const maxChars = Math.max(3, Math.floor((cell.w * 0.92) / (fontPx * 0.62)));
        lines = (0, template_utils_1.wrapText)(text, maxChars).slice(0, 2);
        const fitsW = lines.every((l) => l.length <= maxChars);
        const fitsH = lines.length * fontPx * 1.2 <= cell.h * 0.86;
        if ((fitsW && fitsH) || fontPx <= 8)
            break;
        fontPx = Math.max(8, Math.floor(fontPx * 0.85));
    }
    const lineH = Math.round(fontPx * 1.2);
    const n = lines.length;
    return lines.map((line, i) => {
        const offset = Math.round((i - (n - 1) / 2) * lineH);
        return layer(line, fontPx, t.accent, fontFamily, { hAlign: "center", yExpr: `(h-text_h)/2 + (${offset})` }, true);
    });
}
