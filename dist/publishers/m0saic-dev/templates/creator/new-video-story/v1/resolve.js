"use strict";
/**
 * Resolve — raw props → one canonical, validated config. The platform preset
 * fills every copy / badge / accent field the user left empty; the drawn
 * screenshot rect is parsed defensively (a bad value warns and falls back to
 * the default slot). Nothing here hard-fails: an announcement card must
 * always land, so unknown enum values fall back to their defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyMedia = classifyMedia;
exports.resolveColor = resolveColor;
exports.resolveNewVideoStory = resolveNewVideoStory;
const template_utils_1 = require("@m0saic/template-utils");
const platforms_1 = require("./platforms");
const VIDEO_EXT = /\.(mp4|mov|mkv|webm|m4v|avi|mpg|mpeg|ts|m2ts|wmv|flv|3gp|ogv)$/i;
/** Media kind from the engine probe, else the file extension. */
function classifyMedia(path, probeKind) {
    if (probeKind === "video")
        return "video";
    if (probeKind === "image")
        return "image";
    return VIDEO_EXT.test(path.split("?")[0] ?? path) ? "video" : "image";
}
const str = (v) => (typeof v === "string" ? v.trim() : "");
/** A blank / cleared colour knob falls back (bare `??` keeps ""). */
function resolveColor(v, fallback) {
    const s = str(v);
    return s === "" ? fallback : s;
}
function clamp(v, lo, hi, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}
function resolveNewVideoStory(props) {
    const warnings = [];
    const platform = (0, platforms_1.resolveAnnouncePlatform)(props.platform);
    // ── Copy: the user's text, else the preset's. Always upper-cased — the
    // sticker look is all caps and the glyph atlas has no lowercase design.
    const headline = str(props.headline) || platform.headline;
    const { top, main } = (0, platforms_1.splitHeadline)(headline);
    if (main === "") {
        // Unreachable through the schema (the preset always has a word), kept
        // as the fail-fast for a hand-authored preset table.
        return { ok: false, code: "NVS_HEADLINE_EMPTY", message: "The headline resolved to no words." };
    }
    const cta = (str(props.cta) || platform.cta).toUpperCase();
    const linkText = (str(props.linkText) || platform.linkText).toUpperCase();
    // ── Badge ──
    const badgeRaw = str(props.badge);
    let badge;
    if (badgeRaw === "" || badgeRaw === "auto")
        badge = platform.badge;
    else if ((0, platforms_1.isBadgeGlyph)(badgeRaw))
        badge = badgeRaw;
    else {
        warnings.push(`badge ${JSON.stringify(badgeRaw)} unknown; using the platform's`);
        badge = platform.badge;
    }
    // ── Screenshot area (drawn rect escape hatch) ──
    // A bad value must not kill the render: it warns and falls back to the
    // default slot. Only the FIRST rect counts (the picker caps at one).
    let mediaRegion;
    if (props.mediaRegion !== undefined && props.mediaRegion !== null && props.mediaRegion !== "") {
        const parsed = (0, template_utils_1.parseRegionsValue)(props.mediaRegion);
        if (!parsed.ok) {
            warnings.push(`mediaRegion ignored: ${parsed.error}`);
        }
        else if (parsed.regions.length > 0) {
            mediaRegion = {
                ...(parsed.canvas ? { canvas: parsed.canvas } : {}),
                regions: [parsed.regions[0]],
            };
        }
    }
    const mediaFit = props.mediaFit === "contain" ? "contain" : "cover";
    return {
        ok: true,
        warnings,
        cfg: {
            platform,
            media: str(props.media),
            ...(mediaRegion !== undefined ? { mediaRegion } : {}),
            headlineTop: top,
            headlineMain: main,
            cta,
            linkText,
            badge,
            badgeImage: str(props.badgeImage),
            accent: resolveColor(props.accentColor, platform.accent),
            background: resolveColor(props.backgroundColor, "#000000"),
            mediaFit,
            mediaFocus: clamp(props.mediaFocus, 0, 1, 0),
            mediaCorner: clamp(props.mediaCorner, 0, 0.5, 0),
            mediaAudio: props.mediaAudio !== false,
            animate: props.animate !== false,
        },
    };
}
