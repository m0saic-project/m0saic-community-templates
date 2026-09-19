"use strict";
/**
 * Lyric Video — the editor "?" tutorial, on the converged SaaS-page
 * beat design (blur-regions/logo-animate precedent): copy column +
 * window-framed visual, progress rail, one brand accent, single dark
 * look. Five beats track the shipped workflow: song → lyrics →
 * tap pass → correction → beats. Visuals are onboarding-kit mocks of
 * the REAL surfaces (the render face, the tap card, the studio rows).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderLyricVideoTutorial = renderLyricVideoTutorial;
const template_utils_1 = require("@m0saic/template-utils");
const TUTORIAL_FPS = 30;
// SaaS palette — the family's single dark look, brand orange accent.
const P = {
    bg: "#0a0c12",
    surface: "#141926",
    raised: "#1d2433",
    inset: "#10141f",
    border: "#2a3347",
    accent: "#f97316",
    accentSoft: "#fdba74",
    accentDim: "#7c4a12",
    textHi: "#f5f7fa",
    textLo: "#9aa5b5",
    textMute: "#5f6b7d",
    green: "#2f6b4f",
};
// ── SaaS building blocks (blur-regions idiom, trimmed to what we use) ──
function cardTile(color, opts = {}) {
    return (0, template_utils_1.onboardingLeaf)((0, template_utils_1.makeColorTile)(color, {
        effects: {
            rounding: { cornerStyle: "rounded", borderRadius: opts.radius ?? 0.08 },
            ...(opts.stroke
                ? { stroke: { position: "inner", width: 0.004, color: opts.stroke, alpha: 0.9 } }
                : {}),
        },
        ...(opts.atSec != null ? { overlay: { alpha: (0, template_utils_1.fadeInExpr)(opts.atSec, 0.3) } } : {}),
    }));
}
function padded(content, pad = 5) {
    const mid = (0, template_utils_1.onboardingSplit)("col", [pad, 100 - 2 * pad, pad], [null, content, null]);
    return (0, template_utils_1.onboardingSplit)("row", [pad, 100 - 2 * pad, pad], [null, mid, null]);
}
/** App-window shell: rounded card, three-dot title bar, content. */
function windowCard(content) {
    const dot = (c) => (0, template_utils_1.onboardingSplit)("row", [1, 2, 1], [null, cardTile(c, { radius: 0.5 }), null]);
    const titleBar = (0, template_utils_1.onboardingSplit)("col", [10, 9, 5, 9, 5, 9, 440], [null, dot(P.textMute), null, dot(P.textMute), null, dot(P.accent), null]);
    const inner = (0, template_utils_1.onboardingSplit)("row", [8, 1, 89], [titleBar, null, content]);
    return (0, template_utils_1.onboardingOverlay)(cardTile(P.surface, { radius: 0.05, stroke: P.border }), padded(inner, 3));
}
function caption(text, type, color, label, hAlign = "center") {
    return (0, template_utils_1.onboardingLeaf)((0, template_utils_1.onboardingTextSource)({ text, fontSize: type.micro, color, hAlign, label }));
}
/** A horizontal chip bar (the timing lane in miniature). `null` = silence. */
function laneStrip(cells, weights) {
    const lane = (0, template_utils_1.onboardingSplit)("col", weights, cells.map((c) => (c ? cardTile(c.color, { radius: 0.3, atSec: c.atSec }) : null)));
    return (0, template_utils_1.onboardingOverlay)(cardTile(P.inset, { radius: 0.12, stroke: P.border }), padded((0, template_utils_1.onboardingSplit)("row", [1, 2, 1], [null, lane, null]), 2));
}
// ── Beat visuals ──
function songVisual(type) {
    const row = (label, color, at) => (0, template_utils_1.onboardingOverlay)(cardTile(color, { radius: 0.14, atSec: at }), caption(label, type, P.textHi, `song row ${label.slice(0, 10)}`));
    const content = (0, template_utils_1.onboardingSplit)("row", [4, 8, 2, 3, 2, 8, 4], [
        null,
        row("song.mp3  —  3:59", P.raised, 0.1),
        null,
        caption("the render follows", type, P.textMute, "song follows note"),
        null,
        row("render.mp4  —  3:59", P.green, 0.4),
        null,
    ]);
    return windowCard(content);
}
function lyricsVisual(type) {
    const chips = [
        null,
        { color: P.accentDim, atSec: 0.1 },
        { color: P.accentDim, atSec: 0.2 },
        { color: P.accentDim, atSec: 0.3 },
        { color: P.accentDim, atSec: 0.4 },
        { color: P.accentDim, atSec: 0.5 },
        null,
    ];
    const content = (0, template_utils_1.onboardingSplit)("row", [5, 3, 2, 6, 2, 3, 5], [
        null,
        caption("lead-in pad", type, P.textMute, "lyrics leadin", "left"),
        null,
        laneStrip(chips, [2, 3, 3, 3, 3, 3, 2]),
        null,
        caption("untimed lines spread evenly between the pads", type, P.textLo, "lyrics spread note"),
        null,
    ]);
    return windowCard(content);
}
function tapVisual(type) {
    const card = (0, template_utils_1.onboardingOverlay)((0, template_utils_1.onboardingSolid)("#000000"), (0, template_utils_1.onboardingSplit)("row", [3, 2, 2, 4, 2, 2, 3], [
        null,
        caption("line 7 of 32", type, P.textMute, "tap count"),
        null,
        (0, template_utils_1.onboardingLeaf)((0, template_utils_1.onboardingTextSource)({
            text: "press Space on this line",
            fontSize: Math.round(type.headline * 0.55),
            color: "#ffffff",
            hAlign: "center",
            label: "tap current line",
        })),
        null,
        caption("the next line, dimmed", type, P.textMute, "tap next line"),
        null,
    ]));
    const keys = (0, template_utils_1.onboardingGuttered)("col", [
        (0, template_utils_1.onboardingOverlay)(cardTile(P.raised, { radius: 0.2 }), caption("Space · stamp", type, P.textHi, "tap key space")),
        (0, template_utils_1.onboardingOverlay)(cardTile(P.raised, { radius: 0.2 }), caption("B · silent beat", type, P.textHi, "tap key b")),
        (0, template_utils_1.onboardingOverlay)(cardTile(P.raised, { radius: 0.2 }), caption("Backspace · undo", type, P.textHi, "tap key undo")),
    ], 3, 2);
    return windowCard((0, template_utils_1.onboardingSplit)("row", [11, 1, 3], [card, null, keys]));
}
function correctVisual(type) {
    const row = (text, color, at, name) => (0, template_utils_1.onboardingOverlay)(cardTile(color, { radius: 0.16, atSec: at }), caption(text, type, P.textHi, name));
    const content = (0, template_utils_1.onboardingSplit)("row", [2, 4, 1, 4, 1, 4, 2, 5, 2], [
        null,
        row("nudge  <  50 ms  >", P.raised, 0.1, "correct nudge"),
        null,
        row("audition from just before the line", P.raised, 0.25, "correct audition"),
        null,
        row("loop one line", P.raised, 0.4, "correct loop"),
        null,
        row("SHIFT ALL 100 MS EARLIER", P.green, 0.6, "correct shift all"),
        null,
    ]);
    return windowCard(content);
}
function beatsVisual(type) {
    const chips = [
        { color: P.accentDim, atSec: 0.1 },
        null, // the silent beat — deliberately empty lane
        { color: P.accentDim, atSec: 0.3 },
        { color: P.raised, atSec: 0.5 },
    ];
    const content = (0, template_utils_1.onboardingSplit)("row", [4, 6, 2, 3, 3, 4], [
        null,
        laneStrip(chips, [5, 4, 5, 5]),
        null,
        caption("the empty stretch is a silent beat — nothing lingers on screen", type, P.textLo, "beats silence note"),
        caption("the grey chip holds  [Instrumental]  or any text you type", type, P.textLo, "beats labeled note"),
        null,
    ]);
    return windowCard(content);
}
const BEATS = [
    {
        name: "song",
        durationMs: 5000,
        eyebrow: "STEP 1",
        title: "The song is the clock",
        body: "Pick the audio file and the render length follows it, end to end. Force a duration only when you must.",
        detail: "An explicit Duration override always wins — otherwise the track decides.",
        buildVisual: songVisual,
    },
    {
        name: "lyrics",
        durationMs: 5000,
        eyebrow: "STEP 2",
        title: "Lyrics are timed cues",
        body: "Paste one line per lyric. Untimed lines spread evenly between the Lead-in and Tail pads — a watchable first cut with zero timing.",
        detail: "Pasted SRT keeps its timings.",
        buildVisual: lyricsVisual,
    },
    {
        name: "tap",
        durationMs: 5000,
        eyebrow: "STEP 3",
        title: "Tap the timing in one listen",
        body: "Open Edit timing, press T, and tap Space when you hear each line. B ends the current line into a silent beat.",
        detail: "Backspace undoes the last stamp and replays the moment.",
        buildVisual: tapVisual,
    },
    {
        name: "correct",
        durationMs: 5000,
        eyebrow: "STEP 4",
        title: "Correct like a human",
        body: "Tapped a reaction late? Shift every line a touch earlier in one click, then audition, loop, and nudge single lines until it sits right.",
        detail: "Nudge is 50 ms; hold Shift for 250 ms.",
        buildVisual: correctVisual,
    },
    {
        name: "beats",
        durationMs: 5000,
        eyebrow: "STEP 5",
        title: "Beats fill the space between",
        body: "A silent beat blanks the screen for producer tags and instrumentals; a labeled beat holds any text you want. Then render.",
        detail: "The video runs the whole song — beats and all.",
        buildVisual: beatsVisual,
    },
];
// ── Beat page assembly (blur-regions non-clip scaffold) ──
function beatProgress(index, type) {
    // Axis semantics (kit): "col" = side by side, "row" = stacked. The rail
    // is a 5%-height bottom band, so everything in it must split "col" —
    // a "row" here slices the band into sub-20px cells that CULL (the
    // gate-17 floor) and desync m0 slots from doc.sources.
    const dots = (0, template_utils_1.onboardingGuttered)("col", BEATS.map((_, i) => cardTile(i === index ? P.accent : i < index ? P.accentDim : P.border, { radius: 0.5 })), 3, 2);
    const counter = caption(`${index + 1} / ${BEATS.length}`, type, P.textMute, "beat counter", "left");
    return (0, template_utils_1.onboardingSplit)("col", [30, 12, 16, 30, 12], [null, counter, null, dots, null]);
}
function buildBeat(spec, index, canvasW, canvasH) {
    const type = (0, template_utils_1.onboardingTypeRamp)(canvasW, canvasH);
    const stacked = canvasH > canvasW * 0.9;
    const copyWidth = stacked ? canvasW * 0.84 : canvasW * 0.4;
    const visual = spec.buildVisual(type);
    const copy = (0, template_utils_1.onboardingSplit)("row", [3, 4, 15, 20, 3, 6, 5], [
        null,
        (0, template_utils_1.onboardingTextBlock)({ text: spec.eyebrow, fontSize: type.label, color: P.accent, cellWidthPx: copyWidth, hAlign: "left", fadeDelaySec: 0.04, label: "beat eyebrow" }),
        (0, template_utils_1.onboardingTextBlock)({ text: spec.title, fontSize: type.headline, color: P.textHi, cellWidthPx: copyWidth, hAlign: "left", widthFrac: 0.9, fadeDelaySec: 0.08, label: "beat title" }),
        (0, template_utils_1.onboardingTextBlock)({ text: spec.body, fontSize: type.body, color: P.textLo, cellWidthPx: copyWidth, hAlign: "left", widthFrac: 0.91, fadeDelaySec: 0.12, label: "beat body" }),
        null,
        (0, template_utils_1.onboardingTextBlock)({ text: spec.detail, fontSize: type.micro, color: P.accentSoft, cellWidthPx: copyWidth, hAlign: "left", fadeDelaySec: 0.16, label: "beat detail" }),
        null,
    ]);
    const progress = beatProgress(index, type);
    const page = stacked
        ? (0, template_utils_1.onboardingSplit)("row", [5, 33, 3, 47, 3, 4, 5], [null, (0, template_utils_1.onboardingSplit)("col", [7, 86, 7], [null, copy, null]), null, (0, template_utils_1.onboardingSplit)("col", [6, 88, 6], [null, visual, null]), null, progress, null])
        : (0, template_utils_1.onboardingSplit)("row", [7, 83, 2, 5, 3], [null, (0, template_utils_1.onboardingSplit)("col", [5, 34, 4, 51, 6], [null, copy, null, visual, null]), null, progress, null]);
    return {
        kind: "mosaic_document",
        version: 1,
        assets: {},
        size: { width: canvasW, height: canvasH },
        backgroundColor: P.bg,
        m0: page.m0,
        sources: page.sources,
    };
}
/** Build the five-beat walkthrough (scrubbable; 25s). */
function renderLyricVideoTutorial(ctx) {
    const canvasW = ctx.target.width;
    const canvasH = ctx.target.height;
    const steps = BEATS.map((beat, i) => ({
        name: beat.name,
        durationMs: beat.durationMs,
        file: buildBeat(beat, i, canvasW, canvasH),
    }));
    return {
        kind: "mosaic_pipeline",
        version: 1,
        fps: ctx.target.fps ?? TUTORIAL_FPS,
        durationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
        defaultTransition: { type: "cut" },
        backgroundColor: P.bg,
        steps,
    };
}
