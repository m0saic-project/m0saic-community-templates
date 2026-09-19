"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewVideoStoryPropsSchema = void 0;
const template_utils_1 = require("@m0saic/template-utils");
const platforms_1 = require("./platforms");
// ── Schema field factories (the drop-calendar / tip-goal local convention). ──
function fEnum(label, values, description, order = 1) {
    return {
        type: "string",
        required: false,
        description,
        meta: {
            constraints: { oneOf: values },
            control: { options: values.map((v) => ({ value: v, label: v })) },
            ui: { label, order },
        },
    };
}
function fNum(label, description, opts) {
    return {
        type: "number",
        required: false,
        description,
        meta: {
            constraints: { min: opts.min, max: opts.max },
            control: {
                flavor: "slider",
                ...(opts.step !== undefined ? { step: opts.step } : {}),
            },
            ui: { label, order: opts.order ?? 1 },
        },
    };
}
function fBool(label, description, order = 1) {
    return {
        type: "boolean",
        required: false,
        description,
        meta: { ui: { label, order } },
    };
}
function fText(label, description, placeholder, order, primary = false) {
    return {
        type: "string",
        required: false,
        description,
        meta: {
            control: { placeholder },
            ui: { label, order, ...(primary ? { primary: true } : {}) },
        },
    };
}
exports.NewVideoStoryPropsSchema = (0, template_utils_1.definePropsSchema)({
    platform: {
        type: "string",
        required: false,
        description: "What you're announcing. Each preset fills the sticker headline, the boxed call-to-action, the link-pill text, the badge glyph and the accent colour — YouTube video / Short, TikTok, Instagram Reel / post, Twitch stream, podcast episode, X post, or Custom. Any of those can still be overridden below. The story itself is always 9:16. Default: youtube.",
        meta: {
            constraints: { oneOf: platforms_1.ANNOUNCE_PLATFORM_IDS },
            control: { options: platforms_1.ANNOUNCE_PLATFORM_OPTIONS },
            ui: { label: "Announcing", order: 0, primary: true },
        },
    },
    media: {
        type: "media",
        required: false,
        description: "Your media — an image or a video: the screenshot of your channel page or video list, a screen recording, a clip of the drop. Fills the bottom half of the story by default (top edge kept, so a screenshot's header shows); drag it anywhere with Media area. A video plays with its audio and sets the render length when nothing else does. Empty = a placeholder slot.",
        meta: {
            control: { picker: "file", accept: ["image", "video"] },
            ui: { label: "Your media (image, video)", order: 1, primary: true },
        },
    },
    mediaRegion: {
        type: "json",
        required: false,
        description: "Draw where your media goes — one rect on the preview. Double-clicking the media opens the same draw session: drag to move, handles to resize, Shift locks the aspect, Delete returns to the default slot. " +
            'Hand-authored JSON takes { "canvas": { "w", "h" }, "regions": [{ "x", "y", "w", "h" }] } in integer px (omit canvas for px in the render canvas). Empty = the default slot.',
        meta: {
            constraints: {
                jsonSchema: {
                    type: "object",
                    properties: {
                        canvas: {
                            type: "object",
                            required: ["w", "h"],
                            properties: { w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } },
                        },
                        regions: {
                            type: "array",
                            maxItems: 1,
                            items: {
                                type: "object",
                                required: ["x", "y", "w", "h"],
                                properties: {
                                    kind: { type: "string", enum: ["rect"] },
                                    x: { type: "integer", minimum: 0 },
                                    y: { type: "integer", minimum: 0 },
                                    w: { type: "integer", minimum: 1 },
                                    h: { type: "integer", minimum: 1 },
                                },
                            },
                        },
                    },
                },
            },
            control: { picker: "regions", regions: { max: 1, shapes: ["rect"] } },
            ui: { label: "Media area", order: 2 },
        },
    },
    headline: fText("Headline", "The sticker headline. The LAST word is the big line: \"NEW VIDEO\" → NEW over VIDEO, \"LIVE NOW\" → LIVE over NOW; one word is a single big line. Always upper-case. Empty = the platform's headline. Double-click either line on the preview to edit.", "platform preset", 3, true),
    cta: fText("Call to action", "The boxed line under the headline (\"WATCH FULL VIDEO HERE\"). Upper-cased; shrinks to fit the box. Empty = the platform's.", "platform preset", 4),
    linkText: fText("Link text", "Text in the white link pill — the domain your Instagram link sticker will carry (\"YOUTU.BE\"). Place the real link sticker over the pill when posting. Empty = the platform's.", "platform preset", 5),
    badge: fEnum("Badge", ["auto", ...platforms_1.BADGE_GLYPHS], "The glyph beside the headline: play (a red rounded rect + white triangle — the universal video mark), note (music), camera (a photo-app ring), live (a red dot), or none. \"auto\" = the platform's. A Badge image replaces the drawn glyph. Default: auto.", 6),
    badgeImage: {
        type: "media",
        required: false,
        description: "An image that REPLACES the drawn badge — e.g. the official platform icon downloaded from YouTube / Meta / TikTok brand resources (their guidelines allow using it to point at your own channel). A PNG with transparency works best; it is contain-fitted into the badge slot. Empty = the drawn glyph.",
        meta: {
            control: { picker: "file", accept: ["image"] },
            ui: { label: "Badge image", order: 7 },
        },
    },
    accentColor: {
        type: "string",
        required: false,
        description: "Badge / accent colour. Empty = the platform's (YouTube red, TikTok pink, Twitch purple …).",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#FF0000", placeholder: "platform colour" },
            ui: { label: "Accent", order: 8 },
        },
    },
    backgroundColor: {
        type: "string",
        required: false,
        description: "Stage colour behind everything. Default: #000000.",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#000000" },
            ui: { label: "Background", order: 9 },
        },
    },
    mediaFit: fEnum("Media fit", ["cover", "contain"], "cover fills the slot and crops (see Media focus); contain shows the whole image or video letterboxed on the stage colour. Default: cover.", 10),
    mediaFocus: fNum("Media focus", "Where cover-cropped media is anchored: 0 keeps the top (a screenshot's header), 0.5 the middle, 1 the bottom. Default: 0.", { min: 0, max: 1, step: 0.05, order: 11 }),
    mediaCorner: fNum("Media corners", "Rounded corners on the media, as a fraction of its shorter side (0.5 = pill). Default: 0.", { min: 0, max: 0.5, step: 0.02, order: 12 }),
    mediaAudio: fBool("Media audio", "Keep the audio of a video. Default: on.", 13),
    animate: fBool("Animate", "Slide the headline in, drop the badge, cascade the arrows (they keep bobbing), pop the link pill. Off = a still card — a PNG when the media is an image. Default: on.", 14),
    debugLayout: {
        type: "boolean",
        required: false,
        description: "Dev-only: draw the layout contract (every element present) as a wireframe over the story. Default: off.",
        meta: { ui: { label: "Debug layout", order: 20 } },
    },
    debugGeometry: {
        type: "boolean",
        required: false,
        description: "Dev-only: draw the zero-drift geometry contract (every piece paints its exact rect under inset recovery) as a wireframe. Each debug view replaces the render, so this wins when Debug layout is also on. Default: off.",
        meta: { ui: { label: "Debug geometry", order: 21 } },
    },
});
