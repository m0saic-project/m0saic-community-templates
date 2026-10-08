import { measureText, resolveFontFile } from "@m0saic/template-utils";

/**
 * Measured text fitting for svg-rasterized copy, in the face it is drawn in.
 * Nothing in m0saic soft-wraps or shrinks text, so every block is wrapped
 * and sized here, against the same font file the rasterizer reads.
 */

export type Face = "regular" | "bold" | "italic";
export type TextFit = { lines: string[]; px: number; face: Face; width: number; h: number };

/** Line height as a multiple of the font size (the rasterizer's default). */
export const LINE = 1.25;
/** The fit budget inside a cell: `cell * 0.94 - 2px` (the layout contract's rule). */
export const budget = (cellW: number) => Math.max(8, Math.floor(cellW * 0.94 - 2));
/** A rect sized FROM its fitted text, carrying the slack the budget promises. */
export const blockH = (lines: number, px: number) => Math.ceil((lines * LINE * px + 2) / 0.94);

/** The font file of a face, or undefined for the bundled default (regular). */
export function facePath(face: Face): string | undefined {
  if (face === "regular") return undefined;
  return resolveFontFile({ weight: face === "bold" ? "bold" : "normal", style: face === "italic" ? "italic" : "normal" })?.path;
}

export function widthOf(text: string, px: number, face: Face): number {
  const fontPath = facePath(face);
  return measureText(text, { fontSize: px, ...(fontPath ? { fontPath } : {}) }).width;
}

/** Greedy word-wrap in the face that will be drawn. Never breaks a word. */
export function wrapLines(text: string, px: number, maxW: number, face: Face): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ").filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && widthOf(next, px, face) > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Same line count, shortest longest line: no one-word last line. Cannot undo a fit. */
export function balanceLines(text: string, px: number, maxW: number, face: Face, lines: string[]): string[] {
  if (lines.length < 2) return lines;
  let best = lines;
  let lo = 0;
  let hi = maxW;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const tried = wrapLines(text, px, mid, face);
    if (tried.length <= lines.length && tried.every((l) => widthOf(l, px, face) <= maxW)) {
      best = tried;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

/** Cut to fit with a trailing "..." - the last resort, after shrinking. */
export function ellipsize(text: string, px: number, maxW: number, face: Face, force = false): string {
  if (!force && widthOf(text, px, face) <= maxW) return text;
  let t = text;
  while (t.length > 1 && widthOf(`${t}...`, px, face) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/**
 * Fit copy into `maxW` x `maxH`: the largest size (maxPx down to minPx) whose
 * wrapped block fits the width, the line cap and the height, then rebalanced.
 * At the floor it drops lines and ellipsizes - a degrade, never an overflow.
 * `maxW` is the usable width (apply {@link budget} to a cell yourself).
 */
export function fitText(text: string, maxW: number, maxH: number, maxPx: number, minPx: number, maxLines: number, face: Face): TextFit {
  let px = Math.max(minPx, Math.round(maxPx));
  let lines = wrapLines(text, px, maxW, face);
  const fits = () => lines.length <= maxLines && blockH(lines.length, px) <= maxH && lines.every((l) => widthOf(l, px, face) <= maxW);
  while (px > minPx && !fits()) {
    px = Math.max(minPx, Math.min(px - 1, Math.round(px * 0.94)));
    lines = wrapLines(text, px, maxW, face);
  }
  const keep = Math.max(1, Math.min(maxLines, lines.length, Math.floor((maxH * 0.94 - 2) / (LINE * px)) || 1));
  if (keep < lines.length) {
    lines = lines.slice(0, keep);
    lines[keep - 1] = ellipsize(lines[keep - 1], px, maxW, face, true);
  } else lines = balanceLines(text, px, maxW, face, lines);
  lines = lines.map((l) => ellipsize(l, px, maxW, face));
  const width = lines.reduce((m, l) => Math.max(m, widthOf(l, px, face)), 0);
  return { lines, px, face, width, h: blockH(lines.length, px) };
}

/**
 * Copy that arrived from a CRM row or a generator: fold typographic
 * punctuation to ASCII, drop what the bundled font cannot draw (emoji, other
 * scripts), collapse whitespace.
 */
export function cleanCopy(value: string): string {
  return value
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e¡-ſ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
