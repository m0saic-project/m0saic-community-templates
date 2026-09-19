"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const layout_1 = require("./layout");
const table = { x: 70, y: 203, w: 940, h: 1289 }; // 1080×1920, safe area off
describe("spotlightRect", () => {
    it("centres a sizeFrac square on the table, horizontally and vertically", () => {
        const spot = (0, layout_1.spotlightRect)(table, 0.62);
        expect(spot).toEqual({ x: 249, y: 556, w: 583, h: 583 });
        expect(spot.x + spot.w / 2).toBeCloseTo(table.x + table.w / 2, -1);
        expect(spot.y + spot.h / 2).toBeCloseTo(table.y + table.h / 2, -1);
    });
    it("never drops below 16 px and is deterministic", () => {
        expect((0, layout_1.spotlightRect)({ x: 0, y: 0, w: 20, h: 20 }, 0.1).w).toBe(16);
        expect((0, layout_1.spotlightRect)(table, 0.5)).toEqual((0, layout_1.spotlightRect)(table, 0.5));
    });
});
