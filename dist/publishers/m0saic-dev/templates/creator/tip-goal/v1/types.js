"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipGoalPropsSchema = void 0;
const template_utils_1 = require("@m0saic/template-utils");
// ── Schema field factories (the beat-hero local convention). ──
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
function fImage(label, description, order = 1) {
    return {
        type: "media",
        required: false,
        description,
        meta: {
            control: { picker: "file", accept: ["image"] },
            ui: { label, order },
        },
    };
}
exports.TipGoalPropsSchema = (0, template_utils_1.definePropsSchema)({
    sourceId: {
        type: "media",
        required: false,
        description: "The video or image the overlay attaches to. Leave empty to render the standalone demo look over the Background color. Default: empty (demo).",
        meta: {
            control: { picker: "file", accept: ["video", "image"] },
            ui: { label: "Video", order: 1, primary: true },
        },
    },
    goalAmount: {
        type: "number",
        required: false,
        description: "The amount that fills the bar completely (and the ' / goal' readout when Show goal is on). Default: 100.",
        meta: {
            constraints: { min: 1, max: 1000000 },
            ui: { label: "Goal", order: 2, primary: true },
        },
    },
    currency: {
        type: "string",
        required: false,
        description: 'Literal prefix before the counter number — any short string ("$", "€", "¥", ""). Default: "$".',
        meta: {
            control: { placeholder: "$" },
            ui: { label: "Currency", order: 3, primary: true },
        },
    },
    startAmount: {
        type: "number",
        required: false,
        description: "Running total already on the board at t=0. Default: 0.",
        meta: {
            constraints: { min: 0, max: 1000000 },
            ui: { label: "Start amount", order: 4 },
        },
    },
    showGoal: fBool("Show goal", 'Append " / <currency><goal>" after the counter (e.g. "$24 / $100"). Default: off.', 5),
    suffix: {
        type: "string",
        required: false,
        description: 'Literal appended right after the number, before any goal readout (e.g. " tips"). Default: empty.',
        meta: { ui: { label: "Suffix", order: 6 } },
    },
    riseSec: fNum("Rise (s)", "Seconds each tip animates from the old total to the new (0 = instant jump). Crowded tips auto-shorten. Default: 0.6.", { min: 0, max: 5, step: 0.05, unit: "s", order: 7 }),
    riseEase: fEnum("Rise easing", ["easeOut", "linear", "smoothstep", "easeInOut"], "Easing of each rise. Default: easeOut.", 8),
    auto: {
        type: "group",
        required: false,
        description: "Seeded tip generator — fabricates a plausible donation stream that reaches the goal. Used when no Tips rows / Schedule are set.",
        meta: { ui: { label: "Auto tips", order: 9, collapsedByDefault: true } },
        fields: {
            seed: fNum("Seed", "Random seed — change it for a different stream. Default: 1.", {
                min: 0,
                max: 9999,
                step: 1,
                order: 1,
            }),
            tipCount: fNum("Tips", "How many tips to fabricate. Default: 12.", {
                min: 1,
                max: 60,
                step: 1,
                order: 2,
            }),
            curve: fEnum("Curve", ["big-finish", "steady", "fast-start"], "Pacing shape: big-finish clusters tips (and bigger amounts) late, fast-start front-loads them, steady spreads them evenly. Default: big-finish.", 3),
            startDelaySec: fNum("Start delay (s)", "Quiet lead-in before the first tip. Default: 1.5.", { min: 0, max: 60, step: 0.5, unit: "s", order: 4 }),
            finishFrac: fNum("Finish at", "Fraction of the clip where the goal lands (0.9 = 90% through). Default: 0.9.", { min: 0.1, max: 1, step: 0.05, order: 5 }),
        },
    },
    tips: {
        type: "json",
        required: false,
        description: "Exact tip list — each row ADDS its amount to the running total at its time (negative = refund). Wins over Auto tips. Default: empty (auto).",
        meta: {
            control: {
                flavor: "objectRows",
                columns: [
                    { key: "atSec", kind: "number", label: "At (s)" },
                    { key: "amount", kind: "number", label: "Amount" },
                ],
            },
            ui: { label: "Tips", order: 10 },
        },
    },
    schedule: {
        type: "json",
        required: false,
        description: "Full control: absolute amount keyframes [{ atSec, amount, ease? }] — the total eases from each key to the next (default linear), holds before the first and after the last; double keys at one time for a hard step. Wins over Tips and Auto. Default: empty.",
        meta: {
            control: { flavor: "jsonModal" },
            ui: { label: "Schedule (JSON)", order: 11, consumer: "agent" },
        },
    },
    bar: {
        type: "group",
        required: false,
        description: "Bar look: placement, size, colors, tip flash, replacement art.",
        meta: { ui: { label: "Bar look", order: 12, collapsedByDefault: true } },
        fields: {
            placement: fEnum("Placement", ["bottom", "top", "center"], "Where the widget band sits on the canvas. Default: bottom.", 1),
            widthFrac: fNum("Width", "Widget width as a fraction of canvas width. Default: 0.94.", { min: 0.2, max: 1, step: 0.01, order: 2 }),
            heightFrac: fNum("Height", "Widget height as a fraction of canvas height. Default: 0.11.", { min: 0.03, max: 0.4, step: 0.01, order: 3 }),
            marginFrac: fNum("Edge margin", "Vertical margin from the canvas edge as a fraction of canvas height. Default: 0.05.", { min: 0, max: 0.4, step: 0.01, order: 4 }),
            rounding: fNum("Rounding", "Corner rounding of track and fill, 0..0.5 (0.5 = pill). Default: 0.5.", { min: 0, max: 0.5, step: 0.05, order: 5 }),
            trackColor: fColor("Track color", "Unfilled bar (supports alpha). Default: #ECECEC.", "#ECECEC", 6),
            fillColor: fColor("Fill color", "The rising fill. Default: #8B5CF6.", "#8B5CF6", 7),
            tipFlash: fBool("Tip flash", "Flash the bar briefly on each tip — the 'donation just landed' cue. Default: on.", 8),
            flashColor: fColor("Flash color", "Tip-flash color (supports alpha). Default: #FFFFFF@0.4.", "#FFFFFF", 9),
            trackImage: fImage("Track image", "Replace the drawn track with an image (stretched to the bar). Default: drawn track.", 10),
            fillImage: fImage("Fill image", "Replace the drawn fill with an image (e.g. gradient art); it slides with the level. Default: drawn fill.", 11),
        },
    },
    label: {
        type: "group",
        required: false,
        description: "Counter look: placement, size, colors.",
        meta: { ui: { label: "Counter look", order: 13, collapsedByDefault: true } },
        fields: {
            placement: fEnum("Placement", ["left", "right", "above", "none"], "Where the counter sits relative to the bar. Default: left.", 1),
            widthFrac: fNum("Zone width", "Counter zone width as a fraction of widget width (left/right placements). Default: 0.16.", { min: 0.06, max: 0.5, step: 0.01, order: 2 }),
            fontScale: fNum("Font scale", "Multiplier on the auto-fit font size. Default: 1.", { min: 0.3, max: 2.5, step: 0.05, order: 3 }),
            color: fColor("Text color", "Counter fill. Default: #FFFFFF.", "#FFFFFF", 4),
            outlineColor: fColor("Outline color", "Counter outline for legibility over footage (supports alpha). Default: black@0.85.", "#000000", 5),
            outlineFrac: fNum("Outline width", "Outline width as a fraction of font size (0 = none). Default: 0.07.", { min: 0, max: 0.25, step: 0.01, order: 6 }),
            bold: fBool("Bold", "Bold counter. Default: on.", 7),
        },
    },
    layoutM0: {
        type: "m0",
        required: false,
        description: "Escape hatch: an m0 layout for the intended canvas resolving to exactly ONE rect — the widget band (wide, w >= 2*h, h >= 20). Overrides the placement preset; exact-pixel Geometry (Agent props) still wins per-field. Default: empty (preset placement).",
        meta: {
            control: { placeholder: "e.g. 5[-,-,-,-,F]" },
            ui: { label: "Layout (m0)", order: 14 },
        },
    },
    backgroundColor: {
        type: "string",
        required: false,
        description: 'Canvas background when no Video is set (standalone/demo). Use "black@0" for a transparent overlay export. Default: "#101014".',
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: "#101014" },
            ui: { label: "Background", order: 15 },
        },
    },
    reduceMotion: {
        type: "boolean",
        required: false,
        description: "Reduce motion: no rising fill, no counting, no flashes — the bar and counter park at the schedule's final amount. Default: off.",
        meta: { ui: { label: "Reduce motion", order: 16 } },
    },
    geometry: {
        type: "json",
        required: false,
        description: "Exact-pixel geometry overrides, merged per-field: { barRect?, labelRect?, fontSizePx? } (canvas px). Wins over Layout (m0) and placement. Default: empty.",
        meta: {
            control: { flavor: "jsonModal" },
            ui: { label: "Geometry (px)", order: 17, consumer: "agent" },
        },
    },
    debugLayout: {
        type: "boolean",
        required: false,
        description: "Dev-only: draw the layout contract (label/bar boxes; counter text fits its slot) instead of the overlay. Default: off.",
        meta: { ui: { label: "Debug layout", order: 18 } },
    },
});
