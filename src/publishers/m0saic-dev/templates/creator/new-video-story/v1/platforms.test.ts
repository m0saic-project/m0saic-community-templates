import {
  ANNOUNCE_PLATFORMS,
  ANNOUNCE_PLATFORM_IDS,
  ANNOUNCE_PLATFORM_OPTIONS,
  BADGE_GLYPHS,
  DEFAULT_ANNOUNCE_PLATFORM,
  isAnnouncePlatformId,
  isBadgeGlyph,
  resolveAnnouncePlatform,
  splitHeadline,
} from "./platforms";

describe("announce platforms (the preset table)", () => {
  it("every preset carries a two-word headline, copy, a badge and an accent", () => {
    for (const p of ANNOUNCE_PLATFORMS) {
      expect(p.headline.trim().split(/\s+/).length).toBeGreaterThanOrEqual(1);
      expect(p.cta.length).toBeGreaterThan(0);
      expect(p.linkText.length).toBeGreaterThan(0);
      expect(BADGE_GLYPHS).toContain(p.badge);
      expect(p.accent).toMatch(/^#[0-9A-F]{6}$/);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("ids are unique and the options mirror them", () => {
    expect(new Set(ANNOUNCE_PLATFORM_IDS).size).toBe(ANNOUNCE_PLATFORMS.length);
    expect(ANNOUNCE_PLATFORM_OPTIONS.map((o) => o.value)).toEqual(ANNOUNCE_PLATFORM_IDS);
    expect(ANNOUNCE_PLATFORM_IDS).toContain(DEFAULT_ANNOUNCE_PLATFORM);
  });

  it("youtube is the default and reads as the reference story", () => {
    const yt = resolveAnnouncePlatform(undefined);
    expect(yt.id).toBe("youtube");
    expect(yt.headline).toBe("NEW VIDEO");
    expect(yt.cta).toBe("WATCH FULL VIDEO HERE");
    expect(yt.linkText).toBe("YOUTU.BE");
    expect(yt.badge).toBe("play");
    expect(yt.accent).toBe("#FF0000");
  });

  it("resolves known ids and falls back for unknown ones (never throws)", () => {
    expect(resolveAnnouncePlatform("twitch").headline).toBe("LIVE NOW");
    expect(resolveAnnouncePlatform("podcast").cta).toBe("LISTEN TO THE FULL EPISODE");
    expect(resolveAnnouncePlatform("myspace").id).toBe("youtube");
    expect(resolveAnnouncePlatform(42).id).toBe("youtube");
    expect(isAnnouncePlatformId("x")).toBe(true);
    expect(isAnnouncePlatformId("X")).toBe(false);
  });

  it("badge glyph guard", () => {
    expect(isBadgeGlyph("play")).toBe(true);
    expect(isBadgeGlyph("none")).toBe(true);
    expect(isBadgeGlyph("auto")).toBe(false);
    expect(isBadgeGlyph(undefined)).toBe(false);
  });
});

describe("splitHeadline (last word is the big line)", () => {
  it("two words → small over big, upper-cased", () => {
    expect(splitHeadline("new video")).toEqual({ top: "NEW", main: "VIDEO" });
  });
  it("three words → everything but the last on top", () => {
    expect(splitHeadline("brand new episode")).toEqual({ top: "BRAND NEW", main: "EPISODE" });
  });
  it("one word → a single big line", () => {
    expect(splitHeadline("  LIVE ")).toEqual({ top: "", main: "LIVE" });
  });
  it("collapses whitespace; empty → empty", () => {
    expect(splitHeadline("new\t\n  reel")).toEqual({ top: "NEW", main: "REEL" });
    expect(splitHeadline("   ")).toEqual({ top: "", main: "" });
  });
});
