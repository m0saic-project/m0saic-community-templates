"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropCalendarPropsSchema = exports.MAX_CUES = void 0;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
const facecamReel_1 = require("./facecamReel");
const platforms_1 = require("./platforms");
const themes_1 = require("./themes");
/** Cue cap — one highlight (and possibly a spotlight) per cue. */
exports.MAX_CUES = 31;
// ── Schema field factories (the beat-hero/tip-goal local convention). ──
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
                ...(opts.slider === false ? {} : { flavor: "slider" }),
                ...(opts.step !== undefined ? { step: opts.step } : {}),
                ...(opts.unit !== undefined ? { unit: opts.unit } : {}),
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
function fWeekday(label, order) {
    return {
        type: "string",
        required: false,
        description: `Branded header label for ${label} (e.g. "Stream ${label}"). Empty = the plain weekday name.`,
        meta: {
            control: { placeholder: `plain "${label}"` },
            ui: { label, order },
        },
    };
}
function fColor(label, description, defaultColor, order = 1) {
    return {
        type: "string",
        required: false,
        description,
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor },
            ui: { label, order },
        },
    };
}
exports.DropCalendarPropsSchema = (0, template_utils_1.definePropsSchema)({
    platform: {
        type: "string",
        required: false,
        description: "Where this is going. Picks the canvas — YouTube 1920×1080, Shorts / TikTok / Reels / Stories 1080×1920, Instagram post 1080×1080 or 4:5 1080×1350, Twitch 1920×1080, X 1600×900 — and keeps the calendar inside that platform's safe area, clear of the top/bottom chrome and the Shorts / TikTok / Reels action rail. Portrait and square canvases move the drop titles into a list under the grid. \"Follow the canvas\" uses whatever size the host asks for. An explicit -w/-h on the CLI overrides the platform's canvas; the safe area still applies. Default: youtube.",
        meta: {
            constraints: { oneOf: platforms_1.CREATOR_PLATFORM_IDS },
            control: { options: platforms_1.CREATOR_PLATFORM_OPTIONS },
            ui: { label: "Platform", order: 0, primary: true },
        },
    },
    month: {
        type: "number",
        required: false,
        description: "Month to render, 1-12 (1 = January). The grid, leading/trailing days, and row count all follow. Default: 10.",
        meta: {
            constraints: { min: 1, max: 12 },
            control: { step: 1 },
            ui: { label: "Month", order: 1, primary: true },
        },
    },
    year: {
        type: "number",
        required: false,
        description: "Year to render (Gregorian). Default: 2026.",
        meta: {
            constraints: { min: 1900, max: 2200 },
            control: { step: 1 },
            ui: { label: "Year", order: 2, primary: true },
        },
    },
    days: {
        type: "json",
        required: false,
        description: "Drop rows — one per upload, stream or release day: { day, title?, teaser? }. `teaser` is a 1-based slot in the Teaser media list; leave it 0/empty to auto-fill teasers in day order. A row with no teaser renders its title in the accent style. Canvas edits: double-click any date to add or edit its drop; clearing Day removes the row.",
        meta: {
            constraints: {
                jsonSchema: {
                    type: "array",
                    maxItems: 31,
                    items: {
                        type: "object",
                        required: ["day"],
                        properties: {
                            day: { type: "integer", minimum: 1, maximum: 31 },
                            title: { type: "string" },
                            teaser: { type: "integer", minimum: 0 },
                        },
                    },
                },
            },
            control: {
                flavor: "objectRows",
                columns: [
                    { key: "day", kind: "number", label: "Day" },
                    { key: "title", kind: "text", label: "Title", placeholder: "Upload, stream or release" },
                    { key: "teaser", kind: "number", label: "Teaser #", placeholder: "auto" },
                ],
            },
            ui: { label: "Drops", order: 3, primary: true },
        },
    },
    teasers: {
        type: "media[]",
        required: false,
        description: "Teaser images/videos for drop days, assigned by the Drops rows' Teaser # (or auto, in day order). Videos loop silently in their cells.",
        meta: {
            control: { picker: "file", accept: ["image", "video"] },
            ui: { label: "Teaser media", order: 4, primary: true },
        },
    },
    weekdays: {
        type: "group",
        required: false,
        description: "Branded weekday headers — a label here replaces that column's weekday name in the accent style ('New Music Friday', 'Stream Saturday'). Empty keeps the plain name. Double-clicking a header cell on the canvas edits the same field.",
        meta: { ui: { label: "Branded weekdays", order: 5, collapsedByDefault: true } },
        fields: {
            sunday: fWeekday("Sunday", 1),
            monday: fWeekday("Monday", 2),
            tuesday: fWeekday("Tuesday", 3),
            wednesday: fWeekday("Wednesday", 4),
            thursday: fWeekday("Thursday", 5),
            friday: fWeekday("Friday", 6),
            saturday: fWeekday("Saturday", 7),
        },
    },
    facecam: {
        type: "media",
        required: false,
        description: "Facecam video (a portrait phone clip works best). When set, the layout goes side-by-side: facecam beside (or above, on tall canvases) the calendar, and its audio carries the render. Use Facecam clips to render only part of it. Default: empty (calendar only).",
        meta: {
            control: { picker: "file", accept: ["video"] },
            ui: { label: "Facecam", order: 6, primary: true },
        },
    },
    facecamSlot: fBool("Facecam slot", "Show the facecam area with a stand-in while no facecam is set — the layout goes side-by-side and the slot is a drop target on the canvas: drag your clip onto it. Off = calendar only until a facecam is set.", 6),
    facecamClips: {
        type: "json",
        required: false,
        description: "Facecam clips — the region(s) of the facecam you actually want, as [{ startMs, endMs, label? }] in milliseconds from the start of the file. Scrub the video and drag a range: ONE clip trims the facecam to that moment; TWO OR MORE play back-to-back as a reel, joined by the Clip transition. With no explicit render duration, the picked clips set the length. Talk-track cues stay stamped against the FULL facecam — a cue inside a picked clip follows it onto the cut, a cue in footage you dropped is skipped. Empty = the whole video.",
        meta: {
            constraints: {
                jsonSchema: {
                    type: "array",
                    maxItems: facecamReel_1.MAX_FACECAM_CLIPS,
                    items: {
                        type: "object",
                        required: ["startMs", "endMs"],
                        properties: {
                            startMs: { type: "integer", minimum: 0 },
                            endMs: { type: "integer", minimum: 1 },
                            label: { type: "string" },
                        },
                    },
                },
            },
            control: { picker: "time-ranges", videoFromProp: "facecam" },
            ui: { label: "Facecam clips", order: 7, primary: true },
        },
    },
    cues: {
        type: "json",
        required: false,
        description: 'Talk track — one cue per moment you mention a drop: [{ text, startMs?, endMs? }]. `text` names the day ("13" or "day 13 teaser"). While a cue is live its day is ring-highlighted, and (with Spotlight on) its teaser superimposes over the calendar. Time the cues in the studio against the FULL Facecam file — Facecam clips carry them onto the cut, and a cue in footage you dropped is skipped. An untimed cue is skipped.',
        meta: {
            constraints: {
                jsonSchema: {
                    type: "array",
                    maxItems: exports.MAX_CUES,
                    items: {
                        type: "object",
                        required: ["text"],
                        properties: {
                            text: { type: "string", minLength: 1 },
                            startMs: { type: "integer", minimum: 0 },
                            endMs: { type: "integer", minimum: 0 },
                        },
                    },
                },
            },
            control: {
                picker: "cue-track",
                cueTrack: {
                    mediaFromProp: "facecam",
                    maxCues: exports.MAX_CUES,
                    vocabulary: {
                        item: "day call-out",
                        items: "day call-outs",
                        collection: "talk track",
                        media: "facecam video",
                        pasteHint: "One day per line — the day number you talk about (e.g. 13).",
                    },
                },
            },
            ui: { label: "Talk track", order: 8 },
        },
    },
    safeArea: fBool("Respect platform safe area", "Keep the calendar inside the platform's safe area — clear of the top bar, the bottom caption area and the Shorts / TikTok / Reels action rail. Turn it off to use the whole canvas. Default: on.", 10),
    showChrome: fBool("Mock platform chrome", "Draws where the platform's own UI sits — the top bar, the bottom caption area and the Shorts / TikTok / Reels action rail — as translucent stand-ins over the render, so you can check nothing important hides under it. A preview aid: turn it off before posting. Does nothing on platforms without chrome or with the safe area off.", 10),
    facecamCorner: fEnum("Facecam corner", ["top-left", "top-right", "bottom-left", "bottom-right"], "On portrait (TikTok / Shorts / Reels / Stories) the calendar is the video and the facecam sits in this corner as a picture-in-picture, inside the platform's safe area and clear of its action rail. Landscape and square keep the side-by-side layout. Default: top-left.", 9),
    facecamSize: fNum("Facecam size", "Facecam width on portrait canvases, as a fraction of the canvas width. Default: 0.34.", { min: 0.2, max: 0.5, step: 0.02, order: 9 }),
    facecamStrokePx: fNum("Facecam frame", "Thickness of the thin frame around the facecam, in px at the render size. 0 = no frame. Default: 2.", { min: 0, max: 24, step: 1, unit: "px", order: 9 }),
    facecamStrokeColor: {
        type: "string",
        required: false,
        description: "Colour of the facecam frame. Empty = the theme's frame colour (muted lavender on studio, off-white on classic).",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#C4B5FD", placeholder: "theme frame" },
            ui: { label: "Facecam frame colour", order: 9 },
        },
    },
    facecamRegion: {
        type: "json",
        required: false,
        description: "Draw where the facecam goes — one rect on the preview. Overrides the automatic placement (beside the calendar on landscape, a corner on portrait): the facecam becomes exactly that rect, on any platform, and the calendar lays out as if there were no facecam, so you can move and resize it out of the way of the month. " +
            'Hand-authored JSON takes { "canvas": { "w", "h" }, "regions": [{ "x", "y", "w", "h" }] } in integer px (omit canvas for px in the render canvas). Empty = automatic placement.',
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
            ui: { label: "Facecam area", order: 9 },
        },
    },
    facecamTransition: {
        type: "group",
        required: false,
        description: "How consecutive Facecam clips join. Only read when two or more clips are picked.",
        meta: { ui: { label: "Clip transition", order: 9, collapsedByDefault: true } },
        fields: {
            style: fEnum("Style", ["cut", ...types_1.MOSAIC_XFADE_MODES], 'Hard "cut", or one of the engine\'s xfade kernels — "fade" (cross-dissolve), "fadeblack", "dissolve", "wipeleft", "slideup", "circleopen", … Default: fade.', 1),
            durationSec: fNum("Length", "Transition overlap between clips, seconds. Clamped to the shorter of the two clips it joins. Default: 0.4.", { min: 0.05, max: 3, step: 0.05, unit: "s", order: 2 }),
        },
    },
    weekStart: fEnum("Week starts on", ["sunday", "monday"], "First column of the week. Default: sunday.", 10),
    theme: fEnum("Theme", themes_1.CALENDAR_THEME_NAMES, "Named look: studio (dark stage, violet accent — the default), classic print calendar, dark noir, or a holiday skin (valentine, easter, halloween, thanksgiving, christmas). Default: studio.", 11),
    accentColor: {
        type: "string",
        required: false,
        description: "Accent override — special weekdays, drop titles, and highlights. Empty = the theme's accent.",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#8B5CF6", placeholder: "theme accent" },
            ui: { label: "Accent", order: 12 },
        },
    },
    backgroundColor: {
        type: "string",
        required: false,
        description: "Canvas background behind the card. Empty = the theme's surface color.",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#0B0B10", placeholder: "theme surface" },
            ui: { label: "Background", order: 13 },
        },
    },
    fontFamily: {
        type: "string",
        required: false,
        description: "Font family. Roboto and JetBrains Mono are bundled and render identically on every machine; any other name (a serif such as Palatino Linotype or Times New Roman suits the print look) resolves from the system at render time. Default: Roboto.",
        meta: {
            control: { placeholder: "Roboto" },
            ui: { label: "Font", order: 14 },
        },
    },
    holdSec: fNum("Highlight hold (s)", "How long the last (or an open-ended) cue's highlight holds when no end time and no next cue bounds it. Default: 4.", { min: 0.5, max: 30, step: 0.5, unit: "s", order: 15 }),
    spotlight: {
        type: "group",
        required: false,
        description: "Cue spotlight — while a cue is live, superimpose that day's teaser large over the calendar.",
        meta: { ui: { label: "Spotlight", order: 16, collapsedByDefault: true } },
        fields: {
            enabled: fBool("Spotlight", "Superimpose the cued day's teaser over the calendar while the cue is live. Default: on.", 1),
            sizeFrac: fNum("Size", "Spotlight size as a fraction of the table's smaller dimension. Default: 0.62.", { min: 0.3, max: 0.95, step: 0.01, order: 2 }),
            dim: fBool("Dim behind", "Dim the calendar behind the spotlight. Default: on.", 3),
            delaySec: fNum("Zoom delay", "Seconds after a cue starts before the spotlight zooms in — the ring highlights the day first, then the teaser takes the stage. Default: 1.", { min: 0, max: 10, step: 0.1, unit: "s", order: 4 }),
        },
    },
    look: {
        type: "group",
        required: false,
        description: "Cell look: media fit, titles, day numbers, adjacent-month dimming.",
        meta: { ui: { label: "Cell look", order: 17, collapsedByDefault: true } },
        fields: {
            cellMediaFit: fEnum("Media fit", ["cover", "contain"], "How teaser media fills a day cell. Default: cover.", 1),
            showTitles: fBool("Titles", "Show drop titles in (and over) day cells. Default: on.", 2),
            showDayNumbers: fBool("Day numbers", "Show day numbers. Default: on.", 3),
            dimAdjacent: fBool("Dim adjacent days", "Dim the leading/trailing days that belong to the previous/next month. Default: on.", 4),
        },
    },
    facecamAudio: fBool("Facecam audio", "Keep the facecam's voice audio on the render. Default: on.", 18),
    muteTeasers: fBool("Mute teasers", "Mute teaser videos playing in day cells (so the facecam voice carries). Default: on.", 19),
    debugLayout: {
        type: "boolean",
        required: false,
        description: "Dev-only: draw the layout contract (masthead text fits its band, sheet + table present) as a wireframe over the calendar. Default: off.",
        meta: { ui: { label: "Debug layout", order: 21 } },
    },
    debugGeometry: {
        type: "boolean",
        required: false,
        description: "Dev-only: draw the zero-drift geometry contract (every piece paints its exact rect under inset recovery) as a wireframe. Each debug view replaces the render, so this wins when Debug layout is also on. Default: off.",
        meta: { ui: { label: "Debug geometry", order: 22 } },
    },
});
