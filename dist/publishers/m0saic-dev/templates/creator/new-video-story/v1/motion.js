"use strict";
/**
 * Motion — the story's choreography as ffmpeg overlay expressions
 * (`xExpr` / `yExpr` / `alpha` / `enable`), one bundle per piece. Every
 * distance is a PIXEL LITERAL, not a tile-local `W`/`H` fraction: pieces that
 * move together (a sticker line's halo + stroke + fill, the pill's body +
 * glyph + text) have different cell sizes, and a fraction of each cell would
 * pull them apart. Pixel literals also let the app preview evaluate the same
 * expression in canvas space.
 *
 * The timeline (seconds from the start of the render):
 *
 *   0.00  screenshot rises in
 *   0.15  small headline line slides in from the left
 *   0.25  big headline line slides in from the right
 *   0.55  badge drops in from above with an overshoot
 *   0.85  CTA box rises in
 *   1.15  arrows cascade in (0.15 s apart), then bob forever
 *   1.65  link pill pops up (fade + overshoot from below)
 *
 * All exprs read absolute `t`; `enable` gates and `window` lifetimes let the
 * engine skip a piece's upstream work while it is off-canvas. Functions used
 * (min, max, pow, cos, gte, PI) are in both ffmpeg's evaluator and the
 * preview's subset.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTLED_AT_SEC = exports.STORY_TIMELINE = exports.BOB_PERIOD_SEC = exports.POP_SEC = exports.ARROW_RISE_SEC = exports.DROP_SEC = exports.RISE_SEC = exports.SLIDE_SEC = void 0;
exports.easeOutBackExpr = easeOutBackExpr;
exports.slideInX = slideInX;
exports.dropIn = dropIn;
exports.riseIn = riseIn;
exports.popIn = popIn;
exports.bobTerm = bobTerm;
exports.arrowMotion = arrowMotion;
const template_utils_1 = require("@m0saic/template-utils");
exports.SLIDE_SEC = 0.5;
exports.RISE_SEC = 0.45;
exports.DROP_SEC = 0.55;
exports.ARROW_RISE_SEC = 0.3;
exports.POP_SEC = 0.5;
/** One bob period (down and back), seconds. */
exports.BOB_PERIOD_SEC = 1.1;
exports.STORY_TIMELINE = {
    mediaAt: 0,
    headlineTopAt: 0.15,
    headlineMainAt: 0.25,
    badgeAt: 0.55,
    ctaAt: 0.85,
    arrowsAt: [1.15, 1.3, 1.45],
    pillAt: 1.65,
    bobAt: 1.45 + exports.ARROW_RISE_SEC,
};
/**
 * The poster moment: every piece has arrived AND the arrows are at the rest
 * point of their bob (the first bob period boundary after the pill settles),
 * so the still hosts cut from here is the composed card, not a mid-bob.
 */
exports.SETTLED_AT_SEC = (() => {
    const settled = exports.STORY_TIMELINE.pillAt + exports.POP_SEC;
    const k = Math.ceil((settled - exports.STORY_TIMELINE.bobAt) / exports.BOB_PERIOD_SEC);
    return Math.round((exports.STORY_TIMELINE.bobAt + k * exports.BOB_PERIOD_SEC) * 1000) / 1000;
})();
const f3 = (v) => (Math.round(v * 1000) / 1000).toString();
/** Eased 0→1 progress over `[atSec, atSec + durSec]` (ease-out). */
function easeOut(atSec, durSec) {
    return (0, template_utils_1.easingExpr)("easeOut", (0, template_utils_1.progressExpr)(atSec, durSec));
}
/**
 * Overshooting 0→1 progress (Penner's back-out, c1 = 1.70158): passes 1 by
 * ~10 % before settling — the drop-and-bounce of a slapped-on sticker.
 */
function easeOutBackExpr(atSec, durSec) {
    const u = `(${(0, template_utils_1.progressExpr)(atSec, durSec)})`;
    return `(1+2.70158*pow(${u}-1,3)+1.70158*pow(${u}-1,2))`;
}
/** Slides in along x from `fromDx` px (negative = from the left). */
function slideInX(atSec, durSec, fromDx) {
    return {
        xExpr: `(1-${easeOut(atSec, durSec)})*${f3(fromDx)}`,
        enable: `gte(t,${f3(atSec)})`,
        startAtSec: atSec,
        window: { startSec: atSec },
    };
}
/** Drops in along y from `fromDy` px above (negative) with an overshoot. */
function dropIn(atSec, durSec, fromDy) {
    return {
        yExpr: `(1-${easeOutBackExpr(atSec, durSec)})*${f3(fromDy)}`,
        enable: `gte(t,${f3(atSec)})`,
        startAtSec: atSec,
        window: { startSec: atSec },
    };
}
/** Fades in while drifting up `driftPx` (the `rise` entrance, in pixels). */
function riseIn(atSec, durSec, driftPx) {
    const p = easeOut(atSec, durSec);
    return {
        alpha: p,
        yExpr: `(1-${p})*${f3(driftPx)}`,
        startAtSec: atSec,
        window: { startSec: atSec },
    };
}
/** A quick fade plus an overshooting rise from `driftPx` below — a pop. */
function popIn(atSec, durSec, driftPx) {
    const fade = (0, template_utils_1.progressExpr)(atSec, Math.max(0.05, durSec * 0.45));
    return {
        alpha: fade,
        yExpr: `(1-${easeOutBackExpr(atSec, durSec)})*${f3(driftPx)}`,
        startAtSec: atSec,
        window: { startSec: atSec },
    };
}
/**
 * A continuous downward bob of `ampPx` starting at `atSec` (0 there, so it
 * joins the entrance without a jump), as a y term to ADD to an entrance.
 */
function bobTerm(atSec, ampPx, periodSec = exports.BOB_PERIOD_SEC) {
    return `gte(t,${f3(atSec)})*${f3(ampPx)}*(0.5-0.5*cos(2*PI*(t-${f3(atSec)})/${f3(periodSec)}))`;
}
/** An arrow's motion: its rise-in plus the shared bob. */
function arrowMotion(atSec, driftPx, bobAt, ampPx) {
    const rise = riseIn(atSec, exports.ARROW_RISE_SEC, driftPx);
    return { ...rise, yExpr: `(${rise.yExpr})+${bobTerm(bobAt, ampPx)}` };
}
