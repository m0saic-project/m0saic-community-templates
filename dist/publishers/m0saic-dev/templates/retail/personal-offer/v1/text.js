"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockH = exports.budget = exports.LINE = void 0;
exports.facePath = facePath;
exports.widthOf = widthOf;
exports.wrapLines = wrapLines;
exports.balanceLines = balanceLines;
exports.ellipsize = ellipsize;
exports.fitText = fitText;
exports.cleanCopy = cleanCopy;
const template_utils_1 = require("@m0saic/template-utils");
/** Line height as a multiple of the font size (the rasterizer's default). */
exports.LINE = 1.25;
/** The fit budget inside a cell: `cell * 0.94 - 2px` (the layout contract's rule). */
const budget = (cellW) => Math.max(8, Math.floor(cellW * 0.94 - 2));
exports.budget = budget;
/** A rect sized FROM its fitted text, carrying the slack the budget promises. */
const blockH = (lines, px) => Math.ceil((lines * exports.LINE * px + 2) / 0.94);
exports.blockH = blockH;
/** The font file of a face, or undefined for the bundled default (regular). */
function facePath(face) {
    if (face === "regular")
        return undefined;
    return (0, template_utils_1.resolveFontFile)({ weight: face === "bold" ? "bold" : "normal", style: face === "italic" ? "italic" : "normal" })?.path;
}
function widthOf(text, px, face) {
    const fontPath = facePath(face);
    return (0, template_utils_1.measureText)(text, { fontSize: px, ...(fontPath ? { fontPath } : {}) }).width;
}
/** Greedy word-wrap in the face that will be drawn. Never breaks a word. */
function wrapLines(text, px, maxW, face) {
    const lines = [];
    let cur = "";
    for (const word of text.split(" ").filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (cur && widthOf(next, px, face) > maxW) {
            lines.push(cur);
            cur = word;
        }
        else
            cur = next;
    }
    if (cur)
        lines.push(cur);
    return lines;
}
/** Same line count, shortest longest line: no one-word last line. Cannot undo a fit. */
function balanceLines(text, px, maxW, face, lines) {
    if (lines.length < 2)
        return lines;
    let best = lines;
    let lo = 0;
    let hi = maxW;
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        const tried = wrapLines(text, px, mid, face);
        if (tried.length <= lines.length && tried.every((l) => widthOf(l, px, face) <= maxW)) {
            best = tried;
            hi = mid;
        }
        else
            lo = mid;
    }
    return best;
}
/** Cut to fit with a trailing "..." - the last resort, after shrinking. */
function ellipsize(text, px, maxW, face, force = false) {
    if (!force && widthOf(text, px, face) <= maxW)
        return text;
    let t = text;
    while (t.length > 1 && widthOf(`${t}...`, px, face) > maxW)
        t = t.slice(0, -1);
    return `${t.trimEnd()}...`;
}
/**
 * Fit copy into `maxW` x `maxH`: the largest size (maxPx down to minPx) whose
 * wrapped block fits the width, the line cap and the height, then rebalanced.
 * At the floor it drops lines and ellipsizes - a degrade, never an overflow.
 * `maxW` is the usable width (apply {@link budget} to a cell yourself).
 */
function fitText(text, maxW, maxH, maxPx, minPx, maxLines, face) {
    let px = Math.max(minPx, Math.round(maxPx));
    let lines = wrapLines(text, px, maxW, face);
    const fits = () => lines.length <= maxLines && (0, exports.blockH)(lines.length, px) <= maxH && lines.every((l) => widthOf(l, px, face) <= maxW);
    while (px > minPx && !fits()) {
        px = Math.max(minPx, Math.min(px - 1, Math.round(px * 0.94)));
        lines = wrapLines(text, px, maxW, face);
    }
    const keep = Math.max(1, Math.min(maxLines, lines.length, Math.floor((maxH * 0.94 - 2) / (exports.LINE * px)) || 1));
    if (keep < lines.length) {
        lines = lines.slice(0, keep);
        lines[keep - 1] = ellipsize(lines[keep - 1], px, maxW, face, true);
    }
    else
        lines = balanceLines(text, px, maxW, face, lines);
    lines = lines.map((l) => ellipsize(l, px, maxW, face));
    const width = lines.reduce((m, l) => Math.max(m, widthOf(l, px, face)), 0);
    return { lines, px, face, width, h: (0, exports.blockH)(lines.length, px) };
}
/**
 * Copy that arrived from a CRM row or a generator: fold typographic
 * punctuation to ASCII, drop what the bundled font cannot draw (emoji, other
 * scripts), collapse whitespace.
 */
function cleanCopy(value) {
    return value
        .replace(/[‘’′]/g, "'")
        .replace(/[“”″]/g, '"')
        .replace(/[‐-―]/g, "-")
        .replace(/…/g, "...")
        .replace(/[^\x20-\x7e¡-ſ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
