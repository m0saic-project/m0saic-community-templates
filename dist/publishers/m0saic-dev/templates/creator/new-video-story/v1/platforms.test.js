"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platforms_1 = require("./platforms");
describe("announce platforms (the preset table)", () => {
    it("every preset carries a two-word headline, copy, a badge and an accent", () => {
        for (const p of platforms_1.ANNOUNCE_PLATFORMS) {
            expect(p.headline.trim().split(/\s+/).length).toBeGreaterThanOrEqual(1);
            expect(p.cta.length).toBeGreaterThan(0);
            expect(p.linkText.length).toBeGreaterThan(0);
            expect(platforms_1.BADGE_GLYPHS).toContain(p.badge);
            expect(p.accent).toMatch(/^#[0-9A-F]{6}$/);
            expect(p.label.length).toBeGreaterThan(0);
        }
    });
    it("ids are unique and the options mirror them", () => {
        expect(new Set(platforms_1.ANNOUNCE_PLATFORM_IDS).size).toBe(platforms_1.ANNOUNCE_PLATFORMS.length);
        expect(platforms_1.ANNOUNCE_PLATFORM_OPTIONS.map((o) => o.value)).toEqual(platforms_1.ANNOUNCE_PLATFORM_IDS);
        expect(platforms_1.ANNOUNCE_PLATFORM_IDS).toContain(platforms_1.DEFAULT_ANNOUNCE_PLATFORM);
    });
    it("youtube is the default and reads as the reference story", () => {
        const yt = (0, platforms_1.resolveAnnouncePlatform)(undefined);
        expect(yt.id).toBe("youtube");
        expect(yt.headline).toBe("NEW VIDEO");
        expect(yt.cta).toBe("WATCH FULL VIDEO HERE");
        expect(yt.linkText).toBe("YOUTU.BE");
        expect(yt.badge).toBe("play");
        expect(yt.accent).toBe("#FF0000");
    });
    it("resolves known ids and falls back for unknown ones (never throws)", () => {
        expect((0, platforms_1.resolveAnnouncePlatform)("twitch").headline).toBe("LIVE NOW");
        expect((0, platforms_1.resolveAnnouncePlatform)("podcast").cta).toBe("LISTEN TO THE FULL EPISODE");
        expect((0, platforms_1.resolveAnnouncePlatform)("myspace").id).toBe("youtube");
        expect((0, platforms_1.resolveAnnouncePlatform)(42).id).toBe("youtube");
        expect((0, platforms_1.isAnnouncePlatformId)("x")).toBe(true);
        expect((0, platforms_1.isAnnouncePlatformId)("X")).toBe(false);
    });
    it("badge glyph guard", () => {
        expect((0, platforms_1.isBadgeGlyph)("play")).toBe(true);
        expect((0, platforms_1.isBadgeGlyph)("none")).toBe(true);
        expect((0, platforms_1.isBadgeGlyph)("auto")).toBe(false);
        expect((0, platforms_1.isBadgeGlyph)(undefined)).toBe(false);
    });
});
describe("splitHeadline (last word is the big line)", () => {
    it("two words → small over big, upper-cased", () => {
        expect((0, platforms_1.splitHeadline)("new video")).toEqual({ top: "NEW", main: "VIDEO" });
    });
    it("three words → everything but the last on top", () => {
        expect((0, platforms_1.splitHeadline)("brand new episode")).toEqual({ top: "BRAND NEW", main: "EPISODE" });
    });
    it("one word → a single big line", () => {
        expect((0, platforms_1.splitHeadline)("  LIVE ")).toEqual({ top: "", main: "LIVE" });
    });
    it("collapses whitespace; empty → empty", () => {
        expect((0, platforms_1.splitHeadline)("new\t\n  reel")).toEqual({ top: "NEW", main: "REEL" });
        expect((0, platforms_1.splitHeadline)("   ")).toEqual({ top: "", main: "" });
    });
});
