"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const template_utils_1 = require("@m0saic/template-utils");
const common_1 = require("./common");
describe("DVD panel common helpers", () => {
    it("mints collision-safe manifest keys and labeled media sources", () => {
        const assets = (0, common_1.createDvdAssetRegistry)();
        const a = assets.media("/one/cover.png", "first");
        const b = assets.media("/two/cover.png", "second");
        expect(a.assetId).not.toBe(b.assetId);
        expect(Object.keys(assets.manifest)).toHaveLength(2);
        expect(a.editor?.label).toBe("first");
    });
    it("uses real cells for wrapped text and grid tiles", () => {
        const pieces = [
            (0, common_1.solidPiece)({ x: 0, y: 0, w: 400, h: 200 }, "#000000", "surface"),
            ...(0, common_1.textBlockPieces)({ text: "A sufficiently long line that wraps into real cells", rect: { x: 20, y: 20, w: 160, h: 80 }, fontSize: 18, color: "#ffffff", label: "copy", maxLines: 4 }),
        ];
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: 400, rootH: 200, pieces });
        expect((0, dsl_1.parseM0StringToRenderFrames)(placed.m0, 400, 200)).toHaveLength(placed.sources.length);
        expect((0, common_1.gridRects)({ x: 0, y: 0, w: 300, h: 200 }, 6, 4)).toHaveLength(6);
    });
});
