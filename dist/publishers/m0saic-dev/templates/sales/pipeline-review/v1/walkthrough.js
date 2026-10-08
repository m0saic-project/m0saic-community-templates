"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTE_CARD = exports.dwellSec = exports.MAX_ZOOM = exports.MAX_NOTE = exports.PLAIN_SEC = exports.BUILD_SEC = exports.FOCUS_LABELS = exports.FOCUS_KEYS = void 0;
exports.noteStops = noteStops;
exports.planWalk = planWalk;
exports.plannedDurationMs = plannedDurationMs;
exports.screenBox = screenBox;
exports.frameOn = frameOn;
exports.walkCamera = walkCamera;
const template_utils_1 = require("@m0saic/template-utils");
const deals_1 = require("./deals");
/** Every headline a note can sit on, in walkthrough (reading) order. */
exports.FOCUS_KEYS = [
    "closedWon",
    "winRate",
    "slipped",
    "openPipeline",
    "byMonth",
    "byRegion",
    "slippedList",
    "topRegion",
    "topRep",
    "biggestOpen",
];
/** On-screen names, ASCII (the note card's label). */
exports.FOCUS_LABELS = {
    closedWon: "CLOSED WON",
    winRate: "WIN RATE",
    slipped: "SLIPPED",
    openPipeline: "OPEN PIPELINE",
    byMonth: "WON BY MONTH",
    byRegion: "WON BY REGION",
    slippedList: "NEEDS A NEW CLOSE DATE",
    topRegion: "TOP REGION",
    topRep: "TOP REP",
    biggestOpen: "BIGGEST OPEN DEAL",
};
/** The dashboard's build schedule ends here. */
exports.BUILD_SEC = 6.4;
/** Without notes the build takes the first ~45% of the clip; the rest holds. */
exports.PLAIN_SEC = 18;
const INTRO_HOLD = 1.0;
const TRAVEL = 1.1;
const PULL_BACK = 1.2;
const END_HOLD = 2.5;
/** A note longer than this will not fit two lines on the card. */
exports.MAX_NOTE = 140;
/** The camera never zooms past this — the dashboard is supersampled to match. */
exports.MAX_ZOOM = 2;
/** Reading time: ~18 chars/s plus a beat to find the headline, 3-8s. */
const dwellSec = (note) => Math.min(8, Math.max(3, 1.5 + note.length / 18));
exports.dwellSec = dwellSec;
/** The notes that are set, in walkthrough order. Never throws (hosts call it per edit). */
function noteStops(notes) {
    const n = notes && typeof notes === "object" ? notes : {};
    return exports.FOCUS_KEYS.flatMap((key) => {
        const note = typeof n[key] === "string" ? (0, deals_1.asciiPunct)(n[key]).replace(/\s+/g, " ").trim() : "";
        return note ? [{ key, note }] : [];
    });
}
function planWalk(entries) {
    let t = exports.BUILD_SEC + INTRO_HOLD;
    const stops = entries.map((e) => {
        const departSec = t;
        const arriveSec = departSec + TRAVEL;
        const leaveSec = arriveSec + (0, exports.dwellSec)(e.note);
        t = leaveSec;
        return { ...e, departSec, arriveSec, leaveSec };
    });
    return { stops, pullBackSec: t, endSec: t + PULL_BACK + END_HOLD };
}
/** The clip length the notes ask for, rounded up to 0.1s. */
function plannedDurationMs(notes) {
    const entries = noteStops(notes);
    const sec = entries.length > 0 ? planWalk(entries).endSec : exports.PLAIN_SEC;
    return Math.ceil(sec * 10) * 100;
}
const FULL = { zoom: 1, focusX: 0.5, focusY: 0.5, card: "bottom" };
/** The note card's top edge and height, as frame fractions, per side. */
exports.NOTE_CARD = {
    bottom: { y: 0.79, h: 0.155 },
    top: { y: 0.05, h: 0.155 },
};
/** Where a focused headline may sit on screen (frame fractions): clear of the card. */
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
        return { ...FULL, card };
    const vw = W / zoom;
    const vh = H / zoom;
    const left = clamp(r.x + r.w / 2 - ((band.x0 + band.x1) / 2) * vw, 0, W - vw);
    const top = clamp(r.y + r.h / 2 - ((band.y0 + band.y1) / 2) * vh, 0, H - vh);
    return { zoom: Number(zoom.toFixed(4)), focusX: left / (W - vw), focusY: top / (H - vh), card };
}
/**
 * Zoom + focus that put `r` (in the W x H source space) as large as fits
 * clear of the note card, centred in that band. focus = window top-left /
 * (frame - window) — the inverse of the engine's crop (x = (iw - w) * focusX
 * after a zoom x scale). The crop can never pan past the source's edge, so a
 * headline near the bottom cannot be lifted above a bottom card: it gets the
 * card at the TOP instead.
 */
function frameOn(r, W, H) {
    const below = frameIn(r, W, H, "bottom");
    return screenBox(r, below, W, H).y1 <= SAFE.bottom.y1 * H + 0.5 ? below : frameIn(r, W, H, "top");
}
/**
 * One camera for the whole walk: full view through the build, then
 * ease to each stop and hold, then ease back to the full view and hold.
 * `T` maps planned seconds to clip seconds (the short-clip squeeze).
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
    key(T(plan.stops[0].departSec), FULL);
    for (const s of plan.stops) {
        const f = frameOn(rects[s.key], W, H);
        key(T(s.arriveSec), f);
        key(T(s.leaveSec), f);
    }
    key(T(plan.pullBackSec + PULL_BACK), FULL);
    const opts = { ease: "easeInOut" };
    return { zoom: (0, template_utils_1.keyframeExpr)(zoom, opts), focusX: (0, template_utils_1.keyframeExpr)(fx, opts), focusY: (0, template_utils_1.keyframeExpr)(fy, opts) };
}
