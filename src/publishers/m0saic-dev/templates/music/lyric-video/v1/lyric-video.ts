import type {
  MosaicDocument,
  MosaicDocumentPipeline,
  MosaicEngineContext,
  MosaicMediaMetadata,
  MosaicTemplate,
  MosaicTimedCue,
} from "@m0saic/types";
import { asAssetId, asTemplateId } from "@m0saic/types";
import {
  definePropsSchema,
  determineMediaType,
  makeErrorMosaic,
  parseCueTrackValue,
  resolveCueWindows,
  resolveOutputDurationMs,
  type CueWindowVerdict,
} from "@m0saic/template-utils";

import {
  autoTimeLyrics,
  bestEffortWindows,
  buildLyricDocument,
  resolveLyricStyle,
  type LyricWindow,
} from "./plan";
import { renderLyricVideoCover } from "./lyric-video-cover";
import { renderLyricVideoTutorial } from "./lyric-video-tutorial";

/**
 * @m0saic-dev/music/lyric-video/v1 — line-level lyric video.
 *
 * A song + an ordered cue track of lyric lines (`picker: "cue-track"` — timed
 * in Make's Cue Timing Studio, or hand-authored) + an optional background →
 * a rendered lyric video. The output duration FOLLOWS THE SONG (the Q3
 * duration-follow law): an explicit user ask wins, else the probed song
 * length, else the last timed line; the doc authors the result so the
 * engine's slot-length audio cap never truncates the track.
 *
 * Design doc: the internal lyric-video-cue-track notes
 */
export type LyricVideoProps = {
  songId?: string;
  lyrics?: MosaicTimedCue[] | string;
  backgroundId?: string;
  backgroundColor?: string;
  textColor?: string;
  position?: "top" | "middle" | "bottom";
  align?: "left" | "center" | "right";
  textScale?: number;
  revealStyle?: "cut" | "fade";
  leadInMs?: number;
  tailMs?: number;
  karaoke?: "off" | "highlight" | "dot";
  karaokeColor?: string;
  bestEffortTiming?: boolean;
};

export const MAX_LYRIC_CUES = 400;

const propsSchema = definePropsSchema<LyricVideoProps>({
  songId: {
    type: "media",
    required: true,
    description: "The song (audio file) the lyrics are timed against.",
    meta: {
      control: { picker: "file", accept: ["audio"] },
      ui: { label: "Song", order: 1, primary: true },
    },
  },
  lyrics: {
    type: "json",
    required: true,
    description:
      "Ordered lyric lines as timed cues: [{ text, startMs?, endMs? }]. Integer ms on the output " +
      "timeline; a line without startMs is UNTIMED; a line without endMs runs until the next timed " +
      "line starts (the last line runs to the end of the song). When NO line carries a time, lines " +
      "spread evenly across the song between Lead-in and Tail; once any line is timed, untimed " +
      "lines are guidance (time them in the studio).",
    meta: {
      constraints: {
        jsonSchema: {
          type: "array",
          maxItems: MAX_LYRIC_CUES,
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
          mediaFromProp: "songId",
          maxCues: MAX_LYRIC_CUES,
          wordTiming: true,
          // The control is generic (a cue is anything timed); THIS prop
          // speaks lyrics: "No lyrics yet", "12 lines · 8 timed", "Pick a
          // song first…", and the labeled beat reads "[Instrumental]".
          vocabulary: {
            item: "line",
            collection: "lyrics",
            media: "song",
            beatLabel: "[Instrumental]",
          },
        },
      },
      ui: { label: "Lyrics", order: 2, primary: true },
    },
  },
  backgroundId: {
    type: "media",
    required: false,
    description:
      "Optional background image or video (cover-fit; a clip shorter than the song loops).",
    meta: {
      control: { picker: "file", accept: ["video", "image"] },
      ui: { label: "Background", order: 3 },
    },
  },
  backgroundColor: {
    type: "string",
    required: false,
    description: "Backdrop color when no background media is set.",
    meta: {
      constraints: { isColor: true },
      control: { colorPicker: true },
      ui: { label: "Backdrop", order: 4 },
    },
  },
  textColor: {
    type: "string",
    required: false,
    description: "Lyric text color.",
    meta: {
      constraints: { isColor: true },
      control: { colorPicker: true },
      ui: { label: "Text color", order: 5 },
    },
  },
  position: {
    type: "string",
    required: false,
    description: "Vertical placement of the lyric band.",
    meta: {
      constraints: { oneOf: ["top", "middle", "bottom"] },
      ui: { label: "Position", order: 6 },
    },
  },
  align: {
    type: "string",
    required: false,
    description: "Horizontal text alignment inside the band.",
    meta: {
      constraints: { oneOf: ["left", "center", "right"] },
      ui: { label: "Align", order: 7 },
    },
  },
  textScale: {
    type: "number",
    required: false,
    description: "Lyric size multiplier (0.5–2 over the canvas-derived base size).",
    meta: {
      constraints: { min: 0.5, max: 2 },
      control: { flavor: "slider", step: 0.05 },
      ui: { label: "Text size", order: 8 },
    },
  },
  revealStyle: {
    type: "string",
    required: false,
    description: "How each line appears: cut (hard) or fade (short alpha ramp).",
    meta: {
      constraints: { oneOf: ["cut", "fade"] },
      ui: { label: "Reveal", order: 9 },
    },
  },
  leadInMs: {
    type: "number",
    required: false,
    description:
      "Auto-timing pad: hold this many ms of the song's START before the first lyric shows. " +
      "Only applies while no line carries its own time; 0 = lyrics start immediately.",
    meta: {
      constraints: { min: 0 },
      ui: { label: "Lead-in (ms)", order: 10 },
    },
  },
  tailMs: {
    type: "number",
    required: false,
    description:
      "Auto-timing pad: leave this many ms of the song's END after the last lyric. " +
      "Only applies while no line carries its own time; 0 = lyrics run to the end.",
    meta: {
      constraints: { min: 0 },
      ui: { label: "Tail (ms)", order: 11 },
    },
  },
  karaoke: {
    type: "string",
    required: false,
    description:
      "Word-level karaoke rendering for lines with word timing: 'highlight' fills each word " +
      "in the karaoke color for as long as it is sung; 'dot' bounces a dot across the words. " +
      "Lines without word timing render normally.",
    meta: {
      constraints: { oneOf: ["off", "highlight", "dot"] },
      ui: { label: "Karaoke", order: 12 },
    },
  },
  karaokeColor: {
    type: "string",
    required: false,
    description: "Karaoke accent color (the word fill / the dot).",
    meta: {
      constraints: { isColor: true },
      control: { colorPicker: true },
      ui: { label: "Karaoke color", order: 13 },
    },
  },
  bestEffortTiming: {
    type: "boolean",
    required: false,
    description:
      "DEV/DEBUG: never show the timing-guidance card — untimed lines are guessed into the " +
      "gaps between timed neighbors, and (with Karaoke on) missing word timing is synthesized " +
      "per word length. Guesses are rough by design; turn off for real timing work.",
    meta: {
      ui: { label: "Best-effort timing (dev)", order: 14 },
    },
  },
});

const defaultProps: LyricVideoProps = {
  bestEffortTiming: false,
  backgroundColor: "#000000",
  textColor: "#FFFFFF",
  position: "middle",
  align: "center",
  textScale: 1,
  revealStyle: "fade",
  leadInMs: 0,
  tailMs: 0,
  karaoke: "off",
  karaokeColor: "#FFC53D",
};

export const LYRIC_VIDEO_TEMPLATE_ID = asTemplateId("@m0saic-dev/music/lyric-video/v1");

export const LyricVideo: MosaicTemplate<LyricVideoProps> = {
  id: LYRIC_VIDEO_TEMPLATE_ID,
  label: "Lyric Video",
  version: 1,
  role: "renderable",
  description:
    "Paste lyrics, tap them in time to your song, get a lyric video: line-timed text over a color or media background, with the render length following the song.",
  capabilities: { tier: "core" },
  tags: ["media", "music", "lyrics", "audio", "animated", "creators", "musicians", "social", "karaoke", "youtube", "tiktok"],
  propsSchema,
  defaultProps,
  outputHints: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: 10_000,
    format: { kind: "video", container: "mp4" },
  },

  async render(rawProps, ctx) {
    const props: LyricVideoProps = { ...defaultProps, ...(rawProps ?? {}) };

    const fail = (message: string): MosaicDocument =>
      makeErrorMosaic(message, {
        title: "Lyric Video",
        width: ctx.target.width,
        height: ctx.target.height,
      });

    const songPath = typeof props.songId === "string" ? props.songId.trim() : "";
    if (!songPath) {
      return fail("Missing required 'Song' — pick the audio file the lyrics are timed against.");
    }
    const songMeta: MosaicMediaMetadata | undefined = ctx.media?.[asAssetId(songPath)];
    if (!songMeta) {
      return fail(`Song input has no probe metadata: ${songPath}. Pass it via --inputs / the Song picker.`);
    }

    const parsed = parseCueTrackValue(props.lyrics);
    if (!parsed.ok) {
      return fail(`Lyrics did not parse: ${parsed.error}`);
    }
    if (parsed.cues.length === 0) {
      return fail(
        "No lyrics yet — paste your lyrics into the Lyrics field (one line per lyric), then time them in the studio.",
      );
    }
    if (parsed.cues.length > MAX_LYRIC_CUES) {
      return fail(`Too many lyric lines (${parsed.cues.length}; the cap is ${MAX_LYRIC_CUES}).`);
    }

    // Duration follows the song (Q3): explicit user ask > probed song length
    // > last timed line's end > the host-seeded target. Authored onto the doc
    // below so the slot-length audio cap (apad/atrim) never truncates.
    const songDurationMs =
      typeof songMeta.durationMs === "number" && songMeta.durationMs > 0
        ? songMeta.durationMs
        : undefined;
    const lastTimedEndMs = parsed.cues.reduce(
      (acc, c) => Math.max(acc, c.endMs ?? c.startMs ?? 0),
      0,
    );
    const durationMs = resolveOutputDurationMs(ctx, {
      naturalMs: songDurationMs ?? (lastTimedEndMs > 0 ? lastTimedEndMs : undefined),
    });

    // A fully-untimed set auto-spreads evenly across [leadIn, duration - tail]
    // — the zero-input face. The pads are LITERAL user knobs (defaults 0: start
    // immediately, run to the end); no silence detection, no guessing. Any
    // authored startMs switches the set to studio timing, where unresolved
    // lines are guidance below.
    const pad = (v: unknown): number =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
    let windows: LyricWindow[];
    if (!parsed.cues.some((c) => typeof c.startMs === "number")) {
      windows = autoTimeLyrics(
        parsed.cues.map((c) => c.text),
        { durationMs, leadInMs: pad(props.leadInMs), tailMs: pad(props.tailMs) },
      );
    } else if (props.bestEffortTiming === true) {
      // DEV: never block on unresolved timing — guess it (untimed lines
      // spread into the gaps between timed neighbors; inverted mis-taps
      // recovered; word gaps synthesized downstream when karaoke is on).
      windows = bestEffortWindows(parsed.cues, {
        durationMs,
        leadInMs: pad(props.leadInMs),
        tailMs: pad(props.tailMs),
      });
      if (windows.length === 0) {
        return fail(
          `All lyric lines fall outside the ${(durationMs / 1000).toFixed(1)}s render window — clear the duration override or retime the lines.`,
        );
      }
    } else {
      const verdicts = resolveCueWindows(parsed.cues, { durationMs });
      const untimed = verdicts.filter((v) => !v.ok && v.reason === "untimed").length;
      const inverted = verdicts.filter((v) => !v.ok && v.reason === "inverted").length;
      if (untimed > 0 || inverted > 0) {
        const parts: string[] = [];
        if (untimed > 0) {
          parts.push(
            `${untimed} lyric line${untimed === 1 ? "" : "s"} still need${untimed === 1 ? "s" : ""} timing — open Lyrics and run the tap pass (play the song, press Space on each line)`,
          );
        }
        if (inverted > 0) {
          parts.push(
            `${inverted} line${inverted === 1 ? " is" : "s are"} out of order (a later line starts at or before it) — nudge them in the studio`,
          );
        }
        return fail(`${parts.join("; ")}.`);
      }

      // "outside" verdicts (lines beyond a pinned shorter render) are skipped,
      // subtitle-burn's cue-window convention.
      windows = verdicts.filter((v): v is Extract<CueWindowVerdict, { ok: true }> => v.ok);
      if (windows.length === 0) {
        return fail(
          `All lyric lines fall outside the ${(durationMs / 1000).toFixed(1)}s render window — clear the duration override or retime the lines.`,
        );
      }
    }

    const backgroundPath =
      typeof props.backgroundId === "string" && props.backgroundId.trim() !== ""
        ? props.backgroundId.trim()
        : undefined;
    let background: { path: string; mediaType: "video" | "image"; durationMs?: number } | undefined;
    if (backgroundPath) {
      const kind = determineMediaType(backgroundPath, ctx);
      const bgMeta = ctx.media?.[asAssetId(backgroundPath)];
      background = {
        path: backgroundPath,
        mediaType: kind === "image" ? "image" : "video",
        ...(typeof bgMeta?.durationMs === "number" && bgMeta.durationMs > 0
          ? { durationMs: bgMeta.durationMs }
          : {}),
      };
    }

    const style = resolveLyricStyle(props);
    return buildLyricDocument({
      canvasW: ctx.target.width,
      canvasH: ctx.target.height,
      fps: ctx.target.fps,
      durationMs,
      song: { path: songPath, assetMediaType: determineMediaType(songPath, ctx) },
      background,
      windows,
      style,
    });
  },

  // Editor-only first-open cover: the default-state face shown before a
  // song is picked (cover ≠ gallery preview ruling).
  renderCover(_props: LyricVideoProps, ctx: MosaicEngineContext): MosaicDocument {
    return renderLyricVideoCover(ctx);
  },

  // The `?` walkthrough: five 5s pages covering the shipped workflow
  // (song → lyrics/auto-spread → tap pass → correction → beats).
  renderTutorial(_props: LyricVideoProps, ctx: MosaicEngineContext): MosaicDocumentPipeline {
    return renderLyricVideoTutorial(ctx);
  },
};
