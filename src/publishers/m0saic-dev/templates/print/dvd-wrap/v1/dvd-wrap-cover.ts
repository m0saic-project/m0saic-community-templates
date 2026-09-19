import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import { isValidM0String } from "@m0saic/dsl";
import { placeInsetPieces, snapPxToLatticeFriendly } from "@m0saic/template-utils";
import {
  sliceRect,
  solidPiece,
  textBlockPieces,
  textSource,
  type PanelPiece,
  type PxRect,
} from "./panels/common";

function coverPieces(W: number, H: number): PanelPiece[] {
  const pad = Math.max(12, Math.round(Math.min(W, H) * 0.045));
  const stage: PxRect = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  const pieces: PanelPiece[] = [solidPiece({ x: 0, y: 0, w: W, h: H }, "#080b12", "cover surface")];
  pieces.push({
    rect: { ...sliceRect(stage, 0, 0, 1, 0.1), importance: 2 },
    source: textSource({ text: "DVD WRAP PRODUCTION", fontSize: Math.max(14, H * 0.044), color: "#f08a43", label: "cover title", hAlign: "left" }),
  });
  pieces.push(...textBlockPieces({
    text: "One release record. Territory-correct print masters.",
    rect: sliceRect(stage, 0, 0.1, 1, 0.1), fontSize: Math.max(10, H * 0.024), color: "#f3f5f7",
    label: "cover subtitle", maxLines: 2, importance: 2,
  }));

  const wrap = sliceRect(stage, 0, 0.25, 1, 0.43);
  const back = sliceRect(wrap, 0, 0, 0.465, 1);
  const spine = sliceRect(wrap, 0.465, 0, 0.07, 1);
  const front = sliceRect(wrap, 0.535, 0, 0.465, 1);
  pieces.push(solidPiece(back, "#23324a", "cover back panel", 1));
  pieces.push(solidPiece(spine, "#c6531a", "cover spine panel", 1));
  pieces.push(solidPiece(front, "#314f78", "cover front panel", 1));
  [
    { rect: back, text: "BACK", label: "cover back label" },
    { rect: spine, text: "SPINE", label: "cover spine label" },
    { rect: front, text: "FRONT", label: "cover front label" },
  ].forEach((item) => pieces.push({ rect: { ...item.rect, importance: 2 }, source: textSource({ text: item.text, fontSize: Math.max(8, Math.min(item.rect.w * 0.15, H * 0.025)), color: "#ffffff", label: item.label, hAlign: "center" }) }));

  const cards = [
    ["1  ADD CREATIVE", "Key art, title treatment, stills, badges"],
    ["2  ADD PRODUCTION DATA", "Barcode, catalog number, specs, legal copy"],
    ["3  FAN OUT TERRITORIES", "US, CA, UK, DE, FR, AU, JP, or custom"],
  ];
  cards.forEach(([title, body], index) => {
    const rect = sliceRect(stage, index / 3, 0.73, 0.31, 0.19);
    pieces.push(solidPiece(rect, "#141a25", `cover step ${index + 1} background`, 1));
    pieces.push({ rect: { ...sliceRect(rect, 0.06, 0.08, 0.88, 0.28), importance: 2 }, source: textSource({ text: title, fontSize: Math.max(7, H * 0.015), color: "#f08a43", label: `cover step ${index + 1} title`, hAlign: "left" }) });
    pieces.push(...textBlockPieces({ text: body, rect: sliceRect(rect, 0.06, 0.38, 0.88, 0.52), fontSize: Math.max(7, H * 0.013), color: "#d7dce4", label: `cover step ${index + 1} body`, maxLines: 3, importance: 2 }));
  });
  pieces.push({ rect: { ...sliceRect(stage, 0, 0.94, 1, 0.06), importance: 2 }, source: textSource({ text: "Edit any prop to begin. Open ? for the production walkthrough.", fontSize: Math.max(7, H * 0.014), color: "#aeb6c4", label: "cover start hint", hAlign: "center" }) });
  return pieces;
}

export function renderDvdWrapCover(ctx: MosaicEngineContext): MosaicDocument {
  // Lattice-friendly canvas: the stage hands us its raw dims (for this
  // template's default device that's the PRIME 3307×2244 dieline canvas),
  // and a prime axis makes placeInsetPieces emit hostile unit lattices.
  // The cover is a screen-only card the stage letterboxes anyway — ±3px is
  // invisible and keeps the m0 tiny.
  const W = snapPxToLatticeFriendly(Math.max(320, Math.round(ctx.target.width)));
  const H = snapPxToLatticeFriendly(Math.max(240, Math.round(ctx.target.height)));
  const placed = placeInsetPieces({ rootW: W, rootH: H, pieces: coverPieces(W, H) });
  if (!isValidM0String(String(placed.m0))) throw new Error("DVD wrap cover generated invalid m0");
  return {
    kind: "mosaic_document", version: 1, m0: placed.m0, sources: placed.sources, assets: {},
    size: { width: W, height: H }, fps: 30, durationMs: 1000,
    backgroundColor: "#080b12", editor: { label: "DVD Wrap first-open cover" },
  };
}
