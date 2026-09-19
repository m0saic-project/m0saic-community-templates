import { isValidM0String, parseM0StringComplete } from "@m0saic/dsl";
import { engineRecover } from "@m0saic/template-utils";

import { buildNewVideoStoryDoc } from "./compose";
import { resolveNewVideoStory, type ResolvedConfig } from "./resolve";
import type { NewVideoStoryV1Props } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const W = 1080;
const H = 1920;

function cfg(props: NewVideoStoryV1Props = {}): ResolvedConfig {
  const out = resolveNewVideoStory(props);
  if (!out.ok) throw new Error(out.message);
  return out.cfg;
}

function build(props: NewVideoStoryV1Props = {}, w = W, h = H, kinds: Record<string, "video" | "image"> = {}) {
  const out = buildNewVideoStoryDoc(cfg(props), w, h, 30, 8000, (p) => kinds[p] ?? (/\.mp4$/i.test(p) ? "video" : "image"));
  if (!out.ok) throw new Error(`${out.code}: ${out.message}`);
  return out;
}

const labelsOf = (doc: any): string[] => doc.sources.map((s: any) => s.editor?.label);
const find = (doc: any, label: string) => doc.sources.find((s: any) => s.editor?.label === label);

/** Painted rect of a source: its quantized frame through the engine's inset floor math. */
function painted(doc: any, source: any) {
  const parsed = parseM0StringComplete(doc.m0, doc.size.width, doc.size.height);
  if (!parsed.ok) throw new Error("m0 did not parse");
  const f = parsed.ir.renderFrames[doc.sources.indexOf(source)];
  return engineRecover({ x: f.x, y: f.y, w: f.width, h: f.height }, source.placement?.inset ?? null);
}

describe("buildNewVideoStoryDoc — the default story", () => {
  const out = build();
  const doc: any = out.doc;

  it("is a valid single-layer-stack doc with one source per frame", () => {
    expect(doc.kind).toBe("mosaic_document");
    expect(doc.size).toEqual({ width: W, height: H });
    expect(doc.fps).toBe(30);
    expect(doc.durationMs).toBe(8000);
    expect(doc.backgroundColor).toBe("#000000");
    expect(isValidM0String(doc.m0)).toBe(true);
    const parsed = parseM0StringComplete(doc.m0, W, H);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
    expect(out.expectations).toHaveLength(doc.sources.length);
    expect(out.warnings).toEqual([]);
  });

  it("paints, bottom to top: placeholder + label, badge, sticker lines, CTA, arrows, pill", () => {
    expect(labelsOf(doc)).toEqual([
      "media",
      "media-label",
      "badge",
      "badge-glyph",
      "headline-top",
      "headline-top",
      "headline-top",
      "headline",
      "headline",
      "headline",
      "cta-box",
      "cta",
      "arrow",
      "arrow",
      "arrow",
      "pill",
      "pill-glyph",
      "link",
    ]);
    expect(out.stats).toMatchObject({ animated: true, hasMedia: false, sourceCount: 18 });
    expect(out.stats.mediaRect).toEqual({ x: 0, y: Math.round(H * 0.51), w: W, h: H - Math.round(H * 0.51) });
  });

  it("binds what it shows: the screenshot rect, the copy, the accent", () => {
    expect(find(doc, "media").editor.binding).toEqual({ propKey: "mediaRegion", kind: "rect" });
    for (const s of doc.sources.filter((x: any) => x.editor?.label === "headline" || x.editor?.label === "headline-top")) {
      expect(s.editor.binding).toEqual({ propKey: "headline" });
    }
    expect(find(doc, "cta").editor.binding).toEqual({ propKey: "cta" });
    expect(find(doc, "link").editor.binding).toEqual({ propKey: "linkText" });
    expect(find(doc, "badge").editor.binding).toEqual({ propKey: "accentColor" });
    expect(find(doc, "arrow").editor.binding).toBeUndefined();
  });

  it("every piece paints on its exact intent rect (inset recovery, zero drift)", () => {
    out.expectations.forEach((exp: any, i: number) => {
      const src = doc.sources[i];
      expect(painted(doc, src)).toEqual(exp.rect);
    });
  });

  it("the sticker is white glyphs on a black stroke on a white halo, with a shared outline", () => {
    const [halo, stroke, fill] = doc.sources.filter((s: any) => s.editor?.label === "headline");
    expect(halo.color).toBe("#FFFFFF");
    expect(stroke.color).toBe("#000000");
    expect(fill.color).toBe("#FFFFFF");
    expect(halo.mask.localPath).toBe(fill.mask.localPath);
    expect(halo.mask.strokes[0].width).toBeGreaterThan(stroke.mask.strokes[0].width);
    expect(fill.mask.strokes).toBeUndefined();
  });

  it("the badge is the accent tile under a white play glyph", () => {
    expect(find(doc, "badge").color).toBe("#FF0000");
    expect(find(doc, "badge-glyph").color).toBe("#FFFFFF");
    expect(find(doc, "badge-glyph").mask.localPath.match(/[ML] /g)).toHaveLength(3);
  });

  it("motion: every piece animates from its own cue, in pixel literals", () => {
    expect(find(doc, "media").overlay.startAtSec).toBe(0);
    expect(find(doc, "headline-top").overlay.xExpr).toMatch(/\*-\d+$/);
    expect(find(doc, "headline-top").overlay.enable).toBe("gte(t,0.15)");
    expect(find(doc, "headline").overlay.xExpr).toMatch(/\*\d+$/);
    expect(find(doc, "headline").overlay.enable).toBe("gte(t,0.25)");
    expect(find(doc, "badge").overlay.yExpr).toContain("pow(");
    expect(find(doc, "badge").overlay).toEqual(find(doc, "badge-glyph").overlay);
    expect(find(doc, "cta-box").overlay).toEqual(find(doc, "cta").overlay);
    expect(find(doc, "cta").overlay.alpha).toBeDefined();
    const arrows = doc.sources.filter((s: any) => s.editor?.label === "arrow");
    expect(arrows.map((a: any) => a.overlay.startAtSec)).toEqual([1.15, 1.3, 1.45]);
    for (const a of arrows) expect(a.overlay.yExpr).toContain("cos(2*PI*");
    expect(find(doc, "pill").overlay).toEqual(find(doc, "link").overlay);
    expect(find(doc, "pill").overlay.startAtSec).toBe(1.65);
  });
});

describe("buildNewVideoStoryDoc — knobs", () => {
  it("animate off: no overlay anywhere; stats say static", () => {
    const out = build({ animate: false });
    for (const s of out.doc.sources as any[]) expect(s.overlay).toBeUndefined();
    expect(out.stats.animated).toBe(false);
  });

  it("an image screenshot fills the slot, cover from the top, bound to the rect", () => {
    const out = build({ media: "shot.png", animate: false });
    const doc: any = out.doc;
    expect(labelsOf(doc)).not.toContain("media-label");
    const m = find(doc, "media");
    expect(m.type).toBe("media");
    expect(m.mediaType).toBe("image");
    expect(m.assetId).toBe("nvs_media");
    expect(m.placement).toMatchObject({ fit: "cover", focusX: 0.5, focusY: 0 });
    expect(m.playback).toBeUndefined();
    expect(m.audio).toBeUndefined();
    expect(m.editor.binding).toEqual({ propKey: "mediaRegion", kind: "rect" });
    expect(doc.assets.nvs_media).toEqual({ kind: "file", path: "shot.png", mediaType: "image" });
    expect(out.stats).toMatchObject({ animated: false, hasMedia: true, mediaKind: "image" });
    expect(painted(doc, m)).toEqual(out.stats.mediaRect);
  });

  it("a video screenshot loops with audio and makes the doc animated even as a still", () => {
    const out = build({ media: "rec.mp4", animate: false });
    const m = find(out.doc, "media");
    expect(m.mediaType).toBe("video");
    expect(m.playback).toEqual({ loopMode: "loop" });
    expect(m.audio).toEqual({ enabled: true });
    expect(out.stats.animated).toBe(true);
    expect(find(build({ media: "rec.mp4", mediaAudio: false }).doc, "media").audio).toEqual({ enabled: false });
  });

  it("contain fit, focus, corners", () => {
    const m = find(build({ media: "shot.png", mediaFit: "contain", mediaCorner: 0.1 }).doc, "media");
    expect(m.placement).toMatchObject({ fit: "contain" });
    expect(m.placement.focusY).toBeUndefined();
    expect(m.effects.rounding).toEqual({ cornerStyle: "rounded", borderRadius: 0.2, rasterizer: "svg" });
    const f = find(build({ media: "shot.png", mediaFocus: 0.5 }).doc, "media");
    expect(f.placement.focusY).toBe(0.5);
    const pill = find(build({ media: "shot.png", mediaCorner: 0.5 }).doc, "media");
    expect(pill.effects.rounding).toEqual({ cornerStyle: "pill", rasterizer: "svg" });
  });

  it("a URL screenshot becomes a url asset", () => {
    const doc: any = build({ media: "https://cdn.example/shot.png" }).doc;
    expect(doc.assets.nvs_media).toEqual({ kind: "url", url: "https://cdn.example/shot.png", mediaType: "image" });
  });

  it("a drawn screenshot area places the slot exactly there (rescaled from its canvas)", () => {
    const out = build({
      media: "shot.png",
      mediaRegion: { canvas: { w: 540, h: 960 }, regions: [{ x: 50, y: 600, w: 440, h: 300 }] },
    });
    expect(out.warnings).toEqual([]);
    expect(out.stats.mediaRect).toEqual({ x: 100, y: 1200, w: 880, h: 600 });
    expect(painted(out.doc, find(out.doc, "media"))).toEqual({ x: 100, y: 1200, w: 880, h: 600 });
    // The placeholder honours the same rect.
    const empty = build({ mediaRegion: { regions: [{ x: 40, y: 1000, w: 1000, h: 400 }] } });
    expect(empty.stats.mediaRect).toEqual({ x: 40, y: 1000, w: 1000, h: 400 });
  });

  it("a drawn rect outside the canvas warns and falls back to the default slot", () => {
    const out = build({ media: "shot.png", mediaRegion: { regions: [{ x: 5000, y: 5000, w: 10, h: 10 }] } });
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/mediaRegion ignored/);
    expect(out.stats.mediaRect).toEqual({ x: 0, y: Math.round(H * 0.51), w: W, h: H - Math.round(H * 0.51) });
  });

  it("badge image replaces the drawn glyph; badge none drops the slot; accent recolours", () => {
    const img: any = build({ badgeImage: "yt.png" }).doc;
    expect(labelsOf(img)).not.toContain("badge-glyph");
    const b = find(img, "badge");
    expect(b.type).toBe("media");
    expect(b.assetId).toBe("nvs_badge");
    expect(b.placement).toMatchObject({ fit: "contain" });
    expect(img.assets.nvs_badge).toEqual({ kind: "file", path: "yt.png", mediaType: "image" });

    const none: any = build({ badge: "none" }).doc;
    expect(labelsOf(none)).not.toContain("badge");
    expect(none.sources).toHaveLength(16);

    expect(find(build({ accentColor: "#00FF00" }).doc, "badge").color).toBe("#00FF00");
  });

  it("platform presets change copy, glyph and accent; the stage colour is a knob", () => {
    const tw: any = build({ platform: "twitch", backgroundColor: "#111111" }).doc;
    expect(tw.backgroundColor).toBe("#111111");
    expect(find(tw, "badge").color).toBe("#9146FF");
    // "LIVE" over "NOW": both lines present.
    expect(labelsOf(tw).filter((l) => l === "headline-top")).toHaveLength(3);
    const x: any = build({ platform: "x" }).doc;
    expect(labelsOf(x)).not.toContain("badge");
  });

  it("a single-word headline drops the small line", () => {
    const doc: any = build({ headline: "premiere" }).doc;
    expect(labelsOf(doc)).not.toContain("headline-top");
    expect(labelsOf(doc).filter((l) => l === "headline")).toHaveLength(3);
  });

  it("renders at other canvases with every frame bound and inside the canvas", () => {
    for (const [w, h] of [
      [540, 960],
      [1920, 1080],
      [1080, 1080],
      [720, 1280],
      [640, 360],
    ] as Array<[number, number]>) {
      const out = build({ media: "shot.png" }, w, h);
      const doc: any = out.doc;
      expect(isValidM0String(doc.m0)).toBe(true);
      const parsed = parseM0StringComplete(doc.m0, w, h);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.ir.renderFrames.length).toBe(doc.sources.length);
      out.expectations.forEach((exp: any, i: number) => {
        const r = exp.rect;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(w);
        expect(r.y + r.h).toBeLessThanOrEqual(h);
        expect(painted(doc, doc.sources[i])).toEqual(r);
      });
    }
  });

  it("is deterministic", () => {
    const a = build({ media: "shot.png", platform: "tiktok" });
    const b = build({ media: "shot.png", platform: "tiktok" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
