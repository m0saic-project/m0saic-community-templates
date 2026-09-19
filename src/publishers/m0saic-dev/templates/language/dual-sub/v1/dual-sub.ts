import type {
  MosaicAssetManifest,
  MosaicDocument,
  MosaicEngineContext,
  MosaicMediaMetadata,
  MosaicOutputFormat,
  MosaicPipelineStep,
  MosaicSource,
  MosaicSubtitleCue,
  MosaicTemplate,
  MosaicTextLayer,
  MosaicTextSource,
} from "@m0saic/types";
import { asAssetId, asTemplateId } from "@m0saic/types";
import {
  definePropsSchema,
  makeErrorMosaic,
  slugifyAssetKeyFromPath,
} from "@m0saic/template-utils";

import { prepareCues } from "./cues";
import {
  DUAL_SUB_PRESETS,
  decideNativeCues,
  derivePolicy,
  resolveSupport,
  type DualSubPreset,
} from "./policy";
import { buildDualSubLayout, type DualSubLayoutKind, type DualSubSizeProfile } from "./layout";
import { selectLearnTrack } from "./tracks";

/**
 * @m0saic-dev/language/dual-sub/v1 — the language-learning dual-subtitle renderer.
 *
 * One video + a target-language and a native-language subtitle track (embedded
 * text tracks, or external .srt/.ass files passed as additional inputs) → one
 * learning render. The `support` dial (100 = full native help → 0 = raw)
 * drives coverage, reveal delay, and de-emphasis; presets are named levels on
 * the dial. Deterministic: seeded omission, no clocks, no randomness.
 *
 * Design doc: .ai/proposed-plans/language-learning-template-design.md
 */
export type DualSubProps = {
  sourceId?: string;
  targetSubsSourceId?: string;
  targetLanguage?: string;
  targetTrackIndex?: number;
  targetOffsetMs?: number;
  nativeSubsSourceId?: string;
  nativeLanguage?: string;
  nativeTrackIndex?: number;
  nativeOffsetMs?: number;
  nativeDelayMs?: number;
  nativeOpacity?: number;
  revealStyle?: "cut" | "fade" | "unblur";
  preset?: DualSubPreset;
  support?: number;
  layout?: DualSubLayoutKind;
  seed?: number;
  stripSdh?: boolean;
  sizeProfile?: DualSubSizeProfile;
  clipStartMs?: number;
  clipEndMs?: number;
};

const PRESET_NAMES = Object.keys(DUAL_SUB_PRESETS);

const propsSchema = definePropsSchema<DualSubProps>({
  sourceId: {
    type: "media",
    required: false,
    description:
      "Video input. Default: the first probed video input (with subtitle tracks preferred).",
    meta: {
      control: { picker: "file", accept: ["video"] },
      ui: { label: "Video", order: 1, primary: true },
    },
  },
  targetSubsSourceId: {
    type: "media",
    required: false,
    description:
      "Optional external subtitle file (.srt/.ass) for the TARGET language. Default: the video's embedded tracks.",
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
    description:
      "Optional external subtitle file (.srt/.ass) for the NATIVE language. Default: the video's embedded tracks.",
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
    description:
      "Fixed native-reveal delay in ms (overrides the level-derived delay; still capped at 80% of each cue).",
    meta: { control: { placeholder: "policy default" }, constraints: { min: 0, max: 10_000 }, ui: { label: "Native delay (ms)", order: 5 } },
  },
  nativeOpacity: {
    type: "number",
    required: false,
    description:
      "Native-line opacity override (0–1). Default derives from the support level (+ a boost when overlaid on video).",
    meta: {
      constraints: { min: 0, max: 1 },
      control: { placeholder: "preset default", flavor: "slider", step: 0.05 },
      ui: { label: "Native opacity", order: 7 },
    },
  },
  revealStyle: {
    type: "string",
    required: false,
    description:
      "How a delayed native line appears: cut (hard), fade (alpha ramp), unblur (blurred from cue start, sharpens at reveal).",
    meta: {
      constraints: { oneOf: ["cut", "fade", "unblur"] },
      ui: { label: "Reveal style", order: 6 },
    },
  },
  preset: {
    type: "string",
    required: false,
    description:
      "Course level: training-wheels (full dual) → cold-turkey (raw). Sets the support dial.",
    meta: {
      constraints: { oneOf: PRESET_NAMES },
      ui: { label: "Level", order: 1, primary: true },
    },
  },
  support: {
    type: "number",
    required: false,
    description:
      "The support dial, 0–100 (100 = full native help, 0 = raw). Overrides the preset when set.",
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

const defaultProps: DualSubProps = {
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

const sec = (ms: number) => (ms / 1000).toFixed(3);

function findMediaEntry(
  ctx: MosaicEngineContext,
  sourceId: string | undefined,
  predicate: (meta: MosaicMediaMetadata) => boolean,
): { path: string; meta: MosaicMediaMetadata } | null {
  const entries = Object.entries(ctx.media ?? {});
  if (sourceId) {
    const meta = ctx.media?.[asAssetId(sourceId)];
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
function lineLayers(
  text: string,
  vAlign: "top" | "middle" | "bottom",
  lineHFrac: number,
  overlay: MosaicTextLayer["overlay"],
): MosaicTextLayer[] {
  const lines = text.split("\n");
  return lines.map((line, i) => ({
    content: { kind: "literal" as const, text: line },
    placement: {
      hAlign: "center" as const,
      vAlign,
      padding: { x: 0.02, y: 0.02 + (lines.length - 1 - i) * lineHFrac },
    },
    overlay,
  }));
}

function cueLayers(
  cues: readonly (MosaicSubtitleCue & { revealMs?: number })[],
  vAlign: "top" | "middle" | "bottom",
  /** One text line's height as a fraction of the slot height. */
  lineHFrac: number,
  revealStyle: "cut" | "fade" | "unblur" = "cut",
): MosaicTextLayer[] {
  const layers: MosaicTextLayer[] = [];
  for (const cue of cues) {
    const delayed = cue.revealMs !== undefined && cue.revealMs > cue.startMs;
    const from = delayed ? cue.revealMs! : cue.startMs;
    const overlay: MosaicTextLayer["overlay"] = {
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
function blurPhaseLayers(
  cues: readonly (MosaicSubtitleCue & { revealMs?: number })[],
  vAlign: "top" | "middle" | "bottom",
  lineHFrac: number,
): MosaicTextLayer[] {
  const layers: MosaicTextLayer[] = [];
  for (const cue of cues) {
    if (!(cue.revealMs !== undefined && cue.revealMs > cue.startMs)) continue;
    layers.push(
      ...lineLayers(cue.text, vAlign, lineHFrac, {
        enable: `between(t,${sec(cue.startMs)},${sec(cue.revealMs)})`,
      }),
    );
  }
  return layers;
}

function textSlotSource(args: {
  layers: MosaicTextLayer[];
  fontSize: number;
  fontColor: string;
  opacity?: number;
  label: string;
  slotMinSide: number;
  /** Source-level gaussian blur sigma (the unblur twin slot). */
  blur?: number;
}): MosaicTextSource {
  // borderWidth is a fraction of the SLOT's min side (the tile the source
  // fills), not the frame — target ~2.5px of outline regardless of slot size.
  const borderWidth = Math.min(0.05, 2.5 / Math.max(1, args.slotMinSide));
  const source: MosaicTextSource = {
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
  } as MosaicTextSource;
  return source;
}

export const DUAL_SUB_TEMPLATE_ID = asTemplateId("@m0saic-dev/language/dual-sub/v1");

export const DualSub: MosaicTemplate<DualSubProps> = {
  id: DUAL_SUB_TEMPLATE_ID,
  label: "Dual Subtitles (Language Learning)",
  version: 1,
  role: "renderable",
  description:
    "Burns target + native language subtitles with a learning-oriented support dial: de-emphasis, delayed reveal, and seeded omission of the native line. Levels from training-wheels to cold-turkey. Displays your subtitle data as-is — it does not translate or fix it.",
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
    const props: DualSubProps = { ...defaultProps, ...(rawProps ?? {}) };

    const fail = (message: string): MosaicPipelineStep => ({
      name: "dual-sub",
      label: "dual-sub",
      durationMs: ERROR_STEP_MS,
      file: makeErrorMosaic(message, {
        title: "dual-sub",
        width: ctx.target.width,
        height: ctx.target.height,
      }),
    });

    const pipeline = (step: MosaicPipelineStep) =>
      Promise.resolve({ kind: "mosaic_pipeline" as const, version: 1 as const, emit: "multi" as const, steps: [step] });

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
    if (!(winEnd > winStart)) return pipeline(fail(`Empty clip window [${winStart}, ${winEnd}]ms.`));
    const durationMs = Math.round(winEnd - winStart);

    // Track resolution: external subtitle file wins over embedded tracks.
    const resolveTracks = (subsSourceId: string | undefined) => {
      if (subsSourceId) {
        const entry = ctx.media?.[asAssetId(subsSourceId)];
        return entry?.subtitles;
      }
      return video.meta.subtitles;
    };

    const targetSel = selectLearnTrack(resolveTracks(props.targetSubsSourceId), {
      trackIndex: props.targetTrackIndex,
      languageCode: props.targetLanguage,
    });
    if (!targetSel) {
      return pipeline(
        fail(
          "No usable TARGET subtitle track (missing, language miss, or bitmap-only — PGS image subs carry no text; supply an external .srt/.ass file).",
        ),
      );
    }

    const nativeSel = selectLearnTrack(resolveTracks(props.nativeSubsSourceId), {
      trackIndex: props.nativeTrackIndex,
      languageCode: props.nativeLanguage,
    });

    const support = resolveSupport(props.preset ?? "training-wheels", props.support);
    const policy = derivePolicy(support);
    const sanitize = { stripSdh: props.stripSdh !== false };

    const targetCues = policy.targetVisible
      ? prepareCues(targetSel.track.cues, {
          winStartMs: winStart,
          winEndMs: winEnd,
          offsetMs: props.targetOffsetMs ?? 0,
          sanitize,
        })
      : [];

    const nativeAll = nativeSel
      ? prepareCues(nativeSel.track.cues, {
          winStartMs: winStart,
          winEndMs: winEnd,
          offsetMs: props.nativeOffsetMs ?? 0,
          sanitize,
        })
      : [];
    const nativeShown = decideNativeCues(nativeAll, policy, props.seed ?? 7, props.nativeDelayMs)
      .filter((d) => d.shown)
      .map((d) => ({ ...d.cue, revealMs: d.revealMs }));

    const revealStyle = props.revealStyle ?? "fade";
    const hasDelayedNative = nativeShown.some((c) => c.revealMs > c.startMs);
    const layoutResult = buildDualSubLayout({
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

    const baseAssetId = asAssetId(slugifyAssetKeyFromPath(video.path));
    const assets: MosaicAssetManifest = {
      [baseAssetId]: { kind: "file", path: video.path, mediaType: "video" },
    } as MosaicAssetManifest;

    const videoSource: MosaicSource = {
      type: "media",
      mediaType: "video",
      assetId: baseAssetId,
      placement: { fit: "cover" },
      ...(winStart > 0 || winEnd < video.meta.durationMs
        ? { playback: { clipStartMs: winStart, clipDurationMs: durationMs, loopMode: "cut" } }
        : {}),
      editor: { owner: "template", label: "learn:video" },
    } as MosaicSource;

    const nativeFontSize = Math.max(12, Math.round(layoutResult.targetFontSize * policy.nativeScale));
    // Explicit override wins; otherwise level-derived, boosted when overlaid
    // on moving video (stack) vs the bar's solid black.
    const nativeOpacity =
      props.nativeOpacity !== undefined && Number.isFinite(props.nativeOpacity)
        ? Math.min(1, Math.max(0, props.nativeOpacity))
        : (props.layout ?? "stack") === "stack"
          ? Math.min(1, policy.nativeOpacity + 0.18)
          : policy.nativeOpacity;
    const slotSources: Record<string, MosaicSource> = {
      video: videoSource,
      target: textSlotSource({
        layers: cueLayers(
          targetCues,
          layoutResult.textVAlign.target,
          Math.round(layoutResult.targetFontSize * 1.3) / layoutResult.rects.target.h,
        ),
        fontSize: layoutResult.targetFontSize,
        fontColor: TARGET_COLOR,
        label: "learn:target",
        slotMinSide: Math.min(layoutResult.rects.target.w, layoutResult.rects.target.h),
      }),
      native: textSlotSource({
        layers: cueLayers(
          nativeShown,
          layoutResult.textVAlign.native,
          Math.round(nativeFontSize * 1.3) / layoutResult.rects.native.h,
          revealStyle,
        ),
        fontSize: nativeFontSize,
        fontColor: NATIVE_COLOR,
        opacity: nativeOpacity,
        label: "learn:native",
        slotMinSide: Math.min(layoutResult.rects.native.w, layoutResult.rects.native.h),
      }),
      nativeBlur: textSlotSource({
        layers: blurPhaseLayers(
          nativeShown,
          layoutResult.textVAlign.native,
          Math.round(nativeFontSize * 1.3) / layoutResult.rects.native.h,
        ),
        fontSize: nativeFontSize,
        fontColor: NATIVE_COLOR,
        opacity: nativeOpacity,
        label: "learn:native-blur",
        slotMinSide: Math.min(layoutResult.rects.native.w, layoutResult.rects.native.h),
        blur: Math.max(3, Math.round(nativeFontSize * 0.22)),
      }),
    };

    const doc: MosaicDocument = {
      kind: "mosaic_document",
      version: 1,
      m0: layoutResult.m0,
      fps: ctx.target.fps,
      durationMs,
      size: { width: layoutResult.canvasW, height: layoutResult.canvasH },
      backgroundColor: "#000000",
      assets,
      sources: layoutResult.slotOrder.map((id) => slotSources[id]),
    } as unknown as MosaicDocument;

    const format: MosaicOutputFormat = { kind: "video", container: "mp4" };
    return pipeline({
      name: "dual-sub",
      label: "dual-sub",
      durationMs,
      file: { ...doc, format },
    });
  },
};

