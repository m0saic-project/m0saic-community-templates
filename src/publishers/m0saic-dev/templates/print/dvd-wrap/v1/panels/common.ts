import type {
  MosaicAssetManifest,
  MosaicColor,
  MosaicMediaSource,
  MosaicSource,
  MosaicTextSource,
} from "@m0saic/types";
import {
  makeColorTile,
  slugifyAssetKeyFromPath,
  uniqueAssetKey,
  wrapText,
} from "@m0saic/template-utils";
import type { DvdPanelId } from "../dieline";

export type PxRect = { x: number; y: number; w: number; h: number };

export type PanelGeometry = {
  id: DvdPanelId;
  trim: PxRect;
  paint: PxRect;
  safe: PxRect;
  widthMm: number;
  heightMm: number;
  dpi: number;
};

export type PanelPiece = {
  rect: PxRect & { importance?: number };
  source: MosaicSource;
};

export type DvdAssetRegistry = {
  manifest: MosaicAssetManifest;
  media(path: string, label: string, fit?: "contain" | "cover"): MosaicMediaSource;
};

export function createDvdAssetRegistry(): DvdAssetRegistry {
  const manifest = {} as MosaicAssetManifest;
  return {
    manifest,
    media(path: string, label: string, fit = "contain"): MosaicMediaSource {
      const assetId = uniqueAssetKey(slugifyAssetKeyFromPath(path), manifest);
      manifest[assetId] = { kind: "file", path, mediaType: "image", displayName: label };
      return {
        type: "media",
        mediaType: "image",
        assetId,
        placement: { fit },
        editor: { owner: "template", label },
      };
    },
  };
}

export function pxPerMm(dpi: number): number {
  return dpi / 25.4;
}

export function insetRect(rect: PxRect, inset: number): PxRect {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    w: Math.max(1, rect.w - inset * 2),
    h: Math.max(1, rect.h - inset * 2),
  };
}

export function sliceRect(
  rect: PxRect,
  xFrac: number,
  yFrac: number,
  wFrac: number,
  hFrac: number,
): PxRect {
  const x = Math.round(rect.x + rect.w * xFrac);
  const y = Math.round(rect.y + rect.h * yFrac);
  const right = Math.round(rect.x + rect.w * (xFrac + wFrac));
  const bottom = Math.round(rect.y + rect.h * (yFrac + hFrac));
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

export function textSource(args: {
  text: string;
  fontSize: number;
  color: MosaicColor;
  label: string;
  hAlign?: "left" | "center" | "right";
  backgroundColor?: MosaicColor;
}): MosaicTextSource {
  return {
    type: "text",
    rasterizer: "svg",
    style: { fontSize: Math.max(6, Math.round(args.fontSize)), fontColor: args.color },
    layers: [{ content: { kind: "literal", text: args.text } }],
    placement: { hAlign: args.hAlign ?? "left", vAlign: "middle" },
    ...(args.backgroundColor ? { visual: { backgroundColor: args.backgroundColor } } : {}),
    renderMode: { kind: "image" },
    editor: { owner: "template", label: args.label },
  };
}

export function textBlockPieces(args: {
  text: string;
  rect: PxRect;
  fontSize: number;
  color: MosaicColor;
  label: string;
  maxLines: number;
  hAlign?: "left" | "center" | "right";
  importance?: number;
}): PanelPiece[] {
  const maxChars = Math.max(4, Math.floor(args.rect.w / Math.max(1, args.fontSize * 0.56)));
  const rawLines = wrapText(args.text.trim() || " ", maxChars);
  const lines = rawLines.slice(0, args.maxLines);
  if (rawLines.length > args.maxLines && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
  }
  const lineH = Math.max(1, Math.floor(args.rect.h / Math.max(1, lines.length)));
  return lines.map((line, index) => ({
    rect: {
      x: args.rect.x,
      y: args.rect.y + index * lineH,
      w: args.rect.w,
      h: index === lines.length - 1 ? args.rect.h - index * lineH : lineH,
      importance: args.importance ?? 2,
    },
    source: textSource({
      text: line,
      fontSize: args.fontSize,
      color: args.color,
      // Every wrapped line keeps the semantic block label. Layout contracts
      // intentionally target intent, not a line number that changes when copy
      // reflows at another DPI or panel width.
      label: args.label,
      hAlign: args.hAlign,
    }),
  }));
}

export function solidPiece(
  rect: PxRect,
  color: MosaicColor,
  label: string,
  importance = 0,
): PanelPiece {
  const source = makeColorTile(color);
  source.editor = { owner: "template", label };
  return { rect: { ...rect, importance }, source };
}

export function mediaPiece(
  rect: PxRect,
  source: MosaicMediaSource,
  importance = 1,
): PanelPiece {
  return { rect: { ...rect, importance }, source };
}

export function gridRects(rect: PxRect, count: number, gapPx: number): PxRect[] {
  if (count <= 0) return [];
  const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const out: PxRect[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x0 = Math.round(rect.x + (col * rect.w) / cols + (col === 0 ? 0 : gapPx / 2));
    const x1 = Math.round(rect.x + ((col + 1) * rect.w) / cols - (col === cols - 1 ? 0 : gapPx / 2));
    const y0 = Math.round(rect.y + (row * rect.h) / rows + (row === 0 ? 0 : gapPx / 2));
    const y1 = Math.round(rect.y + ((row + 1) * rect.h) / rows - (row === rows - 1 ? 0 : gapPx / 2));
    out.push({ x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) });
  }
  return out;
}

export function cornerRect(
  bounds: PxRect,
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  size: number,
  pad: number,
): PxRect {
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  return {
    x: left ? bounds.x + pad : bounds.x + bounds.w - size - pad,
    y: top ? bounds.y + pad : bounds.y + bounds.h - size - pad,
    w: size,
    h: size,
  };
}
