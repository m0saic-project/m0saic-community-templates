"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewVideoStoryV1 = void 0;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
const types_2 = require("./types");
const resolve_1 = require("./resolve");
const compose_1 = require("./compose");
const motion_1 = require("./motion");
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
const PNG_FORMAT = { kind: "image", container: "png" };
const VIDEO_FORMAT = { kind: "video", container: "mp4" };
const DESCRIPTION = "The 'NEW VIDEO' Instagram story for the day something drops. Pick what you're announcing — a YouTube video or Short, a TikTok, a Reel, an Instagram post, a Twitch stream, a podcast episode, an X post — and the preset writes the sticker headline, the boxed call-to-action, the link-pill text, the badge and the accent colour (every one overridable). Drop in your media — an image or a video, the screenshot of your channel or feed, a clip of the drop: it fills the bottom of the story, and you move or resize it in place on the preview. Animated by default — the headline slides in, the badge drops with a bounce, the arrows cascade and keep bobbing, the link pill pops — or a PNG still with animation off. 1080×1920.";
function probeMedia(ctx, path) {
    const registry = ctx.media;
    return registry?.[path];
}
/**
 * Render length — an EXPLICIT ask (CLI --durationMs, Make's Duration field)
 * wins; else the render follows a video screenshot's length; else the host's
 * target, which hosts seed from the 8 s hint.
 */
function resolveDurationMs(ctx, probe) {
    const natural = probe?.kind === "video" ? probe.durationMs : undefined;
    const d = (0, template_utils_1.resolveOutputDurationMs)(ctx, {
        ...(typeof natural === "number" && Number.isFinite(natural) && natural > 0 ? { naturalMs: natural } : {}),
    });
    return typeof d === "number" && Number.isFinite(d) && d > 0 ? Math.round(d) : DEFAULT_DURATION_MS;
}
function storyError(ctx, code, message) {
    const card = (0, template_utils_1.makeErrorMosaic)(message, {
        width: ctx?.target?.width ?? DEFAULT_ERROR_WIDTH,
        height: ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT,
        title: "New Video Story",
        errorCode: code,
    });
    // The wrapper's timing assertion needs a duration even on the error card
    // (the test ctx may carry none).
    return { ...card, durationMs: card.durationMs ?? DEFAULT_DURATION_MS };
}
exports.NewVideoStoryV1 = (0, template_utils_1.defineMosaicTemplate)({
    id: (0, types_1.asTemplateId)(TEMPLATE_ID),
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
        posterTimeMs: Math.round(motion_1.SETTLED_AT_SEC * 1000),
        format: VIDEO_FORMAT,
        note: "An Instagram story (9:16, 1080×1920). Any other canvas shows the same top-anchored column with the screenshot slot running to the bottom edge. Animated by default (MP4); Animate off with image media authors a PNG. With video media and no explicit duration, the render follows the video's length.",
    },
    propsSchema: types_2.NewVideoStoryPropsSchema,
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
    async render(props, ctx) {
        const W = ctx?.target?.width ?? DEFAULT_ERROR_WIDTH;
        const H = ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT;
        const fps = ctx?.target?.fps ?? 30;
        const mediaPath = typeof props.media === "string" ? props.media.trim() : "";
        const probe = mediaPath !== "" ? probeMedia(ctx, mediaPath) : undefined;
        if (probe?.kind === "audio") {
            return storyError(ctx, "NVS_MEDIA_KIND", `Your media must be an image or a video — ${JSON.stringify(mediaPath)} probed as audio.`);
        }
        const badgePath = typeof props.badgeImage === "string" ? props.badgeImage.trim() : "";
        const badgeProbe = badgePath !== "" ? probeMedia(ctx, badgePath) : undefined;
        if (badgeProbe?.kind !== undefined && badgeProbe.kind !== "image") {
            return storyError(ctx, "NVS_BADGE_KIND", `The badge image must be an image — ${JSON.stringify(badgePath)} probed as ${badgeProbe.kind}.`);
        }
        const durationMs = resolveDurationMs(ctx, probe);
        const resolved = (0, resolve_1.resolveNewVideoStory)(props);
        if (!resolved.ok)
            return storyError(ctx, resolved.code, resolved.message);
        const built = (0, compose_1.buildNewVideoStoryDoc)(resolved.cfg, W, H, fps, durationMs, (path) => (0, resolve_1.classifyMedia)(path, probeMedia(ctx, path)?.kind));
        if (!built.ok)
            return storyError(ctx, built.code, built.message);
        // L1 format intent: a still (animation off, no video) is a PNG; anything
        // animated is a video. The host's explicit format (L0) outranks this.
        built.doc.format = built.stats.animated ? VIDEO_FORMAT : PNG_FORMAT;
        // Dev tripwires — EXCLUSIVE, never chained: each debug wrapper REPLACES
        // the doc with its contract wireframe. Geometry wins when both are on.
        if (props.debugGeometry === true) {
            return (0, template_utils_1.withGeometryContract)(built.doc, ctx, {
                templateId: TEMPLATE_ID,
                expectations: built.expectations,
                debug: true,
            });
        }
        return (0, template_utils_1.withLayoutContract)(built.doc, ctx, {
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
