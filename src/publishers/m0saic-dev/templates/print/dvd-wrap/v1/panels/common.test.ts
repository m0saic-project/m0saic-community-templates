import { parseM0StringToRenderFrames } from "@m0saic/dsl";
import { placeInsetPieces } from "@m0saic/template-utils";
import { createDvdAssetRegistry, gridRects, solidPiece, textBlockPieces } from "./common";

describe("DVD panel common helpers", () => {
  it("mints collision-safe manifest keys and labeled media sources", () => {
    const assets = createDvdAssetRegistry();
    const a = assets.media("/one/cover.png", "first");
    const b = assets.media("/two/cover.png", "second");
    expect(a.assetId).not.toBe(b.assetId);
    expect(Object.keys(assets.manifest)).toHaveLength(2);
    expect(a.editor?.label).toBe("first");
  });

  it("uses real cells for wrapped text and grid tiles", () => {
    const pieces = [
      solidPiece({ x: 0, y: 0, w: 400, h: 200 }, "#000000", "surface"),
      ...textBlockPieces({ text: "A sufficiently long line that wraps into real cells", rect: { x: 20, y: 20, w: 160, h: 80 }, fontSize: 18, color: "#ffffff", label: "copy", maxLines: 4 }),
    ];
    const placed = placeInsetPieces({ rootW: 400, rootH: 200, pieces });
    expect(parseM0StringToRenderFrames(placed.m0, 400, 200)).toHaveLength(placed.sources.length);
    expect(gridRects({ x: 0, y: 0, w: 300, h: 200 }, 6, 4)).toHaveLength(6);
  });
});
