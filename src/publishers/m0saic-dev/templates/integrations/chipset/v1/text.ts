/**
 * Measured text for the chipset card (copied from docker/build-digest/v1 so
 * each template freezes on its own bytes): the svg
 * rasterizer never wraps or shrinks text, so every string is fitted here
 * against the bundled font (the BOLD file when drawn bold — the regular
 * metrics under-measure bold copy) and handed over pre-wrapped.
 */
import type { MosaicColor, MosaicOverlayExpr, MosaicSource } from "@m0saic/types";
import { measureText, resolveFontFile } from "@m0saic/template-utils";

const MIN_PX = 10;

export type Fit = { text: string; fontSize: number; width: number; height: number; lines: number };

/**
 * Largest size whose greedy wrap fits the box in at most `maxLines`, then
 * balanced (narrowest width keeping the line count, so no widows). When
 * nothing fits at the floor the copy is still wrapped at the floor.
 */
export function fitCopy(
  text: string,
  boxW: number,
  boxH: number,
  opts: { maxPx: number; maxLines: number; bold?: boolean },
): Fit {
  const fontPath = opts.bold ? resolveFontFile({ weight: "bold" })?.path : undefined;
  const measure = (s: string, fontSize: number) => measureText(s, { fontSize, ...(fontPath ? { fontPath } : {}) });
  const wrap = (fontSize: number, maxW: number): string[] => {
    const words = text.split(" ").filter((w) => w.length > 0);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (line.length === 0 || measure(candidate, fontSize).width <= maxW) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line.length > 0) lines.push(line);
    return lines;
  };
  const attempt = (fontSize: number): Fit | undefined => {
    const lines = wrap(fontSize, boxW);
    if (lines.length > opts.maxLines) return undefined;
    const block = lines.join("\n");
    const m = measure(block, fontSize);
    if (m.width > boxW || m.height > boxH) return undefined;
    return { text: block, fontSize, width: m.width, height: m.height, lines: lines.length };
  };
  let lo = MIN_PX;
  let hi = Math.max(MIN_PX, Math.round(opts.maxPx));
  let best = attempt(lo);
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const fit = attempt(mid);
    if (fit) { best = fit; lo = mid + 1; } else { hi = mid - 1; }
  }
  if (best) return balance(best);
  const lines = wrap(MIN_PX, boxW);
  const block = lines.join("\n");
  const m = measure(block, MIN_PX);
  return { text: block, fontSize: MIN_PX, width: m.width, height: m.height, lines: lines.length };

  function balance(fit: Fit): Fit {
    if (fit.lines < 2) return fit;
    let loW = Math.ceil(fit.width / fit.lines);
    let hiW = Math.floor(fit.width);
    let bestLines: string[] | null = null;
    while (loW <= hiW) {
      const midW = Math.floor((loW + hiW) / 2);
      const lines = wrap(fit.fontSize, midW);
      if (lines.length <= fit.lines) { bestLines = lines; hiW = midW - 1; } else { loW = midW + 1; }
    }
    if (!bestLines || bestLines.length !== fit.lines) return fit;
    const block = bestLines.join("\n");
    const m = measure(block, fit.fontSize);
    if (m.width > boxW || m.height > boxH) return fit;
    return { text: block, fontSize: fit.fontSize, width: m.width, height: m.height, lines: bestLines.length };
  }
}

/** One svg-rasterized text cell: bundled font, no drawtext, aligned inside its rect. */
export function textCell(opts: {
  fit: Fit;
  color: MosaicColor;
  hAlign: "left" | "right" | "center";
  vAlign?: "top" | "middle" | "bottom";
  bold?: boolean;
  label: string;
  overlay?: MosaicOverlayExpr;
}): MosaicSource {
  return {
    type: "text",
    rasterizer: "svg",
    renderMode: { kind: "image" },
    ...(opts.overlay ? { overlay: opts.overlay } : {}),
    layers: [
      {
        content: { kind: "literal", text: opts.fit.text },
        style: {
          fontSize: opts.fit.fontSize,
          fontColor: opts.color,
          ...(opts.bold ? { fontWeight: "bold" } : {}),
        },
        placement: { hAlign: opts.hAlign, vAlign: opts.vAlign ?? "middle" },
      },
    ],
    editor: { owner: "template", label: opts.label },
  } as MosaicSource;
}
