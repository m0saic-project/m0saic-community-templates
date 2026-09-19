"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platforms_1 = require("./platforms");
describe("creator platforms", () => {
    it("every platform but \"canvas\" owns an even-sized canvas; options mirror the table", () => {
        for (const p of platforms_1.CREATOR_PLATFORMS) {
            if (p.id === "canvas") {
                expect(p.canvas).toBeUndefined();
                continue;
            }
            expect(p.canvas).toBeDefined();
            expect(p.canvas.width % 2).toBe(0);
            expect(p.canvas.height % 2).toBe(0);
        }
        expect(platforms_1.CREATOR_PLATFORM_OPTIONS.map((o) => o.value)).toEqual(platforms_1.CREATOR_PLATFORMS.map((p) => p.id));
        expect((0, platforms_1.isCreatorPlatformId)(platforms_1.DEFAULT_CREATOR_PLATFORM)).toBe(true);
    });
    it("resolves unknown / unset to the default, never throws", () => {
        expect((0, platforms_1.resolveCreatorPlatform)(undefined).id).toBe(platforms_1.DEFAULT_CREATOR_PLATFORM);
        expect((0, platforms_1.resolveCreatorPlatform)("nope").id).toBe(platforms_1.DEFAULT_CREATOR_PLATFORM);
        expect((0, platforms_1.resolveCreatorPlatform)("tiktok").id).toBe("tiktok");
    });
    it("the stage sits inside the canvas and the rail only exists on short-form platforms", () => {
        for (const p of platforms_1.CREATOR_PLATFORMS) {
            const W = p.canvas?.width ?? 1280;
            const H = p.canvas?.height ?? 720;
            const { safe, rail } = (0, platforms_1.platformStage)(p, W, H);
            expect(safe.x).toBeGreaterThanOrEqual(0);
            expect(safe.y).toBeGreaterThanOrEqual(0);
            expect(safe.x + safe.w).toBeLessThanOrEqual(W);
            expect(safe.y + safe.h).toBeLessThanOrEqual(H);
            const shortForm = ["tiktok", "youtube-shorts", "instagram-reel"].includes(p.id);
            expect(rail !== undefined).toBe(shortForm);
            if (rail) {
                expect(rail.x + rail.w).toBe(W);
                expect(rail.y).toBe(Math.round(H * p.rail.top));
            }
        }
    });
});
