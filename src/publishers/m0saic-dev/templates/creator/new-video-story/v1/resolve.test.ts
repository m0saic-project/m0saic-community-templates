import { classifyMedia, resolveColor, resolveNewVideoStory } from "./resolve";

function cfgOf(props: Parameters<typeof resolveNewVideoStory>[0]) {
  const out = resolveNewVideoStory(props);
  if (!out.ok) throw new Error(`${out.code}: ${out.message}`);
  return out;
}

describe("resolveNewVideoStory", () => {
  it("empty props → the youtube preset, animated, black stage, cover from the top", () => {
    const { cfg, warnings } = cfgOf({});
    expect(warnings).toEqual([]);
    expect(cfg.platform.id).toBe("youtube");
    expect(cfg.headlineTop).toBe("NEW");
    expect(cfg.headlineMain).toBe("VIDEO");
    expect(cfg.cta).toBe("WATCH FULL VIDEO HERE");
    expect(cfg.linkText).toBe("YOUTU.BE");
    expect(cfg.badge).toBe("play");
    expect(cfg.badgeImage).toBe("");
    expect(cfg.accent).toBe("#FF0000");
    expect(cfg.background).toBe("#000000");
    expect(cfg.media).toBe("");
    expect(cfg.mediaRegion).toBeUndefined();
    expect(cfg.mediaFit).toBe("cover");
    expect(cfg.mediaFocus).toBe(0);
    expect(cfg.mediaCorner).toBe(0);
    expect(cfg.mediaAudio).toBe(true);
    expect(cfg.animate).toBe(true);
  });

  it("the platform preset fills what the user left empty; overrides win and upper-case", () => {
    const { cfg } = cfgOf({ platform: "twitch", cta: "  come hang out ", linkText: "" });
    expect(cfg.headlineTop).toBe("LIVE");
    expect(cfg.headlineMain).toBe("NOW");
    expect(cfg.cta).toBe("COME HANG OUT");
    expect(cfg.linkText).toBe("TWITCH.TV");
    expect(cfg.badge).toBe("live");
    expect(cfg.accent).toBe("#9146FF");
  });

  it("a custom headline splits on its last word", () => {
    const { cfg } = cfgOf({ headline: "brand new podcast episode" });
    expect(cfg.headlineTop).toBe("BRAND NEW PODCAST");
    expect(cfg.headlineMain).toBe("EPISODE");
    expect(cfgOf({ headline: "premiere" }).cfg.headlineTop).toBe("");
  });

  it("badge: auto = the platform's, explicit wins, unknown warns and falls back", () => {
    expect(cfgOf({ platform: "tiktok", badge: "auto" }).cfg.badge).toBe("note");
    expect(cfgOf({ platform: "tiktok", badge: "camera" }).cfg.badge).toBe("camera");
    expect(cfgOf({ platform: "x" }).cfg.badge).toBe("none");
    const out = cfgOf({ platform: "youtube", badge: "sparkle" });
    expect(out.cfg.badge).toBe("play");
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/badge "sparkle" unknown/);
  });

  it("colour knobs: blank falls back to the preset / stage default", () => {
    expect(resolveColor("", "#ABCDEF")).toBe("#ABCDEF");
    expect(resolveColor("  ", "#ABCDEF")).toBe("#ABCDEF");
    expect(resolveColor(" #123456 ", "#ABCDEF")).toBe("#123456");
    const { cfg } = cfgOf({ platform: "instagram-reel", accentColor: "", backgroundColor: " #101010 " });
    expect(cfg.accent).toBe("#E1306C");
    expect(cfg.background).toBe("#101010");
  });

  it("screenshot knobs: fit narrows, focus / corner clamp, audio defaults on", () => {
    const { cfg } = cfgOf({
      media: " shot.png ",
      mediaFit: "contain",
      mediaFocus: 3,
      mediaCorner: -1,
      mediaAudio: false,
      animate: false,
    });
    expect(cfg.media).toBe("shot.png");
    expect(cfg.mediaFit).toBe("contain");
    expect(cfg.mediaFocus).toBe(1);
    expect(cfg.mediaCorner).toBe(0);
    expect(cfg.mediaAudio).toBe(false);
    expect(cfg.animate).toBe(false);
    expect(cfgOf({ mediaFit: "stretch" as never }).cfg.mediaFit).toBe("cover");
    expect(cfgOf({ mediaFocus: Number.NaN }).cfg.mediaFocus).toBe(0);
  });

  it("screenshot area: the first drawn rect is kept, a bad value warns and is dropped", () => {
    const drawn = cfgOf({
      mediaRegion: { canvas: { w: 540, h: 960 }, regions: [{ x: 10, y: 20, w: 100, h: 200 }, { x: 0, y: 0, w: 5, h: 5 }] },
    });
    expect(drawn.warnings).toEqual([]);
    expect(drawn.cfg.mediaRegion).toEqual({
      canvas: { w: 540, h: 960 },
      regions: [expect.objectContaining({ x: 10, y: 20, w: 100, h: 200 })],
    });

    const bad = cfgOf({ mediaRegion: "{not json" });
    expect(bad.cfg.mediaRegion).toBeUndefined();
    expect(bad.warnings[0]).toMatch(/mediaRegion ignored/);

    expect(cfgOf({ mediaRegion: "" }).cfg.mediaRegion).toBeUndefined();
    expect(cfgOf({ mediaRegion: { regions: [] } }).cfg.mediaRegion).toBeUndefined();
  });
});

describe("classifyMedia", () => {
  it("the probe wins; else the extension; else image", () => {
    expect(classifyMedia("x.png", "video")).toBe("video");
    expect(classifyMedia("x.mp4", "image")).toBe("image");
    expect(classifyMedia("clip.MOV", undefined)).toBe("video");
    expect(classifyMedia("shot.webp", undefined)).toBe("image");
    expect(classifyMedia("https://cdn/x.mp4?sig=1", undefined)).toBe("video");
  });
});
