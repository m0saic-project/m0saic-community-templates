"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DualSub = exports.DUAL_SUB_TEMPLATE_ID = void 0;
const types_1 = require("@m0saic/types");
const template_utils_1 = require("@m0saic/template-utils");
const cues_1 = require("./cues");
const policy_1 = require("./policy");
const layout_1 = require("./layout");
const tracks_1 = require("./tracks");
const PRESET_NAMES = Object.keys(policy_1.DUAL_SUB_PRESETS);
const propsSchema = (0, template_utils_1.definePropsSchema)({
    sourceId: {
        type: "media",
        required: false,
        description: "Video input. Default: the first probed video input (with subtitle tracks preferred).",
        meta: {
            control: { picker: "file", accept: ["video"] },
            ui: { label: "Video", order: 1, primary: true },
        },
    },
    targetSubsSourceId: {
        type: "media",
        required: false,
        description: "Optional external subtitle file (.srt/.ass) for the TARGET language. Default: the video's embedded tracks.",
        meta: { control: { picker: "file" }, ui: { label: "Target subs file", order: 2 } },
    },
    targetLanguage: {
        type: "string",
        required: false,
        description: "Target-language code for embedded-track selection (e.g. spa, jpn).",
        meta: { control: { placeholder: "auto (track selection)" }, ui: { label: "Target language", order: 1 } },
    },
    targetTrackIndex: {
        type: "number",
        required: false,
        description: "Explicit target track index (overrides language selection).",
        meta: { control: { placeholder: "by language" }, constraints: { min: 0, max: 64 }, ui: { label: "Target track #", order: 2 } },
    },
    targetOffsetMs: {
        type: "number",
        required: false,
        description: "Timing offset applied to target cues (external-file sync).",
        meta: { ui: { label: "Target offset (ms)", order: 3 } },
    },
    nativeSubsSourceId: {
        type: "media",
        required: false,
        description: "Optional external subtitle file (.srt/.ass) for the NATIVE language. Default: the video's embedded tracks.",
        meta: { control: { picker: "file" }, ui: { label: "Native subs file", order: 3 } },
    },
    nativeLanguage: {
        type: "string",
        required: false,
        description: "Native-language code for embedded-track selection (e.g. eng).",
        meta: { control: { placeholder: "auto (track selection)" }, ui: { label: "Native language", order: 4 } },
    },
    nativeTrackIndex: {
        type: "number",
        required: false,
        description: "Explicit native track index (overrides language selection).",
        meta: { control: { placeholder: "by language" }, constraints: { min: 0, max: 64 }, ui: { label: "Native track #", order: 5 } },
    },
    nativeOffsetMs: {
        type: "number",
        required: false,
        description: "Timing offset applied to native cues (external-file sync).",
        meta: { ui: { label: "Native offset (ms)", order: 6 } },
    },
    nativeDelayMs: {
        type: "number",
        required: false,
        description: "Fixed native-reveal delay in ms (overrides the level-derived delay; still capped at 80% of each cue).",
        meta: { control: { placeholder: "policy default" }, constraints: { min: 0, max: 10_000 }, ui: { label: "Native delay (ms)", order: 5 } },
    },
    nativeOpacity: {
        type: "number",
        required: false,
        description: "Native-line opacity override (0–1). Default derives from the support level (+ a boost when overlaid on video).",
        meta: {
            constraints: { min: 0, max: 1 },
            control: { placeholder: "preset default", flavor: "slider", step: 0.05 },
            ui: { label: "Native opacity", order: 7 },
        },
    },
    revealStyle: {
        type: "string",
        required: false,
        description: "How a delayed native line appears: cut (hard), fade (alpha ramp), unblur (blurred from cue start, sharpens at reveal).",
        meta: {
            constraints: { oneOf: ["cut", "fade", "unblur"] },
            ui: { label: "Reveal style", order: 6 },
        },
    },
    preset: {
        type: "string",
        required: false,
        description: "Course level: training-wheels (full dual) → cold-turkey (raw). Sets the support dial.",
        meta: {
            constraints: { oneOf: PRESET_NAMES },
            ui: { label: "Level", order: 1, primary: true },
        },
    },
    support: {
        type: "number",
        required: false,
        description: "The support dial, 0–100 (100 = full native help, 0 = raw). Overrides the preset when set.",
        meta: {
            constraints: { min: 0, max: 100 },
            control: { placeholder: "preset dial", flavor: "slider", step: 5 },
            ui: { label: "Support", order: 2 },
        },
    },
    layout: {
        type: "string",
        required: false,
        description: "stack = subtitles over the picture; bar = letterbox study bar below it.",
        meta: { constraints: { oneOf: ["stack", "bar"] }, ui: { label: "Layout", order: 1 } },
    },
    seed: {
        type: "number",
        required: false,
        description: "Seed for the deterministic native-line omission draw.",
        meta: { ui: { label: "Seed", order: 3 } },
    },
    stripSdh: {
        type: "boolean",
        required: false,
        description: "Strip SDH artifacts (bracketed sound descriptors, ♪ lines, speaker labels).",
        meta: { ui: { label: "Strip SDH", order: 4 } },
    },
    sizeProfile: {
        type: "string",
        required: false,
        description: "Typography floor: tv (larger) or desktop (tighter).",
        meta: { constraints: { oneOf: ["tv", "desktop"] }, ui: { label: "Size profile", order: 2 } },
    },
    clipStartMs: {
        type: "number",
        required: false,
        description: "Source-relative clip start (ms).",
        meta: {
            control: {
                picker: "time-range",
                videoFromProp: "sourceId",
                markersProvider: { kind: "subtitles", videoFromProp: "sourceId" },
            },
            ui: { label: "Clip start", order: 1 },
        },
    },
    clipEndMs: {
        type: "number",
        required: false,
        description: "Source-relative clip end (ms).",
        meta: {
            control: {
                placeholder: "video end",
                picker: "time-range",
                videoFromProp: "sourceId",
                markersProvider: { kind: "subtitles", videoFromProp: "sourceId" },
            },
            ui: { label: "Clip end", order: 2 },
        },
    },
});
const defaultProps = {
    clipStartMs: 0, // explicit == unset (the render clamps `?? 0`)
    preset: "training-wheels",
    layout: "stack",
    revealStyle: "fade",
    seed: 7,
    stripSdh: true,
    sizeProfile: "tv",
    targetOffsetMs: 0,
    nativeOffsetMs: 0,
};
const TARGET_COLOR = "#ffffff";
const NATIVE_COLOR = "#c9c4bd";
const ERROR_STEP_MS = 2000;
const sec = (ms) => (ms / 1000).toFixed(3);
function findMediaEntry(ctx, sourceId, predicate) {
    const entries = Object.entries(ctx.media ?? {});
    if (sourceId) {
        const meta = ctx.media?.[(0, types_1.asAssetId)(sourceId)];
        return meta ? { path: sourceId, meta } : null;
    }
    const withSubs = entries.find(([, m]) => predicate(m) && (m.subtitles?.length ?? 0) > 0);
    const first = withSubs ?? entries.find(([, m]) => predicate(m));
    return first ? { path: first[0], meta: first[1] } : null;
}
const REVEAL_FADE_SEC = 0.18;
/**
 * NEVER hand drawtext a newline: current ffmpeg builds render the LF itself
 * as a tofu box (harfbuzz shaping regression — not fixable here). Each
 * visual line becomes its own single-line layer, stacked from the slot
 * bottom via per-line padding.
 */
function lineLayers(text, vAlign, lineHFrac, overlay) {
    const lines = text.split("\n");
    return lines.map((line, i) => ({
        content: { kind: "literal", text: line },
        placement: {
            hAlign: "center",
            vAlign,
            padding: { x: 0.02, y: 0.02 + (lines.length - 1 - i) * lineHFrac },
        },
        overlay,
    }));
}
function cueLayers(cues, vAlign, 
/** One text line's height as a fraction of the slot height. */
lineHFrac, revealStyle = "cut") {
    const layers = [];
    for (const cue of cues) {
        const delayed = cue.revealMs !== undefined && cue.revealMs > cue.startMs;
        const from = delayed ? cue.revealMs : cue.startMs;
        const overlay = {
            enable: `between(t,${sec(from)},${sec(cue.endMs)})`,
            // fade + unblur reveal with a short alpha ramp (drawtext alpha= expr).
            ...(delayed && revealStyle !== "cut"
                ? { alpha: `min(1,max(0,(t-${sec(from)})/${REVEAL_FADE_SEC}))` }
                : {}),
        };
        layers.push(...lineLayers(cue.text, vAlign, lineHFrac, overlay));
    }
    return layers;
}
/** Blurred pre-reveal phase of delayed cues (revealStyle "unblur"). */
function blurPhaseLayers(cues, vAlign, lineHFrac) {
    const layers = [];
    for (const cue of cues) {
        if (!(cue.revealMs !== undefined && cue.revealMs > cue.startMs))
            continue;
        layers.push(...lineLayers(cue.text, vAlign, lineHFrac, {
            enable: `between(t,${sec(cue.startMs)},${sec(cue.revealMs)})`,
        }));
    }
    return layers;
}
function textSlotSource(args) {
    // borderWidth is a fraction of the SLOT's min side (the tile the source
    // fills), not the frame — target ~2.5px of outline regardless of slot size.
    const borderWidth = Math.min(0.05, 2.5 / Math.max(1, args.slotMinSide));
    const source = {
        type: "text",
        renderMode: { kind: "video" },
        visual: {
            backgroundColor: "none",
            ...(args.opacity !== undefined && args.opacity < 1 ? { opacity: args.opacity } : {}),
        },
        style: {
            fontSize: args.fontSize,
            fontColor: args.fontColor,
            borderColor: "#000000",
            borderWidth,
        },
        layers: args.layers,
        ...(args.blur !== undefined && args.blur > 0 ? { effects: { blur: args.blur } } : {}),
        editor: { owner: "template", label: args.label },
    };
    return source;
}
exports.DUAL_SUB_TEMPLATE_ID = (0, types_1.asTemplateId)("@m0saic-dev/language/dual-sub/v1");
exports.DualSub = {
    id: exports.DUAL_SUB_TEMPLATE_ID,
    label: "Dual Subtitles (Language Learning)",
    version: 1,
    role: "renderable",
    description: "Burns target + native language subtitles with a learning-oriented support dial: de-emphasis, delayed reveal, and seeded omission of the native line. Levels from training-wheels to cold-turkey. Displays your subtitle data as-is — it does not translate or fix it.",
    capabilities: { tier: "core" },
    tags: ["language", "learning", "subtitles", "media", "educators", "creators", "animated", "bilingual", "teacher", "language-learning"],
    propsSchema,
    defaultProps,
    outputHints: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 10_000,
        format: { kind: "video", container: "mp4" },
    },
    render(rawProps, ctx) {
        const props = { ...defaultProps, ...(rawProps ?? {}) };
        const fail = (message) => ({
            name: "dual-sub",
            label: "dual-sub",
            durationMs: ERROR_STEP_MS,
            file: (0, template_utils_1.makeErrorMosaic)(message, {
                title: "dual-sub",
                width: ctx.target.width,
                height: ctx.target.height,
            }),
        });
        const pipeline = (step) => Promise.resolve({ kind: "mosaic_pipeline", version: 1, emit: "multi", steps: [step] });
        const video = findMediaEntry(ctx, props.sourceId, (m) => m.kind === "video");
        if (!video || !(video.meta.width > 0) || !(video.meta.height > 0)) {
            return pipeline(fail("No probed video input. Pass a video via --inputs / sourceId."));
        }
        if (!(video.meta.durationMs != null && video.meta.durationMs > 0)) {
            return pipeline(fail(`Video input has no probed duration: ${video.path}`));
        }
        // Clip window (source-relative) → output timeline.
        const winStart = Math.max(0, props.clipStartMs ?? 0);
        const winEnd = Math.min(video.meta.durationMs, props.clipEndMs ?? video.meta.durationMs);
        if (!(winEnd > winStart))
            return pipeline(fail(`Empty clip window [${winStart}, ${winEnd}]ms.`));
        const durationMs = Math.round(winEnd - winStart);
        // Track resolution: external subtitle file wins over embedded tracks.
        const resolveTracks = (subsSourceId) => {
            if (subsSourceId) {
                const entry = ctx.media?.[(0, types_1.asAssetId)(subsSourceId)];
                return entry?.subtitles;
            }
            return video.meta.subtitles;
        };
        const targetSel = (0, tracks_1.selectLearnTrack)(resolveTracks(props.targetSubsSourceId), {
            trackIndex: props.targetTrackIndex,
            languageCode: props.targetLanguage,
        });
        if (!targetSel) {
            return pipeline(fail("No usable TARGET subtitle track (missing, language miss, or bitmap-only — PGS image subs carry no text; supply an external .srt/.ass file)."));
        }
        const nativeSel = (0, tracks_1.selectLearnTrack)(resolveTracks(props.nativeSubsSourceId), {
            trackIndex: props.nativeTrackIndex,
            languageCode: props.nativeLanguage,
        });
        const support = (0, policy_1.resolveSupport)(props.preset ?? "training-wheels", props.support);
        const policy = (0, policy_1.derivePolicy)(support);
        const sanitize = { stripSdh: props.stripSdh !== false };
        const targetCues = policy.targetVisible
            ? (0, cues_1.prepareCues)(targetSel.track.cues, {
                winStartMs: winStart,
                winEndMs: winEnd,
                offsetMs: props.targetOffsetMs ?? 0,
                sanitize,
            })
            : [];
        const nativeAll = nativeSel
            ? (0, cues_1.prepareCues)(nativeSel.track.cues, {
                winStartMs: winStart,
                winEndMs: winEnd,
                offsetMs: props.nativeOffsetMs ?? 0,
                sanitize,
            })
            : [];
        const nativeShown = (0, policy_1.decideNativeCues)(nativeAll, policy, props.seed ?? 7, props.nativeDelayMs)
            .filter((d) => d.shown)
            .map((d) => ({ ...d.cue, revealMs: d.revealMs }));
        const revealStyle = props.revealStyle ?? "fade";
        const hasDelayedNative = nativeShown.some((c) => c.revealMs > c.startMs);
        const layoutResult = (0, layout_1.buildDualSubLayout)({
            layout: props.layout ?? "stack",
            videoW: video.meta.width,
            videoH: video.meta.height,
            sizeProfile: props.sizeProfile ?? "tv",
            slots: {
                target: targetCues.length > 0,
                native: nativeShown.length > 0,
                nativeBlur: revealStyle === "unblur" && hasDelayedNative,
            },
        });
        const baseAssetId = (0, types_1.asAssetId)((0, template_utils_1.slugifyAssetKeyFromPath)(video.path));
        const assets = {
            [baseAssetId]: { kind: "file", path: video.path, mediaType: "video" },
        };
        const videoSource = {
            type: "media",
            mediaType: "video",
            assetId: baseAssetId,
            placement: { fit: "cover" },
            ...(winStart > 0 || winEnd < video.meta.durationMs
                ? { playback: { clipStartMs: winStart, clipDurationMs: durationMs, loopMode: "cut" } }
                : {}),
            editor: { owner: "template", label: "learn:video" },
        };
        const nativeFontSize = Math.max(12, Math.round(layoutResult.targetFontSize * policy.nativeScale));
        // Explicit override wins; otherwise level-derived, boosted when overlaid
        // on moving video (stack) vs the bar's solid black.
        const nativeOpacity = props.nativeOpacity !== undefined && Number.isFinite(props.nativeOpacity)
            ? Math.min(1, Math.max(0, props.nativeOpacity))
            : (props.layout ?? "stack") === "stack"
                ? Math.min(1, policy.nativeOpacity + 0.18)
                : policy.nativeOpacity;
        const slotSources = {
            video: videoSource,
            target: textSlotSource({
                layers: cueLayers(targetCues, layoutResult.textVAlign.target, Math.round(layoutResult.targetFontSize * 1.3) / layoutResult.rects.target.h),
                fontSize: layoutResult.targetFontSize,
                fontColor: TARGET_COLOR,
                label: "learn:target",
                slotMinSide: Math.min(layoutResult.rects.target.w, layoutResult.rects.target.h),
            }),
            native: textSlotSource({
                layers: cueLayers(nativeShown, layoutResult.textVAlign.native, Math.round(nativeFontSize * 1.3) / layoutResult.rects.native.h, revealStyle),
                fontSize: nativeFontSize,
                fontColor: NATIVE_COLOR,
                opacity: nativeOpacity,
                label: "learn:native",
                slotMinSide: Math.min(layoutResult.rects.native.w, layoutResult.rects.native.h),
            }),
            nativeBlur: textSlotSource({
                layers: blurPhaseLayers(nativeShown, layoutResult.textVAlign.native, Math.round(nativeFontSize * 1.3) / layoutResult.rects.native.h),
                fontSize: nativeFontSize,
                fontColor: NATIVE_COLOR,
                opacity: nativeOpacity,
                label: "learn:native-blur",
                slotMinSide: Math.min(layoutResult.rects.native.w, layoutResult.rects.native.h),
                blur: Math.max(3, Math.round(nativeFontSize * 0.22)),
            }),
        };
        const doc = {
            kind: "mosaic_document",
            version: 1,
            m0: layoutResult.m0,
            fps: ctx.target.fps,
            durationMs,
            size: { width: layoutResult.canvasW, height: layoutResult.canvasH },
            backgroundColor: "#000000",
            assets,
            sources: layoutResult.slotOrder.map((id) => slotSources[id]),
        };
        const format = { kind: "video", container: "mp4" };
        return pipeline({
            name: "dual-sub",
            label: "dual-sub",
            durationMs,
            file: { ...doc, format },
        });
    },
};
