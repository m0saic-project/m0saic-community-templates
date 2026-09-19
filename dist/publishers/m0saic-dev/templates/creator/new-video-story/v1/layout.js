"use strict";
/**
 * Layout — every rect the story paints, as integer pixels for the exact
 * render canvas (laundered into real m0 cells by `placeInsetPieces` in
 * compose). The card is designed for a 9:16 story: sizes are fractions of a
 * 1080×1920 design column scaled by `S = min(W/1080, H/1920)`, anchored to
 * the top of the canvas and centred horizontally, so a wider canvas shows
 * the same column with stage colour either side and the screenshot slot
 * still runs to the bottom edge.
 *
 * Stack (fractions of the scaled design height D):
 *
 *   0.075  ┌ headline row 1 — the small line ("NEW") + the badge
 *          ├ headline row 2 — the big line ("VIDEO")
 *   +0.032 ├ boxed call-to-action
 *   +0.014 ├ three down arrows (their cell holds the bob)
 *   +0.030 ├ link pill
 *   0.51   └ screenshot slot — full width, to the bottom edge
 *
 * Text is measured with the bundled Roboto Bold (`measureText`, the same
 * metrics `textToPath` draws with), so the cells hug the ink exactly and the
 * same numbers hold on every machine. Pure; no engine imports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STROKE_EM = exports.HALO_EM = exports.CAP_HEIGHT_EM = exports.DESIGN_H = exports.DESIGN_W = void 0;
exports.boldFontPath = boldFontPath;
exports.textWidth = textWidth;
exports.fontAscent = fontAscent;
exports.stickerLine = stickerLine;
exports.computeStoryLayout = computeStoryLayout;
const template_utils_1 = require("@m0saic/template-utils");
/** The design column the fractions below are authored against. */
exports.DESIGN_W = 1080;
exports.DESIGN_H = 1920;
/**
 * Roboto's cap height (OS/2 sCapHeight 1456 / 2048 upm) — the sticker is all
 * caps, so cells are sized to the cap box, not the full em box.
 */
exports.CAP_HEIGHT_EM = 0.711;
/** Sticker outline radii, as fractions of the font size (halo ⊃ stroke). */
exports.HALO_EM = 0.105;
exports.STROKE_EM = 0.055;
/** Glyphs whose ink drops below the baseline (an all-caps line rarely has one). */
const DESCENDER_RE = /[QJgjpqy,;]/;
let boldPathCache = null;
/** Bundled Roboto Bold — the one face every line draws with. */
function boldFontPath() {
    if (boldPathCache === null) {
        boldPathCache = (0, template_utils_1.resolveFontFile)({ family: "Roboto", weight: 700 })?.path;
    }
    return boldPathCache;
}
const fontOpts = (fontSize) => ({
    fontSize,
    ...(boldFontPath() !== undefined ? { fontPath: boldFontPath() } : {}),
});
/** Advance width of `text` at `fontSize` in the bold face. */
function textWidth(text, fontSize) {
    return text === "" ? 0 : (0, template_utils_1.measureText)(text, fontOpts(fontSize)).width;
}
/** Font ascent at `fontSize` (baseline = cap-top + cap height = top + ascent). */
function fontAscent(fontSize) {
    return (0, template_utils_1.measureText)("", fontOpts(fontSize)).ascent;
}
const r = Math.round;
/** Shrink `fontSize` until `text` fits `maxWidth` (never below `minPx`). */
function fitWidth(text, fontSize, maxWidth, minPx = 8) {
    let size = fontSize;
    let w = textWidth(text, size);
    if (w <= maxWidth || w === 0)
        return size;
    size = Math.max(minPx, Math.floor((size * maxWidth) / w));
    // One correction pass: advance widths are linear in size, but rounding
    // can leave a pixel over.
    w = textWidth(text, size);
    while (w > maxWidth && size > minPx) {
        size -= 1;
        w = textWidth(text, size);
    }
    return size;
}
/**
 * A sticker line at a known cap-top and centre: the cell hugs the cap box
 * plus the outline radius (and a descender allowance when the text needs
 * one). `baselineY` is where `textToPath` pins the glyphs.
 */
function stickerLine(text, fontSize, centerX, capTop, outline) {
    const width = textWidth(text, fontSize);
    const haloPx = outline ? Math.max(1, r(fontSize * exports.HALO_EM)) : 0;
    const strokePx = outline ? Math.max(1, r(fontSize * exports.STROKE_EM)) : 0;
    const pad = haloPx + 2;
    const capH = fontSize * exports.CAP_HEIGHT_EM;
    const descent = DESCENDER_RE.test(text) ? fontSize * 0.14 : 0;
    const x0 = r(centerX - width / 2) - pad;
    const y0 = r(capTop) - pad;
    const cell = {
        x: x0,
        y: y0,
        w: r(width) + 2 * pad,
        h: r(capH + descent) + 2 * pad,
    };
    return { text, fontSize, width, cell, baselineY: r(capTop + capH), haloPx, strokePx };
}
function computeStoryLayout(W, H, input) {
    const S = Math.min(W / exports.DESIGN_W, H / exports.DESIGN_H);
    const D = exports.DESIGN_H * S;
    const Wd = exports.DESIGN_W * S;
    const stage = { x: r((W - Wd) / 2), y: 0, w: r(Wd), h: r(D) };
    const cx = W / 2;
    // ── Headline ──
    // Row 1 = [top line][gap][badge] as one centred group; row 2 = the big
    // line, centred. The badge is sized off the column width (w:h = 1.4) and
    // centred on row 1's cap box, nudged down so it tucks into row 2's
    // corner like a sticker on a sticker.
    const badgeW = input.hasBadge ? r(Wd * 0.21) : 0;
    const badgeH = input.hasBadge ? r(badgeW / 1.4) : 0;
    const badgeGap = input.hasBadge ? r(Wd * 0.03) : 0;
    const maxLineW = Wd * 0.78;
    let headlineTop;
    let badge;
    let mainCapTop;
    const hasTop = input.headlineTop !== "";
    if (hasTop) {
        let topSize = r(D * 0.0675);
        topSize = fitWidth(input.headlineTop, topSize, Math.max(40, maxLineW - badgeGap - badgeW));
        const topW = textWidth(input.headlineTop, topSize);
        const groupW = topW + badgeGap + badgeW;
        const topCenterX = cx - groupW / 2 + topW / 2;
        const topCapTop = D * 0.075;
        headlineTop = stickerLine(input.headlineTop, topSize, topCenterX, topCapTop, true);
        if (input.hasBadge) {
            const capMid = topCapTop + (topSize * exports.CAP_HEIGHT_EM) / 2;
            badge = {
                x: r(cx + groupW / 2 - badgeW),
                y: r(capMid - badgeH / 2 + D * 0.006),
                w: badgeW,
                h: badgeH,
            };
        }
        mainCapTop = topCapTop + topSize * exports.CAP_HEIGHT_EM + D * 0.018;
    }
    else {
        mainCapTop = D * 0.085;
    }
    let mainSize = r(D * 0.085);
    const mainMaxW = hasTop || !input.hasBadge ? maxLineW : Math.max(40, maxLineW - badgeGap - badgeW);
    mainSize = fitWidth(input.headlineMain, mainSize, mainMaxW);
    let mainCenterX = cx;
    if (!hasTop && input.hasBadge) {
        // Single-word headline: the badge sits beside the big line instead.
        const mainW = textWidth(input.headlineMain, mainSize);
        const groupW = mainW + badgeGap + badgeW;
        mainCenterX = cx - groupW / 2 + mainW / 2;
        const capMid = mainCapTop + (mainSize * exports.CAP_HEIGHT_EM) / 2;
        badge = { x: r(cx + groupW / 2 - badgeW), y: r(capMid - badgeH / 2), w: badgeW, h: badgeH };
    }
    const headlineMain = stickerLine(input.headlineMain, mainSize, mainCenterX, mainCapTop, true);
    const mainCapBottom = mainCapTop + mainSize * exports.CAP_HEIGHT_EM;
    // ── Boxed call-to-action ──
    const ctaH = r(D * 0.052);
    const ctaTop = r(mainCapBottom + D * 0.032);
    const ctaStrokePx = Math.max(2, r(D * 0.0045));
    const ctaPadX = r(Wd * 0.05);
    const ctaMaxW = r(Wd * 0.86);
    let ctaSize = r(ctaH * 0.5);
    ctaSize = fitWidth(input.cta, ctaSize, ctaMaxW - 2 * ctaPadX);
    const ctaTextW = textWidth(input.cta, ctaSize);
    const ctaW = Math.max(r(Wd * 0.5), Math.min(ctaMaxW, r(ctaTextW) + 2 * ctaPadX));
    const ctaBox = { x: r(cx - ctaW / 2), y: ctaTop, w: ctaW, h: ctaH };
    const ctaCapTop = ctaTop + (ctaH - ctaSize * exports.CAP_HEIGHT_EM) / 2;
    const ctaText = stickerLine(input.cta, ctaSize, cx, ctaCapTop, false);
    // ── Arrows ──
    const arrowInkH = r(D * 0.04);
    const arrowBobPx = r(D * 0.012);
    const arrowW = r(Wd * 0.05);
    const arrowsTop = ctaTop + ctaH + r(D * 0.014);
    const arrowPitch = Wd * 0.14;
    const arrows = [-1, 0, 1].map((k) => ({
        x: r(cx + k * arrowPitch - arrowW / 2),
        y: arrowsTop,
        w: arrowW,
        h: arrowInkH + arrowBobPx,
    }));
    // ── Link pill ──
    const pillH = r(D * 0.062);
    const pillTop = arrowsTop + arrowInkH + r(D * 0.03);
    const iconSize = r(pillH * 0.5);
    const pillPadL = r(pillH * 0.42);
    const pillPadR = r(pillH * 0.5);
    const iconGap = r(pillH * 0.22);
    const pillMaxW = r(Wd * 0.86);
    let pillSize = r(pillH * 0.42);
    pillSize = fitWidth(input.linkText, pillSize, pillMaxW - pillPadL - iconSize - iconGap - pillPadR);
    const pillTextW = textWidth(input.linkText, pillSize);
    const pillW = Math.max(r(Wd * 0.28), Math.min(pillMaxW, pillPadL + iconSize + iconGap + r(pillTextW) + pillPadR));
    const pill = { x: r(cx - pillW / 2), y: pillTop, w: pillW, h: pillH };
    // Icon + text form one centred group inside the pill.
    const groupW = iconSize + iconGap + pillTextW;
    const groupX = pill.x + (pillW - groupW) / 2;
    const pillIcon = { x: r(groupX), y: r(pillTop + (pillH - iconSize) / 2), w: iconSize, h: iconSize };
    const pillCapTop = pillTop + (pillH - pillSize * exports.CAP_HEIGHT_EM) / 2;
    const pillText = stickerLine(input.linkText, pillSize, groupX + iconSize + iconGap + pillTextW / 2, pillCapTop, false);
    // ── Screenshot slot ──
    // Default: full width from 51 % of the design height to the bottom edge
    // (the reference proportion), never above the pill.
    let media;
    let mediaIsDefault = true;
    if (input.mediaOverride) {
        media = { ...input.mediaOverride };
        mediaIsDefault = false;
    }
    else {
        const top = Math.min(H - 1, Math.max(r(D * 0.51), pillTop + pillH + r(D * 0.05)));
        media = { x: 0, y: top, w: W, h: Math.max(1, H - top) };
    }
    return {
        scale: S,
        stage,
        ...(headlineTop ? { headlineTop } : {}),
        headlineMain,
        ...(badge ? { badge } : {}),
        ctaBox,
        ctaStrokePx,
        ctaText,
        arrows,
        arrowInkH,
        arrowBobPx,
        pill,
        pillIcon,
        pillText,
        media,
        mediaIsDefault,
    };
}
