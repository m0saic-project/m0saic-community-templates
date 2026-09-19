"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const front_1 = require("./front");
const common_1 = require("./common");
const props_1 = require("../props");
const variants_1 = require("../variants");
const geometry = { id: "front", trim: { x: 0, y: 0, w: 390, h: 552 }, paint: { x: 0, y: 0, w: 390, h: 552 }, safe: { x: 15, y: 15, w: 360, h: 522 }, widthMm: 130, heightMm: 184, dpi: 76.2 };
describe("front panel", () => {
    it("renders a typeset demo fallback with labeled real pieces", () => {
        const variant = (0, variants_1.resolveEffectiveVariant)(props_1.DVD_WRAP_DEFAULT_PROPS);
        const pieces = (0, front_1.buildFrontPanel)({ props: props_1.DVD_WRAP_DEFAULT_PROPS, variant, validation: { diagnostics: [], normalizedBarcode: variant.barcodeValue, checkDigitValid: true, assetDpi: [] }, geometry, assets: (0, common_1.createDvdAssetRegistry)() });
        expect(pieces.some((piece) => piece.source.editor?.label === "front demo surface")).toBe(true);
        expect(pieces.some((piece) => piece.source.editor?.label?.startsWith("front title"))).toBe(true);
    });
});
