"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTE_CARD = exports.FULL = exports.dwellSec = exports.MAX_ZOOM = exports.MAX_NOTE = exports.PULL_BACK = void 0;
exports.planWalk = planWalk;
exports.screenBox = screenBox;
exports.frameOn = frameOn;
exports.walkCamera = walkCamera;
const template_utils_1 = require("@m0saic/template-utils");
const INTRO_HOLD = 1.0;
const TRAVEL = 1.1;
exports.PULL_BACK = 1.2;
const END_HOLD = 2.5;
/** A note longer than this will not fit two lines on the card. */
exports.MAX_NOTE = 140;
/** The camera never zooms past this - the board is supersampled to match. */
exports.MAX_ZOOM = 2;
/** Reading time: ~18 chars/s plus a beat to find the tile, 3-8s. */
const dwellSec = (note) => Math.min(8, Math.max(3, 1.5 + note.length / 18));
exports.dwellSec = dwellSec;
/** The walk after the board has built: one stop per noted tile, in tile order. */
function planWalk(buildSec, entries) {
    let t = buildSec + INTRO_HOLD;
    const stops = entries.map((e) => {
        const departSec = t;
        const arriveSec = departSec + TRAVEL;
        const leaveSec = arriveSec + (0, exports.dwellSec)(e.note);
        t = leaveSec;
        return { ...e, departSec, arriveSec, leaveSec };
    });
    return { buildSec, stops, pullBackSec: t, endSec: t + exports.PULL_BACK + END_HOLD };
}
exports.FULL = { zoom: 1, focusX: 0.5, focusY: 0.5, card: "bottom" };
/** The note card's top edge and height, as frame fractions, per side. */
exports.NOTE_CARD = {
    bottom: { y: 0.79, h: 0.155 },
    top: { y: 0.05, h: 0.155 },
};
/** Where a focused tile may sit on screen (frame fractions): clear of the card. */
const SAFE = {
    bottom: { x0: 0.05, x1: 0.95, y0: 0.04, y1: 0.76 },
    top: { x0: 0.05, x1: 0.95, y0: 0.24, y1: 0.96 },
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** Where `r` lands on screen under a framing (frame px). */
function screenBox(r, f, W, H) {
    const left = f.focusX * (W - W / f.zoom);
    const top = f.focusY * (H - H / f.zoom);
    return { x0: (r.x - left) * f.zoom, y0: (r.y - top) * f.zoom, x1: (r.x + r.w - left) * f.zoom, y1: (r.y + r.h - top) * f.zoom };
}
function frameIn(r, W, H, card) {
    const band = SAFE[card];
    const zoom = clamp(Math.min(((band.x1 - band.x0) * W) / r.w, ((band.y1 - band.y0) * H) / r.h), 1, exports.MAX_ZOOM);
    if (zoom <= 1.001)
        return { ...exports.FULL, card };
    const vw = W / zoom;
    const vh = H / zoom;
    const left = clamp(r.x + r.w / 2 - ((band.x0 + band.x1) / 2) * vw, 0, W - vw);
    const top = clamp(r.y + r.h / 2 - ((band.y0 + band.y1) / 2) * vh, 0, H - vh);
    return { zoom: Number(zoom.toFixed(4)), focusX: left / (W - vw), focusY: top / (H - vh), card };
}
/**
 * Zoom + focus that put `r` (in the W x H source space) as large as fits
 * clear of the note card, centred in that band. focus = window top-left /
 * (frame - window) - the inverse of the engine's crop. The crop can never
 * pan past the source's edge, so a tile near the bottom cannot be lifted
 * above a bottom card: it gets the card at the TOP instead.
 */
function frameOn(r, W, H) {
    const below = frameIn(r, W, H, "bottom");
    return screenBox(r, below, W, H).y1 <= SAFE.bottom.y1 * H + 0.5 ? below : frameIn(r, W, H, "top");
}
/**
 * One camera for the whole walk: full view through the build, then ease to
 * each stop and hold, then ease back to the full view and hold. `T` maps
 * planned seconds to clip seconds (the pinned-clip squeeze).
 */
function walkCamera(plan, rects, W, H, T) {
    const zoom = [];
    const fx = [];
    const fy = [];
    const key = (t, f) => {
        zoom.push({ t, v: f.zoom });
        fx.push({ t, v: f.focusX });
        fy.push({ t, v: f.focusY });
    };
    key(T(plan.stops[0].departSec), exports.FULL);
    for (const s of plan.stops) {
        const f = frameOn(rects[s.index], W, H);
        key(T(s.arriveSec), f);
        key(T(s.leaveSec), f);
    }
    key(T(plan.pullBackSec + exports.PULL_BACK), exports.FULL);
    const opts = { ease: "easeInOut" };
    return { zoom: (0, template_utils_1.keyframeExpr)(zoom, opts), focusX: (0, template_utils_1.keyframeExpr)(fx, opts), focusY: (0, template_utils_1.keyframeExpr)(fy, opts) };
}
