import type { MosaicDocument } from "@m0saic/types";
import { placeInsetPieces } from "@m0saic/template-utils";
import { checkDvdLayout, dvdLayoutConstraints } from "./contract";
import { DVD_WRAP_DEFAULT_PROPS } from "./props";
import { solidPiece } from "./panels/common";

describe("DVD layout contract", () => {
  it("resolves required labels and catches an escaped barcode", () => {
    const pieces = [
      solidPiece({ x: 10, y: 10, w: 120, h: 40 }, "#000000", "back synopsis"),
      solidPiece({ x: 160, y: 100, w: 60, h: 30 }, "#ffffff", "packaging barcode box"),
      solidPiece({ x: 250, y: 20, w: 100, h: 60 }, "#000000", "front title"),
      solidPiece({ x: 230, y: 20, w: 10, h: 120 }, "#000000", "spine catalog number"),
    ];
    const placed = placeInsetPieces({ rootW: 400, rootH: 200, pieces });
    const doc: MosaicDocument = { kind: "mosaic_document", version: 1, m0: placed.m0, sources: placed.sources, assets: {}, size: { width: 400, height: 200 } };
    const constraints = dvdLayoutConstraints({ artifact: "wrap", props: DVD_WRAP_DEFAULT_PROPS, canvasW: 400, canvasH: 200, backSafe: { x: 0, y: 0, w: 150, h: 200 } });
    const result = checkDvdLayout(doc, constraints);
    expect(result.ok).toBe(false);
    expect(result.violations.some((violation) => violation.label === "packaging barcode box" && violation.rule === "within-x")).toBe(true);
  });
});
