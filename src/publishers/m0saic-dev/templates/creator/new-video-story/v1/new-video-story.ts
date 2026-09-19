import type {
  MosaicEngineContext,
  MosaicOutputFormat,
  MosaicRenderableFile,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import {
  defineMosaicTemplate,
  makeErrorMosaic,
  resolveOutputDurationMs,
  withGeometryContract,
  withLayoutContract,
} from "@m0saic/template-utils";

import { NewVideoStoryPropsSchema, type NewVideoStoryV1Props } from "./types";
import { classifyMedia, resolveNewVideoStory } from "./resolve";
import { buildNewVideoStoryDoc } from "./compose";
import { SETTLED_AT_SEC } from "./motion";

/**
 * New Video Story — the "NEW VIDEO" Instagram story a creator posts when
 * something drops: a sticker headline (white on a black stroke on a white
 * halo) with a platform badge tucked into its corner, a boxed "WATCH FULL
 * VIDEO HERE", three arrows pointing down at a white link pill, and the
 * creator's screenshot of their channel / feed filling the bottom of the
 * story. Pick what you're announcing (YouTube video / Short, TikTok, Reel,
 * Instagram post, Twitch stream, podcast episode, X post) and the preset
 * fills the copy, the badge and the accent; drop the screenshot in and
 * move / resize it in place on the preview.
 *
 * Deterministic: output depends only on props + ctx.target (+ engine media
 * probes). No RNG, no wall-clock; all text is bundled-font glyph outlines,
 * so the same props render the same on every machine. Animated by default
 * (MP4); `animate: false` with an image screenshot authors a PNG still.
 * An explicit host format always wins.
 */

const TEMPLATE_ID = "@m0saic-dev/creator/new-video-story/v1";
// 8 s: the choreography settles by ~2.2 s and the arrows keep the story
// alive after that. A video screenshot with no explicit duration sets the
// length instead (the duration-follow law).
const DEFAULT_DURATION_MS = 8_000;
const DEFAULT_ERROR_WIDTH = 1080;
const DEFAULT_ERROR_HEIGHT = 1920;

const PNG_FORMAT: MosaicOutputFormat = { kind: "image", container: "png" };
const VIDEO_FORMAT: MosaicOutputFormat = { kind: "video", container: "mp4" };

const DESCRIPTION =
  "The 'NEW VIDEO' Instagram story for the day something drops. Pick what you're announcing — a YouTube video or Short, a TikTok, a Reel, an Instagram post, a Twitch stream, a podcast episode, an X post — and the preset writes the sticker headline, the boxed call-to-action, the link-pill text, the badge and the accent colour (every one overridable). Drop in your media — an image or a video, the screenshot of your channel or feed, a clip of the drop: it fills the bottom of the story, and you move or resize it in place on the preview. Animated by default — the headline slides in, the badge drops with a bounce, the arrows cascade and keep bobbing, the link pill pops — or a PNG still with animation off. 1080×1920.";

type MediaProbe = { kind?: string; durationMs?: number };

function probeMedia(ctx: MosaicEngineContext, path: string): MediaProbe | undefined {
  const registry = (ctx as { media?: Record<string, MediaProbe> }).media;
  return registry?.[path];
}

/**
 * Render length — an EXPLICIT ask (CLI --durationMs, Make's Duration field)
 * wins; else the render follows a video screenshot's length; else the host's
 * target, which hosts seed from the 8 s hint.
 */
function resolveDurationMs(ctx: MosaicEngineContext, probe: MediaProbe | undefined): number {
  const natural = probe?.kind === "video" ? probe.durationMs : undefined;
  const d = resolveOutputDurationMs(ctx, {
    ...(typeof natural === "number" && Number.isFinite(natural) && natural > 0 ? { naturalMs: natural } : {}),
  });
  return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.round(d) : DEFAULT_DURATION_MS;
}

function storyError(ctx: MosaicEngineContext, code: string, message: string) {
  const card = makeErrorMosaic(message, {
    width: ctx?.target?.width ?? DEFAULT_ERROR_WIDTH,
    height: ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT,
    title: "New Video Story",
    errorCode: code,
  });
  // The wrapper's timing assertion needs a duration even on the error card
  // (the test ctx may carry none).
  return { ...card, durationMs: card.durationMs ?? DEFAULT_DURATION_MS };
}

export const NewVideoStoryV1 = defineMosaicTemplate<NewVideoStoryV1Props>({
  id: asTemplateId(TEMPLATE_ID),
  label: "New Video Story",
  version: 1,
  description: DESCRIPTION,
  role: "renderable",
  capabilities: { tier: "core" },
  // Facets the gallery reads: `social` = category, `animated` = motion; the
  // rest are the creator vocabulary people search by.
  tags: ["creator", "story", "social", "animated", "instagram", "youtube", "tiktok", "twitch", "shorts", "reels", "podcast", "announcement", "new-video", "youtuber", "streamer", "renderable", "creators"],
  platforms: ["mobile"],
  internal: false,

  outputHints: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationMs: DEFAULT_DURATION_MS,
    posterTimeMs: Math.round(SETTLED_AT_SEC * 1000),
    format: VIDEO_FORMAT,
    note:
      "An Instagram story (9:16, 1080×1920). Any other canvas shows the same top-anchored column with the screenshot slot running to the bottom edge. Animated by default (MP4); Animate off with image media authors a PNG. With video media and no explicit duration, the render follows the video's length.",
  },

  propsSchema: NewVideoStoryPropsSchema,

  defaultProps: {
    platform: "youtube",
    media: "",
    headline: "",
    cta: "",
    linkText: "",
    badge: "auto",
    badgeImage: "",
    accentColor: "",
    backgroundColor: "#000000",
    mediaFit: "cover",
    mediaFocus: 0,
    mediaCorner: 0,
    mediaAudio: true,
    animate: true,
    debugLayout: false,
    debugGeometry: false,
  },

  async render(props: NewVideoStoryV1Props, ctx: MosaicEngineContext): Promise<MosaicRenderableFile> {
    const W = ctx?.target?.width ?? DEFAULT_ERROR_WIDTH;
    const H = ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT;
    const fps = ctx?.target?.fps ?? 30;

    const mediaPath = typeof props.media === "string" ? props.media.trim() : "";
    const probe = mediaPath !== "" ? probeMedia(ctx, mediaPath) : undefined;
    if (probe?.kind === "audio") {
      return storyError(
        ctx,
        "NVS_MEDIA_KIND",
        `Your media must be an image or a video — ${JSON.stringify(mediaPath)} probed as audio.`,
      );
    }
    const badgePath = typeof props.badgeImage === "string" ? props.badgeImage.trim() : "";
    const badgeProbe = badgePath !== "" ? probeMedia(ctx, badgePath) : undefined;
    if (badgeProbe?.kind !== undefined && badgeProbe.kind !== "image") {
      return storyError(
        ctx,
        "NVS_BADGE_KIND",
        `The badge image must be an image — ${JSON.stringify(badgePath)} probed as ${badgeProbe.kind}.`,
      );
    }

    const durationMs = resolveDurationMs(ctx, probe);

    const resolved = resolveNewVideoStory(props);
    if (!resolved.ok) return storyError(ctx, resolved.code, resolved.message);

    const built = buildNewVideoStoryDoc(resolved.cfg, W, H, fps, durationMs, (path) =>
      classifyMedia(path, probeMedia(ctx, path)?.kind),
    );
    if (!built.ok) return storyError(ctx, built.code, built.message);

    // L1 format intent: a still (animation off, no video) is a PNG; anything
    // animated is a video. The host's explicit format (L0) outranks this.
    built.doc.format = built.stats.animated ? VIDEO_FORMAT : PNG_FORMAT;

    // Dev tripwires — EXCLUSIVE, never chained: each debug wrapper REPLACES
    // the doc with its contract wireframe. Geometry wins when both are on.
    if (props.debugGeometry === true) {
      return withGeometryContract(built.doc, ctx, {
        templateId: TEMPLATE_ID,
        expectations: built.expectations,
        debug: true,
      });
    }
    return withLayoutContract(built.doc, ctx, {
      templateId: TEMPLATE_ID,
      constraints: [
        { label: "headline" },
        { label: "cta-box" },
        { label: "pill" },
        { label: "media" },
      ],
      debug: props.debugLayout === true,
    });
  },
});
