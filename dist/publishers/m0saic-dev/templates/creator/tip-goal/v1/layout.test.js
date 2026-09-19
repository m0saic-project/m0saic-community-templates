"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const layout_1 = require("./layout");
const LOOK = {
    placement: "bottom",
    widthFrac: 0.94,
    heightFrac: 0.11,
    marginFrac: 0.05,
    labelPlacement: "left",
    labelWidthFrac: 0.16,
    fontScale: 1,
};
describe("preset geometry (1920x1080)", () => {
    it("splits a bottom band into label | bar without overlap", () => {
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$100", undefined, undefined);
        if (!out.ok)
            throw new Error(out.message);
        const { barRect, labelRect, fontPx } = out.geom;
        if (!labelRect)
            throw new Error("expected a label rect");
        expect(labelRect.x + labelRect.w).toBeLessThanOrEqual(barRect.x);
        expect(labelRect.y).toBe(barRect.y);
        expect(labelRect.h).toBe(barRect.h);
        // Bottom placement: band sits below center with the margin at the bottom.
        expect(barRect.y + barRect.h).toBe(1080 - Math.round(0.05 * 1080));
        expect(fontPx).toBeGreaterThan(10);
    });
    it('label "none" → the bar takes the whole band', () => {
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, { ...LOOK, labelPlacement: "none" }, "$100", undefined, undefined);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.geom.labelRect).toBeUndefined();
        expect(out.geom.barRect.w).toBe(Math.round(0.94 * 1920));
    });
    it('label "above" stacks counter over bar', () => {
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, { ...LOOK, labelPlacement: "above", heightFrac: 0.2 }, "$100", undefined, undefined);
        if (!out.ok)
            throw new Error(out.message);
        const { barRect, labelRect } = out.geom;
        if (!labelRect)
            throw new Error("expected a label rect");
        expect(labelRect.y + labelRect.h).toBeLessThanOrEqual(barRect.y);
        expect(labelRect.w).toBe(barRect.w);
    });
    it("a longer sample string fits a smaller font", () => {
        const short = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$9", undefined, undefined);
        const long = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$100000 / $200000", undefined, undefined);
        if (!short.ok || !long.ok)
            throw new Error("expected ok");
        expect(long.geom.fontPx).toBeLessThan(short.geom.fontPx);
    });
    it("a tiny canvas → TG_CANVAS_TOO_SMALL", () => {
        const out = (0, layout_1.computeTipGoalGeometry)(60, 40, LOOK, "$100", undefined, undefined);
        expect(out.ok).toBe(false);
        if (!out.ok)
            expect(out.code).toBe("TG_CANVAS_TOO_SMALL");
    });
});
describe("overrides", () => {
    it("geometry rects and fontSizePx win over the preset", () => {
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$100", undefined, {
            barRect: { x: 100, y: 100, w: 800, h: 60 },
            labelRect: { x: 10, y: 100, w: 80, h: 60 },
            fontSizePx: 33,
        });
        if (!out.ok)
            throw new Error(out.message);
        expect(out.geom.barRect).toEqual({ x: 100, y: 100, w: 800, h: 60 });
        expect(out.geom.labelRect).toEqual({ x: 10, y: 100, w: 80, h: 60 });
        expect(out.geom.fontPx).toBe(33);
    });
    it("layoutM0 whole-band replacement drives the split", () => {
        const m0 = (0, layout_1.validateLayoutM0)("5[F,-,-,-,-]", 1920, 1080);
        if (m0.kind !== "rect")
            throw new Error("expected a rect");
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$100", m0.rect, undefined);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.geom.barRect.y).toBe(0);
        expect(out.geom.barRect.h).toBe(216);
    });
    it("a below-floor label zone hides the counter with a warning", () => {
        const out = (0, layout_1.computeTipGoalGeometry)(1920, 1080, LOOK, "$100", undefined, {
            labelRect: { x: 0, y: 0, w: 20, h: 10 },
        });
        if (!out.ok)
            throw new Error(out.message);
        expect(out.geom.labelRect).toBeUndefined();
        expect(out.warnings.length).toBe(1);
    });
});
describe("layoutM0 validation", () => {
    it("empty / comments-only → unset", () => {
        expect((0, layout_1.validateLayoutM0)(undefined, 1920, 1080).kind).toBe("unset");
        expect((0, layout_1.validateLayoutM0)("  # just a comment\n", 1920, 1080).kind).toBe("unset");
    });
    it("garbage → TG_M0_PARSE", () => {
        const out = (0, layout_1.validateLayoutM0)("(((", 1920, 1080);
        expect(out.kind).toBe("error");
        if (out.kind === "error")
            expect(out.code).toBe("TG_M0_PARSE");
    });
    it("two rects → TG_M0_COUNT", () => {
        const out = (0, layout_1.validateLayoutM0)("2(1,1)", 1920, 1080);
        expect(out.kind).toBe("error");
        if (out.kind === "error")
            expect(out.code).toBe("TG_M0_COUNT");
    });
    it("a tall rect → TG_M0_SHAPE", () => {
        const out = (0, layout_1.validateLayoutM0)("1", 1920, 1080);
        expect(out.kind).toBe("error");
        if (out.kind === "error")
            expect(out.code).toBe("TG_M0_SHAPE");
    });
});
describe("geometry-override validation", () => {
    it("nullish → empty", () => {
        const out = (0, layout_1.validateGeometryOverride)(undefined);
        if (!out.ok)
            throw new Error(out.message);
        expect(out.value).toEqual({});
    });
    it("an array → TG_GEOMETRY_PARSE", () => {
        const out = (0, layout_1.validateGeometryOverride)([1]);
        expect(out.ok).toBe(false);
        if (!out.ok)
            expect(out.code).toBe("TG_GEOMETRY_PARSE");
    });
    it("a bad rect → TG_GEOMETRY", () => {
        const out = (0, layout_1.validateGeometryOverride)({ barRect: { x: 0, y: 0, w: -1, h: 5 } });
        expect(out.ok).toBe(false);
        if (!out.ok)
            expect(out.code).toBe("TG_GEOMETRY");
    });
    it("a junk fontSizePx degrades with a warning", () => {
        const out = (0, layout_1.validateGeometryOverride)({ fontSizePx: "big" });
        if (!out.ok)
            throw new Error(out.message);
        expect(out.value.fontSizePx).toBeUndefined();
        expect(out.warnings.length).toBe(1);
    });
});
