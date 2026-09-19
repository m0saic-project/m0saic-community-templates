"use strict";
/**
 * Cell-local mask sources — every non-media element of the story is a flat
 * colour tile masked to a shape (the Rect Thesis: m0 owns the rect, SVG
 * draws the shape). Each builder authors its path in the CELL'S OWN pixel
 * space with `bounds` = the cell's exact w×h, so `scaleX === scaleY === 1`
 * and nothing distorts.
 *
 * Text is glyph OUTLINES from the bundled Roboto Bold (`textToPath`) — no
 * drawtext spawn, no system font, identical in the CLI and the app preview.
 * The sticker outline is the mask's `strokes` channel: the same outline
 * path stroked at 2·r with round joins IS the exact r-dilation of the
 * glyphs, so halo / stroke / fill are three colour tiles sharing one path.
 *
 * Arc policy (search-typing's finding): the mask rasterizer drops SVG arcs
 * under a temporal overlay, and everything here animates — so every curve
 * is a polygon (circles and rounded corners are many-sided), never an `A`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORNER_SEGMENTS = exports.CIRCLE_SIDES = void 0;
exports.circlePolyPath = circlePolyPath;
exports.roundedRectPolyPath = roundedRectPolyPath;
exports.rectPath = rectPath;
exports.linePath = linePath;
exports.maskTile = maskTile;
exports.stickerSources = stickerSources;
exports.plainTextSource = plainTextSource;
exports.frameSource = frameSource;
exports.arrowPath = arrowPath;
exports.arrowSource = arrowSource;
exports.pillSource = pillSource;
exports.linkGlyphPath = linkGlyphPath;
exports.linkGlyphSource = linkGlyphSource;
exports.badgeGlyphPath = badgeGlyphPath;
exports.badgeSources = badgeSources;
const template_utils_1 = require("@m0saic/template-utils");
const layout_1 = require("./layout");
const asColor = (c) => c;
const r2 = (v) => Math.round(v * 100) / 100;
/** Polygon sides for circles (arc-free). */
exports.CIRCLE_SIDES = 32;
/** Segments per rounded corner (arc-free). */
exports.CORNER_SEGMENTS = 8;
// ── Path primitives ──────────────────────────────────────────────────────
/**
 * A circle as a many-sided polygon. `reverse` flips the winding — pair a
 * forward outer with a reversed inner for a nonzero-fill ring hole (the mask
 * rasterizer emits no fill-rule, so winding is the mechanism).
 */
function circlePolyPath(cx, cy, radius, sides = exports.CIRCLE_SIDES, reverse = false) {
    let d = "";
    for (let k = 0; k < sides; k++) {
        const step = reverse ? sides - k : k;
        const angle = (step / sides) * Math.PI * 2;
        d += `${k === 0 ? "M" : "L"} ${r2(cx + Math.cos(angle) * radius)} ${r2(cy + Math.sin(angle) * radius)} `;
    }
    return `${d}Z`;
}
/**
 * A rounded rectangle as a polygon (corners = `CORNER_SEGMENTS` chords).
 * `radius` clamps to the half-extents; 0 = a plain rect. Clockwise in screen
 * space; `reverse` for a hole.
 */
function roundedRectPolyPath(x, y, w, h, radius, reverse = false) {
    const R = Math.max(0, Math.min(radius, w / 2, h / 2));
    const pts = [];
    if (R <= 0) {
        pts.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
    }
    else {
        // Corner centres in clockwise order starting top-right; each sweeps a
        // quarter turn from `a0`.
        const corners = [
            [x + w - R, y + R, -Math.PI / 2],
            [x + w - R, y + h - R, 0],
            [x + R, y + h - R, Math.PI / 2],
            [x + R, y + R, Math.PI],
        ];
        for (const [cx, cy, a0] of corners) {
            for (let k = 0; k <= exports.CORNER_SEGMENTS; k++) {
                const a = a0 + (k / exports.CORNER_SEGMENTS) * (Math.PI / 2);
                pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
            }
        }
    }
    if (reverse)
        pts.reverse();
    return pts.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${r2(px)} ${r2(py)}`).join(" ") + " Z";
}
/** A plain rect subpath (clockwise). */
function rectPath(x, y, w, h) {
    return `M ${r2(x)} ${r2(y)} L ${r2(x + w)} ${r2(y)} L ${r2(x + w)} ${r2(y + h)} L ${r2(x)} ${r2(y + h)} Z`;
}
/** Glyph outlines of `line`, authored local to its cell, baseline pinned. */
function linePath(line) {
    const { cell, fontSize } = line;
    const fontPath = (0, layout_1.boldFontPath)();
    return (0, template_utils_1.textToPath)(line.text, {
        fontSize,
        hAlign: "center",
        vAlign: "top",
        // vAlign "top" puts the baseline at padding.y + ascent — pin it exactly
        // (padding may go negative; textToPath is pure arithmetic).
        padding: { x: 0, y: line.baselineY - cell.y - (0, layout_1.fontAscent)(fontSize) },
        ...(fontPath !== undefined ? { fontPath } : {}),
    }, { width: cell.w, height: cell.h });
}
// ── Tile factory ─────────────────────────────────────────────────────────
/** A colour tile masked to `path` (optionally dilated by a round-joined stroke). */
function maskTile(color, cell, path, opts = {}) {
    return (0, template_utils_1.makeColorTile)(asColor(color), {
        mask: {
            kind: "inline-mask",
            localPath: path,
            bounds: { x: 0, y: 0, width: cell.w, height: cell.h },
            ...(opts.strokeWidth !== undefined && opts.strokeWidth > 0
                ? { strokes: [{ d: path, width: opts.strokeWidth }] }
                : {}),
        },
        ...(opts.overlay ? { overlay: opts.overlay } : {}),
    });
}
/**
 * The three stacked sources of a sticker line, bottom → top: the halo
 * (glyphs dilated by haloPx), the stroke (dilated by strokePx), the fill.
 * All three share one outline path and one overlay, so they move as one.
 */
function stickerSources(line, colors, overlay) {
    const d = linePath(line);
    const shared = overlay ? { overlay } : {};
    return [
        maskTile(colors.halo, line.cell, d, { strokeWidth: 2 * line.haloPx, ...shared }),
        maskTile(colors.stroke, line.cell, d, { strokeWidth: 2 * line.strokePx, ...shared }),
        maskTile(colors.fill, line.cell, d, shared),
    ];
}
/** A plain glyph line (no outline). */
function plainTextSource(line, color, overlay) {
    return maskTile(color, line.cell, linePath(line), overlay ? { overlay } : {});
}
// ── Chrome ───────────────────────────────────────────────────────────────
/** The boxed CTA's frame: four bars (a nonzero union, no winding games). */
function frameSource(cell, strokePx, color, overlay) {
    const t = Math.min(strokePx, Math.floor(cell.w / 2), Math.floor(cell.h / 2));
    const d = [
        rectPath(0, 0, cell.w, t),
        rectPath(0, cell.h - t, cell.w, t),
        rectPath(0, 0, t, cell.h),
        rectPath(cell.w - t, 0, t, cell.h),
    ].join(" ");
    return maskTile(color, cell, d, overlay ? { overlay } : {});
}
/**
 * A down arrow at the TOP of its cell (the cell is taller by the bob
 * amplitude so the bob never leaves it): a shaft over a wide head.
 */
function arrowPath(cellW, inkH) {
    const cx = cellW / 2;
    const shaftW = cellW * 0.34;
    const headH = inkH * 0.46;
    const shaftBottom = inkH - headH;
    return (`M ${r2(cx - shaftW / 2)} 0 L ${r2(cx + shaftW / 2)} 0 ` +
        `L ${r2(cx + shaftW / 2)} ${r2(shaftBottom)} L ${r2(cellW)} ${r2(shaftBottom)} ` +
        `L ${r2(cx)} ${r2(inkH)} L 0 ${r2(shaftBottom)} ` +
        `L ${r2(cx - shaftW / 2)} ${r2(shaftBottom)} Z`);
}
function arrowSource(cell, inkH, color, overlay) {
    return maskTile(color, cell, arrowPath(cell.w, inkH), overlay ? { overlay } : {});
}
/** The link pill body: a polygon stadium filling its cell. */
function pillSource(cell, color, overlay) {
    return maskTile(color, cell, roundedRectPolyPath(0, 0, cell.w, cell.h, cell.h / 2), overlay ? { overlay } : {});
}
/**
 * Chain-link glyph in a square cell: two diagonal rings joined by a bar.
 * Rings are forward outer + reversed inner (holes under nonzero); where the
 * rings overlap the union stays filled, which is what a chain link is.
 */
function linkGlyphPath(size) {
    const s = size;
    const R = s * 0.27;
    const t = s * 0.11;
    const a = { x: s * 0.34, y: s * 0.66 };
    const b = { x: s * 0.66, y: s * 0.34 };
    const ring = (c) => circlePolyPath(c.x, c.y, R) + " " + circlePolyPath(c.x, c.y, R - t, exports.CIRCLE_SIDES, true);
    // The bar: a t-wide quad along the a→b diagonal (unit normal (1,1)/√2).
    const n = { x: t / 2 / Math.SQRT2, y: t / 2 / Math.SQRT2 };
    const bar = `M ${r2(a.x + n.x)} ${r2(a.y + n.y)} L ${r2(b.x + n.x)} ${r2(b.y + n.y)} ` +
        `L ${r2(b.x - n.x)} ${r2(b.y - n.y)} L ${r2(a.x - n.x)} ${r2(a.y - n.y)} Z`;
    return `${ring(a)} ${ring(b)} ${bar}`;
}
function linkGlyphSource(cell, color, overlay) {
    return maskTile(color, cell, linkGlyphPath(Math.min(cell.w, cell.h)), overlay ? { overlay } : {});
}
// ── Badge ────────────────────────────────────────────────────────────────
/** The badge's white glyph path for `kind`, in a w×h cell (w:h ≈ 1.4). */
function badgeGlyphPath(kind, w, h) {
    switch (kind) {
        case "play":
            return `M ${r2(w * 0.37)} ${r2(h * 0.26)} L ${r2(w * 0.71)} ${r2(h * 0.5)} L ${r2(w * 0.37)} ${r2(h * 0.74)} Z`;
        case "note": {
            // An eighth note: head (bottom-left), stem, flag.
            const headR = h * 0.15;
            const head = { x: w * 0.38, y: h * 0.7 };
            const stemX = head.x + headR * 0.85;
            const stemW = h * 0.07;
            const stemTop = h * 0.2;
            const stem = rectPath(stemX, stemTop, stemW, head.y - stemTop);
            const flag = `M ${r2(stemX + stemW)} ${r2(stemTop)} L ${r2(stemX + stemW + h * 0.2)} ${r2(stemTop + h * 0.14)} ` +
                `L ${r2(stemX + stemW + h * 0.2)} ${r2(stemTop + h * 0.3)} L ${r2(stemX + stemW)} ${r2(stemTop + h * 0.16)} Z`;
            return `${circlePolyPath(head.x, head.y, headR)} ${stem} ${flag}`;
        }
        case "camera": {
            // A photo-app mark: rounded-square ring, lens ring, a dot top-right.
            const s = h * 0.6;
            const x = (w - s) / 2;
            const y = (h - s) / 2;
            const t = h * 0.07;
            const rad = s * 0.28;
            const frame = roundedRectPolyPath(x, y, s, s, rad) + " " + roundedRectPolyPath(x + t, y + t, s - 2 * t, s - 2 * t, rad - t, true);
            const lens = circlePolyPath(w / 2, h / 2, s * 0.22) + " " + circlePolyPath(w / 2, h / 2, s * 0.22 - t, exports.CIRCLE_SIDES, true);
            const dot = circlePolyPath(x + s * 0.78, y + s * 0.22, t * 0.55, 16);
            return `${frame} ${lens} ${dot}`;
        }
        case "live": {
            // A broadcast mark: a dot inside a ring.
            const c = { x: w / 2, y: h / 2 };
            const ring = circlePolyPath(c.x, c.y, h * 0.3) + " " + circlePolyPath(c.x, c.y, h * 0.3 - h * 0.06, exports.CIRCLE_SIDES, true);
            return `${ring} ${circlePolyPath(c.x, c.y, h * 0.14)}`;
        }
    }
}
/**
 * The drawn badge, bottom → top: an accent-coloured rounded tile filling
 * the cell and the white glyph on it. Both carry the same overlay.
 */
function badgeSources(cell, kind, accent, glyphColor, overlay) {
    const shared = overlay ? { overlay } : {};
    return [
        maskTile(accent, cell, roundedRectPolyPath(0, 0, cell.w, cell.h, cell.h * 0.22), shared),
        maskTile(glyphColor, cell, badgeGlyphPath(kind, cell.w, cell.h), shared),
    ];
}
