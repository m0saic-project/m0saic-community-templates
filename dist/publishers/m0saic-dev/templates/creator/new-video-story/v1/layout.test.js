"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const layout_1 = require("./layout");
const REF = {
    headlineTop: "NEW",
    headlineMain: "VIDEO",
    cta: "WATCH FULL VIDEO HERE",
    linkText: "YOUTU.BE",
    hasBadge: true,
};
const inside = (r, W, H) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H && r.w >= 1 && r.h >= 1;
const bottom = (r) => r.y + r.h;
const centerX = (r) => r.x + r.w / 2;
describe("bold face", () => {
    it("resolves the bundled Roboto Bold and measures wider than regular-ish sizes", () => {
        expect((0, layout_1.boldFontPath)()).toMatch(/Roboto-Bold\.ttf$/);
        expect((0, layout_1.textWidth)("VIDEO", 100)).toBeGreaterThan(250);
        expect((0, layout_1.textWidth)("", 100)).toBe(0);
    });
});
describe("stickerLine", () => {
    it("hugs the cap box plus the outline pad, baseline at cap-top + cap height", () => {
        const l = (0, layout_1.stickerLine)("VIDEO", 160, 540, 300, true);
        expect(l.haloPx).toBe(Math.round(160 * layout_1.HALO_EM));
        expect(l.strokePx).toBe(Math.round(160 * layout_1.STROKE_EM));
        const pad = l.haloPx + 2;
        expect(l.cell.y).toBe(300 - pad);
        expect(l.cell.h).toBe(Math.round(160 * layout_1.CAP_HEIGHT_EM) + 2 * pad);
        expect(l.baselineY).toBe(Math.round(300 + 160 * layout_1.CAP_HEIGHT_EM));
        expect(centerX(l.cell)).toBeCloseTo(540, 0);
        expect(l.cell.w).toBe(Math.round(l.width) + 2 * pad);
    });
    it("plain lines carry no outline; descender glyphs get a deeper cell", () => {
        const plain = (0, layout_1.stickerLine)("YOUTU.BE", 50, 540, 700, false);
        expect(plain.haloPx).toBe(0);
        expect(plain.strokePx).toBe(0);
        const q = (0, layout_1.stickerLine)("QUICK", 100, 540, 0, false);
        const n = (0, layout_1.stickerLine)("NEW", 100, 540, 0, false);
        expect(q.cell.h).toBeGreaterThan(n.cell.h);
    });
});
describe("computeStoryLayout at the story canvas (1080×1920)", () => {
    const W = 1080;
    const H = 1920;
    const L = (0, layout_1.computeStoryLayout)(W, H, REF);
    it("scale 1, design column = the canvas", () => {
        expect(L.scale).toBe(1);
        expect(L.stage).toEqual({ x: 0, y: 0, w: layout_1.DESIGN_W, h: layout_1.DESIGN_H });
    });
    it("reads top to bottom: headline → CTA → arrows → pill → screenshot", () => {
        expect(L.headlineTop).toBeDefined();
        const top = L.headlineTop;
        expect(top.cell.y).toBeGreaterThan(H * 0.05);
        expect(L.headlineMain.cell.y).toBeGreaterThanOrEqual(bottom(top.cell) - top.haloPx * 2 - 4);
        expect(L.ctaBox.y).toBeGreaterThan(bottom(L.headlineMain.cell) - L.headlineMain.haloPx);
        for (const a of L.arrows)
            expect(a.y).toBeGreaterThanOrEqual(bottom(L.ctaBox));
        expect(L.pill.y).toBeGreaterThan(L.arrows[0].y + L.arrowInkH);
        expect(L.media.y).toBeGreaterThan(bottom(L.pill));
    });
    it("the big line is bigger than the small one and both stay inside the column", () => {
        expect(L.headlineMain.fontSize).toBeGreaterThan(L.headlineTop.fontSize);
        expect(L.headlineMain.fontSize).toBe(Math.round(H * 0.085));
        expect(L.headlineTop.fontSize).toBe(Math.round(H * 0.0675));
        expect(L.headlineMain.cell.w).toBeLessThan(W * 0.85);
        expect(centerX(L.headlineMain.cell)).toBeCloseTo(W / 2, 0);
    });
    it("the badge sits right of the small line, w:h = 1.4, tucked into the big line's corner", () => {
        const b = L.badge;
        expect(b.w).toBe(Math.round(W * 0.21));
        expect(b.h).toBe(Math.round(b.w / 1.4));
        expect(b.x).toBeGreaterThan(L.headlineTop.cell.x + L.headlineTop.cell.w - L.headlineTop.haloPx * 2);
        // Row 1 = [top][gap][badge] centred on the canvas.
        const groupLeft = L.headlineTop.cell.x + L.headlineTop.haloPx + 2;
        const groupRight = b.x + b.w;
        expect((groupLeft + groupRight) / 2).toBeCloseTo(W / 2, -1);
        // Overlaps the big line's top by more than the halo alone (the sticker-on-sticker tuck).
        const mainCapTop = L.headlineMain.cell.y + L.headlineMain.haloPx + 2;
        expect(bottom(b)).toBeGreaterThan(mainCapTop);
        expect(bottom(b) - mainCapTop).toBeLessThan(b.h * 0.3);
    });
    it("CTA: box holds the text with padding, capped to the column; frame ≥ 2 px", () => {
        expect(L.ctaBox.h).toBe(Math.round(H * 0.052));
        expect(L.ctaBox.w).toBeLessThanOrEqual(Math.round(W * 0.86));
        expect(L.ctaBox.w).toBeGreaterThanOrEqual(Math.round(W * 0.5));
        expect(L.ctaText.cell.x).toBeGreaterThan(L.ctaBox.x + L.ctaStrokePx);
        expect(L.ctaText.cell.x + L.ctaText.cell.w).toBeLessThan(L.ctaBox.x + L.ctaBox.w - L.ctaStrokePx);
        expect(L.ctaText.cell.y).toBeGreaterThan(L.ctaBox.y);
        expect(bottom(L.ctaText.cell)).toBeLessThan(bottom(L.ctaBox));
        expect(L.ctaStrokePx).toBeGreaterThanOrEqual(2);
        expect(centerX(L.ctaBox)).toBeCloseTo(W / 2, 0);
    });
    it("three arrows, evenly pitched, each cell = ink + bob", () => {
        expect(L.arrows).toHaveLength(3);
        const cs = L.arrows.map(centerX);
        expect(cs[1]).toBeCloseTo(W / 2, 0);
        expect(cs[1] - cs[0]).toBeCloseTo(cs[2] - cs[1], 0);
        for (const a of L.arrows) {
            expect(a.h).toBe(L.arrowInkH + L.arrowBobPx);
            expect(a.y).toBe(L.arrows[0].y);
        }
        expect(L.arrowBobPx).toBeGreaterThan(0);
    });
    it("pill: icon then text as one centred group inside the pill", () => {
        expect(L.pill.h).toBe(Math.round(H * 0.062));
        expect(centerX(L.pill)).toBeCloseTo(W / 2, 0);
        expect(L.pillIcon.x).toBeGreaterThan(L.pill.x);
        expect(L.pillText.cell.x).toBeGreaterThan(L.pillIcon.x + L.pillIcon.w);
        expect(L.pillText.cell.x + L.pillText.cell.w).toBeLessThan(L.pill.x + L.pill.w);
        expect(L.pillIcon.y).toBeGreaterThan(L.pill.y);
        expect(bottom(L.pillIcon)).toBeLessThan(bottom(L.pill));
    });
    it("the default screenshot slot: full width from 51 % to the bottom edge", () => {
        expect(L.media).toEqual({ x: 0, y: Math.round(H * 0.51), w: W, h: H - Math.round(H * 0.51) });
        expect(L.mediaIsDefault).toBe(true);
    });
    it("every rect is inside the canvas", () => {
        const rects = [
            L.headlineTop.cell,
            L.headlineMain.cell,
            L.badge,
            L.ctaBox,
            L.ctaText.cell,
            ...L.arrows,
            L.pill,
            L.pillIcon,
            L.pillText.cell,
            L.media,
        ];
        for (const r of rects)
            expect(inside(r, W, H)).toBe(true);
    });
});
describe("computeStoryLayout — variants", () => {
    it("a drawn screenshot rect replaces the default slot verbatim", () => {
        const L = (0, layout_1.computeStoryLayout)(1080, 1920, { ...REF, mediaOverride: { x: 100, y: 1200, w: 880, h: 500 } });
        expect(L.media).toEqual({ x: 100, y: 1200, w: 880, h: 500 });
        expect(L.mediaIsDefault).toBe(false);
    });
    it("no badge: the small line centres on the canvas", () => {
        const L = (0, layout_1.computeStoryLayout)(1080, 1920, { ...REF, hasBadge: false });
        expect(L.badge).toBeUndefined();
        expect(Math.abs(centerX(L.headlineTop.cell) - 540)).toBeLessThanOrEqual(1);
    });
    it("single-word headline: no small line, the badge sits beside the big line", () => {
        const L = (0, layout_1.computeStoryLayout)(1080, 1920, { ...REF, headlineTop: "", headlineMain: "PREMIERE" });
        expect(L.headlineTop).toBeUndefined();
        const b = L.badge;
        expect(b.x).toBeGreaterThan(L.headlineMain.cell.x + L.headlineMain.cell.w - L.headlineMain.haloPx * 2);
        expect(L.ctaBox.y).toBeGreaterThan(bottom(L.headlineMain.cell) - L.headlineMain.haloPx);
    });
    it("long copy shrinks to fit the column instead of spilling", () => {
        const L = (0, layout_1.computeStoryLayout)(1080, 1920, {
            headlineTop: "BRAND NEW PODCAST",
            headlineMain: "EPISODE",
            cta: "LISTEN TO THE FULL EPISODE RIGHT NOW ON EVERY PLATFORM",
            linkText: "OPEN.SPOTIFY.COM/SHOW/SOMETHING-VERY-LONG",
            hasBadge: true,
        });
        expect(L.headlineTop.fontSize).toBeLessThan(Math.round(1920 * 0.0675));
        expect(L.headlineMain.fontSize).toBeLessThanOrEqual(Math.round(1920 * 0.085));
        expect(L.headlineMain.cell.x + L.headlineMain.cell.w).toBeLessThanOrEqual(1080);
        expect(L.ctaBox.w).toBeLessThanOrEqual(Math.round(1080 * 0.86));
        expect(L.ctaText.cell.x + L.ctaText.cell.w).toBeLessThan(L.ctaBox.x + L.ctaBox.w);
        expect(L.pill.w).toBeLessThanOrEqual(Math.round(1080 * 0.86));
        expect(L.pillText.cell.x + L.pillText.cell.w).toBeLessThan(L.pill.x + L.pill.w);
    });
    it("scales with the shorter design ratio and centres the column on a wide canvas", () => {
        const half = (0, layout_1.computeStoryLayout)(540, 960, REF);
        expect(half.scale).toBe(0.5);
        expect(half.headlineMain.fontSize).toBe(Math.round(1920 * 0.5 * 0.085));
        expect(half.media.y).toBe(Math.round(960 * 0.51));
        const wide = (0, layout_1.computeStoryLayout)(1920, 1080, REF);
        expect(wide.scale).toBeCloseTo(1080 / 1920, 5);
        expect(wide.stage.w).toBe(Math.round(1080 * (1080 / 1920)));
        expect(centerX(wide.headlineMain.cell)).toBeCloseTo(960, 0);
        // The screenshot slot still runs edge to edge.
        expect(wide.media.x).toBe(0);
        expect(wide.media.w).toBe(1920);
        expect(wide.media.y + wide.media.h).toBe(1080);
    });
    it("is deterministic", () => {
        expect((0, layout_1.computeStoryLayout)(1080, 1920, REF)).toEqual((0, layout_1.computeStoryLayout)(1080, 1920, REF));
    });
});
