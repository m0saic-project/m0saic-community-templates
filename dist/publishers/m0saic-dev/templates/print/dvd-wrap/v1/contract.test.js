"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_utils_1 = require("@m0saic/template-utils");
const contract_1 = require("./contract");
const props_1 = require("./props");
const common_1 = require("./panels/common");
describe("DVD layout contract", () => {
    it("resolves required labels and catches an escaped barcode", () => {
        const pieces = [
            (0, common_1.solidPiece)({ x: 10, y: 10, w: 120, h: 40 }, "#000000", "back synopsis"),
            (0, common_1.solidPiece)({ x: 160, y: 100, w: 60, h: 30 }, "#ffffff", "packaging barcode box"),
            (0, common_1.solidPiece)({ x: 250, y: 20, w: 100, h: 60 }, "#000000", "front title"),
            (0, common_1.solidPiece)({ x: 230, y: 20, w: 10, h: 120 }, "#000000", "spine catalog number"),
        ];
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: 400, rootH: 200, pieces });
        const doc = { kind: "mosaic_document", version: 1, m0: placed.m0, sources: placed.sources, assets: {}, size: { width: 400, height: 200 } };
        const constraints = (0, contract_1.dvdLayoutConstraints)({ artifact: "wrap", props: props_1.DVD_WRAP_DEFAULT_PROPS, canvasW: 400, canvasH: 200, backSafe: { x: 0, y: 0, w: 150, h: 200 } });
        const result = (0, contract_1.checkDvdLayout)(doc, constraints);
        expect(result.ok).toBe(false);
        expect(result.violations.some((violation) => violation.label === "packaging barcode box" && violation.rule === "within-x")).toBe(true);
    });
});
