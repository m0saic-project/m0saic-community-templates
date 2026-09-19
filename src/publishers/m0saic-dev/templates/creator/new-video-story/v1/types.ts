import type {
  MosaicRegion,
  MosaicRegionsValue,
  MosaicTemplatePropDefinition,
} from "@m0saic/types";
import { definePropsSchema } from "@m0saic/template-utils";

import {
  ANNOUNCE_PLATFORM_IDS,
  ANNOUNCE_PLATFORM_OPTIONS,
  BADGE_GLYPHS,
} from "./platforms";

/**
 * New Video Story props — the "NEW VIDEO" Instagram story a creator posts
 * when something drops. Pick what you're announcing (the platform preset
 * fills the sticker headline, the boxed call-to-action, the link-pill text,
 * the badge and the accent), drop in your media — an image or a video, e.g.
 * the screenshot of your channel — and move or resize it in place on the preview. Every
 * preset string is overridable.
 */
export type NewVideoStoryV1Props = {
  /**
   * What the story announces (see platforms.ts). Fills headline / CTA /
   * link text / badge / accent unless overridden. Default "youtube".
   */
  platform?: string;
  /** Your media — an image or a video (the screenshot of your channel, a clip). Empty = a placeholder slot. */
  media?: string;
  /**
   * WHERE your media goes, as one rect drawn on the preview
   * (`picker: "regions"`). Empty = the default slot (bottom ~49 % of the
   * story, full width). Double-clicking the media opens this.
   */
  mediaRegion?: MosaicRegionsValue | MosaicRegion[] | string;

  /** Sticker headline; the last word becomes the big line. Empty = the platform's. */
  headline?: string;
  /** Boxed call-to-action under the headline. Empty = the platform's. */
  cta?: string;
  /** Link-pill text (the domain your link sticker will carry). Empty = the platform's. */
  linkText?: string;
  /** Badge glyph beside the headline: "auto" = the platform's. Default "auto". */
  badge?: string;
  /**
   * An image (PNG with alpha works best) that REPLACES the drawn badge —
   * e.g. the official platform icon downloaded from its brand resources.
   * Empty = the drawn glyph.
   */
  badgeImage?: string;
  /** Badge / accent colour. Empty = the platform's. */
  accentColor?: string;
  /** Stage colour behind everything. Default "#000000". */
  backgroundColor?: string;

  /** How the media fills its slot. Default "cover". */
  mediaFit?: "cover" | "contain";
  /**
   * Cover-crop anchor, 0 = keep the top (the channel header), 1 = keep the
   * bottom. Only read with `mediaFit: "cover"`. Default 0.
   */
  mediaFocus?: number;
  /** Rounded corners on the media, 0–0.5 of its shorter side. Default 0. */
  mediaCorner?: number;
  /** Keep a video's audio. Default true. */
  mediaAudio?: boolean;

  /** Animate the story (slide-ins, the badge drop, bobbing arrows). Off = a still. Default true. */
  animate?: boolean;

  /** Dev-only layout contract wireframe/assertions. Default false. */
  debugLayout?: boolean;
  /** Dev-only zero-drift geometry contract wireframe. Wins over debugLayout
   *  when both are on (each debug view replaces the doc). Default false. */
  debugGeometry?: boolean;
};

// ── Schema field factories (the drop-calendar / tip-goal local convention). ──

function fEnum(
  label: string,
  values: string[],
  description: string,
  order = 1,
): MosaicTemplatePropDefinition {
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

function fNum(
  label: string,
  description: string,
  opts: { min: number; max: number; step?: number; order?: number },
): MosaicTemplatePropDefinition {
  return {
    type: "number",
    required: false,
    description,
    meta: {
      constraints: { min: opts.min, max: opts.max },
      control: {
        flavor: "slider" as const,
        ...(opts.step !== undefined ? { step: opts.step } : {}),
      },
      ui: { label, order: opts.order ?? 1 },
    },
  };
}

function fBool(label: string, description: string, order = 1): MosaicTemplatePropDefinition {
  return {
    type: "boolean",
    required: false,
    description,
    meta: { ui: { label, order } },
  };
}

function fText(
  label: string,
  description: string,
  placeholder: string,
  order: number,
  primary = false,
): MosaicTemplatePropDefinition {
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

export const NewVideoStoryPropsSchema: Record<
  keyof NewVideoStoryV1Props,
  MosaicTemplatePropDefinition
> = definePropsSchema<NewVideoStoryV1Props>({
  platform: {
    type: "string",
    required: false,
    description:
      "What you're announcing. Each preset fills the sticker headline, the boxed call-to-action, the link-pill text, the badge glyph and the accent colour — YouTube video / Short, TikTok, Instagram Reel / post, Twitch stream, podcast episode, X post, or Custom. Any of those can still be overridden below. The story itself is always 9:16. Default: youtube.",
    meta: {
      constraints: { oneOf: ANNOUNCE_PLATFORM_IDS },
      control: { options: ANNOUNCE_PLATFORM_OPTIONS },
      ui: { label: "Announcing", order: 0, primary: true },
    },
  },
  media: {
    type: "media",
    required: false,
    description:
      "Your media — an image or a video: the screenshot of your channel page or video list, a screen recording, a clip of the drop. Fills the bottom half of the story by default (top edge kept, so a screenshot's header shows); drag it anywhere with Media area. A video plays with its audio and sets the render length when nothing else does. Empty = a placeholder slot.",
    meta: {
      control: { picker: "file", accept: ["image", "video"] },
      ui: { label: "Your media (image, video)", order: 1, primary: true },
    },
  },
  mediaRegion: {
    type: "json",
    required: false,
    description:
      "Draw where your media goes — one rect on the preview. Double-clicking the media opens the same draw session: drag to move, handles to resize, Shift locks the aspect, Delete returns to the default slot. " +
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
  headline: fText(
    "Headline",
    "The sticker headline. The LAST word is the big line: \"NEW VIDEO\" → NEW over VIDEO, \"LIVE NOW\" → LIVE over NOW; one word is a single big line. Always upper-case. Empty = the platform's headline. Double-click either line on the preview to edit.",
    "platform preset",
    3,
    true,
  ),
  cta: fText(
    "Call to action",
    "The boxed line under the headline (\"WATCH FULL VIDEO HERE\"). Upper-cased; shrinks to fit the box. Empty = the platform's.",
    "platform preset",
    4,
  ),
  linkText: fText(
    "Link text",
    "Text in the white link pill — the domain your Instagram link sticker will carry (\"YOUTU.BE\"). Place the real link sticker over the pill when posting. Empty = the platform's.",
    "platform preset",
    5,
  ),
  badge: fEnum(
    "Badge",
    ["auto", ...BADGE_GLYPHS],
    "The glyph beside the headline: play (a red rounded rect + white triangle — the universal video mark), note (music), camera (a photo-app ring), live (a red dot), or none. \"auto\" = the platform's. A Badge image replaces the drawn glyph. Default: auto.",
    6,
  ),
  badgeImage: {
    type: "media",
    required: false,
    description:
      "An image that REPLACES the drawn badge — e.g. the official platform icon downloaded from YouTube / Meta / TikTok brand resources (their guidelines allow using it to point at your own channel). A PNG with transparency works best; it is contain-fitted into the badge slot. Empty = the drawn glyph.",
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
  mediaFit: fEnum(
    "Media fit",
    ["cover", "contain"],
    "cover fills the slot and crops (see Media focus); contain shows the whole image or video letterboxed on the stage colour. Default: cover.",
    10,
  ),
  mediaFocus: fNum(
    "Media focus",
    "Where cover-cropped media is anchored: 0 keeps the top (a screenshot's header), 0.5 the middle, 1 the bottom. Default: 0.",
    { min: 0, max: 1, step: 0.05, order: 11 },
  ),
  mediaCorner: fNum(
    "Media corners",
    "Rounded corners on the media, as a fraction of its shorter side (0.5 = pill). Default: 0.",
    { min: 0, max: 0.5, step: 0.02, order: 12 },
  ),
  mediaAudio: fBool(
    "Media audio",
    "Keep the audio of a video. Default: on.",
    13,
  ),
  animate: fBool(
    "Animate",
    "Slide the headline in, drop the badge, cascade the arrows (they keep bobbing), pop the link pill. Off = a still card — a PNG when the media is an image. Default: on.",
    14,
  ),
  debugLayout: {
    type: "boolean",
    required: false,
    description:
      "Dev-only: draw the layout contract (every element present) as a wireframe over the story. Default: off.",
    meta: { ui: { label: "Debug layout", order: 20 } },
  },
  debugGeometry: {
    type: "boolean",
    required: false,
    description:
      "Dev-only: draw the zero-drift geometry contract (every piece paints its exact rect under inset recovery) as a wireframe. Each debug view replaces the render, so this wins when Debug layout is also on. Default: off.",
    meta: { ui: { label: "Debug geometry", order: 21 } },
  },
});
