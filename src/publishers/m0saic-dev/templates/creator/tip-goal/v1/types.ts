import type { MosaicTemplatePropDefinition } from "@m0saic/types";
import { definePropsSchema } from "@m0saic/template-utils";

/**
 * Tip Goal props — a streamer-style donation/tip progress bar attachable to
 * any video: a rounded track fills toward a goal while a currency counter
 * ticks up. The GENERATOR owns the timeline — the amount rises exactly when
 * the schedule says it does, so the overlay can seed the "donations are
 * already coming in" look on pre-cut footage, or mirror a real tracker.
 *
 * Canonical timing is an absolute amount timeline ("anchors"): the seeded
 * auto generator and the human tips rows both AUTHOR that anchor list; the
 * agent `schedule` prop writes it directly. Precedence:
 * schedule > tips > auto.
 */

export type RiseEase = "linear" | "easeOut" | "smoothstep" | "easeInOut";
export type TipGoalCurve = "steady" | "big-finish" | "fast-start";
export type TipGoalBarPlacement = "bottom" | "top" | "center";
export type TipGoalLabelPlacement = "left" | "right" | "above" | "none";

/** One human tip row: a DELTA added to the running total at `atSec`. */
export type TipGoalTip = {
  atSec: number;
  /** Amount added (negative = refund). */
  amount: number;
};

/**
 * One agent schedule key: the ABSOLUTE running total at `atSec`. The value
 * eases from each key to the next (`ease` shapes the segment leaving the
 * key; default linear), holds before the first and after the last — so
 * steps are authored by doubling keys at the same time.
 */
export type TipGoalAnchor = {
  atSec: number;
  amount: number;
  ease?: RiseEase;
};

export type TipGoalAuto = {
  /** Seed for the tip generator (mulberry32). Default 1. */
  seed?: number;
  /** How many tips to fabricate. Default 12. */
  tipCount?: number;
  /** Pacing shape: steady, cluster-late (big-finish), or cluster-early. */
  curve?: TipGoalCurve;
  /** Quiet lead-in before the first tip, seconds. Default 1.5. */
  startDelaySec?: number;
  /** Fraction of the clip where the goal lands. Default 0.9. */
  finishFrac?: number;
};

export type TipGoalBar = {
  placement?: TipGoalBarPlacement;
  /** Widget width as a fraction of canvas width. Default 0.94. */
  widthFrac?: number;
  /** Widget height as a fraction of canvas height. Default 0.11. */
  heightFrac?: number;
  /** Vertical edge margin as a fraction of canvas height. Default 0.05. */
  marginFrac?: number;
  /** Corner rounding, 0..0.5 (0.5 = pill). Default 0.5. */
  rounding?: number;
  trackColor?: string;
  fillColor?: string;
  /** Replace the drawn track with an image (stretched cover). */
  trackImage?: string;
  /** Replace the drawn fill with an image (e.g. gradient art); it slides. */
  fillImage?: string;
  /** Flash the bar briefly on each tip. Default true. */
  tipFlash?: boolean;
  /** Flash color (supports alpha). Default #FFFFFF@0.4. */
  flashColor?: string;
};

export type TipGoalLabel = {
  placement?: TipGoalLabelPlacement;
  /** Label zone width as a fraction of widget width (left/right). Default 0.16. */
  widthFrac?: number;
  /** Multiplier on the auto-fit font size. Default 1. */
  fontScale?: number;
  color?: string;
  outlineColor?: string;
  /** Outline width as a fraction of font size (0 = none). Default 0.07. */
  outlineFrac?: number;
  /** Bold counter. Default true. */
  bold?: boolean;
};

/** Agent exact-pixel geometry overrides (output-canvas px), merged per-field. */
export type TipGoalGeometryOverride = {
  barRect?: { x: number; y: number; w: number; h: number };
  labelRect?: { x: number; y: number; w: number; h: number };
  fontSizePx?: number;
};

export type TipGoalV1Props = {
  /** The video/image the overlay attaches to. Empty → standalone demo. */
  sourceId?: string;
  /** Canvas background when no source is set; alpha-0 → transparent overlay. */
  backgroundColor?: string;
  reduceMotion?: boolean;

  /** Amount that fills the bar completely. Default 100. */
  goalAmount?: number;
  /** Running total at t=0. Default 0. */
  startAmount?: number;
  /** Literal prefix before the number. Default "$". */
  currency?: string;
  /** Literal appended after the number. Default "". */
  suffix?: string;
  /** Append " / <currency><goal>" after the counter. Default false. */
  showGoal?: boolean;

  /** Seconds each tip animates from the old total to the new. Default 0.6. */
  riseSec?: number;
  /** Easing of each rise. Default "easeOut". */
  riseEase?: RiseEase;

  auto?: TipGoalAuto;
  /** Human tip rows (deltas). Wins over Auto. */
  tips?: TipGoalTip[];
  /** Agent absolute amount keyframes. Wins over Tips and Auto. */
  schedule?: TipGoalAnchor[];

  bar?: TipGoalBar;
  label?: TipGoalLabel;

  /**
   * ESCAPE HATCH: an m0 layout for the intended canvas resolving to exactly
   * ONE rect — the widget band (wide, w >= 2h). Overrides the placement
   * preset; the label/bar split still happens inside it.
   */
  layoutM0?: string;
  /** Agent per-field pixel overrides; wins over layoutM0 + presets. */
  geometry?: TipGoalGeometryOverride;

  /** Dev-only layout contract: draw the contract wireframe + assert the
   *  counter fits its slot. Default false. */
  debugLayout?: boolean;
};

// ── Schema field factories (the beat-hero local convention). ──

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
  opts: {
    min: number;
    max: number;
    step?: number;
    unit?: "s" | "px";
    slider?: boolean;
    order?: number;
  },
): MosaicTemplatePropDefinition {
  return {
    type: "number",
    required: false,
    description,
    meta: {
      constraints: { min: opts.min, max: opts.max },
      control: {
        ...(opts.slider === false ? {} : { flavor: "slider" as const }),
        ...(opts.step !== undefined ? { step: opts.step } : {}),
        ...(opts.unit !== undefined ? { unit: opts.unit } : {}),
      },
      ui: { label, order: opts.order ?? 1 },
    },
  };
}

function fBool(
  label: string,
  description: string,
  order = 1,
): MosaicTemplatePropDefinition {
  return {
    type: "boolean",
    required: false,
    description,
    meta: { ui: { label, order } },
  };
}

function fColor(
  label: string,
  description: string,
  defaultColor: string,
  order = 1,
): MosaicTemplatePropDefinition {
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

function fImage(
  label: string,
  description: string,
  order = 1,
): MosaicTemplatePropDefinition {
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

export const TipGoalPropsSchema: Record<
  keyof TipGoalV1Props,
  MosaicTemplatePropDefinition
> = definePropsSchema<TipGoalV1Props>({
  sourceId: {
    type: "media",
    required: false,
    description:
      "The video or image the overlay attaches to. Leave empty to render the standalone demo look over the Background color. Default: empty (demo).",
    meta: {
      control: { picker: "file", accept: ["video", "image"] },
      ui: { label: "Video", order: 1, primary: true },
    },
  },
  goalAmount: {
    type: "number",
    required: false,
    description:
      "The amount that fills the bar completely (and the ' / goal' readout when Show goal is on). Default: 100.",
    meta: {
      constraints: { min: 1, max: 1000000 },
      ui: { label: "Goal", order: 2, primary: true },
    },
  },
  currency: {
    type: "string",
    required: false,
    description:
      'Literal prefix before the counter number — any short string ("$", "€", "¥", ""). Default: "$".',
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
  showGoal: fBool(
    "Show goal",
    'Append " / <currency><goal>" after the counter (e.g. "$24 / $100"). Default: off.',
    5,
  ),
  suffix: {
    type: "string",
    required: false,
    description:
      'Literal appended right after the number, before any goal readout (e.g. " tips"). Default: empty.',
    meta: { ui: { label: "Suffix", order: 6 } },
  },
  riseSec: fNum(
    "Rise (s)",
    "Seconds each tip animates from the old total to the new (0 = instant jump). Crowded tips auto-shorten. Default: 0.6.",
    { min: 0, max: 5, step: 0.05, unit: "s", order: 7 },
  ),
  riseEase: fEnum(
    "Rise easing",
    ["easeOut", "linear", "smoothstep", "easeInOut"],
    "Easing of each rise. Default: easeOut.",
    8,
  ),
  auto: {
    type: "group",
    required: false,
    description:
      "Seeded tip generator — fabricates a plausible donation stream that reaches the goal. Used when no Tips rows / Schedule are set.",
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
      curve: fEnum(
        "Curve",
        ["big-finish", "steady", "fast-start"],
        "Pacing shape: big-finish clusters tips (and bigger amounts) late, fast-start front-loads them, steady spreads them evenly. Default: big-finish.",
        3,
      ),
      startDelaySec: fNum(
        "Start delay (s)",
        "Quiet lead-in before the first tip. Default: 1.5.",
        { min: 0, max: 60, step: 0.5, unit: "s", order: 4 },
      ),
      finishFrac: fNum(
        "Finish at",
        "Fraction of the clip where the goal lands (0.9 = 90% through). Default: 0.9.",
        { min: 0.1, max: 1, step: 0.05, order: 5 },
      ),
    },
  },
  tips: {
    type: "json",
    required: false,
    description:
      "Exact tip list — each row ADDS its amount to the running total at its time (negative = refund). Wins over Auto tips. Default: empty (auto).",
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
    description:
      "Full control: absolute amount keyframes [{ atSec, amount, ease? }] — the total eases from each key to the next (default linear), holds before the first and after the last; double keys at one time for a hard step. Wins over Tips and Auto. Default: empty.",
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
      placement: fEnum(
        "Placement",
        ["bottom", "top", "center"],
        "Where the widget band sits on the canvas. Default: bottom.",
        1,
      ),
      widthFrac: fNum(
        "Width",
        "Widget width as a fraction of canvas width. Default: 0.94.",
        { min: 0.2, max: 1, step: 0.01, order: 2 },
      ),
      heightFrac: fNum(
        "Height",
        "Widget height as a fraction of canvas height. Default: 0.11.",
        { min: 0.03, max: 0.4, step: 0.01, order: 3 },
      ),
      marginFrac: fNum(
        "Edge margin",
        "Vertical margin from the canvas edge as a fraction of canvas height. Default: 0.05.",
        { min: 0, max: 0.4, step: 0.01, order: 4 },
      ),
      rounding: fNum(
        "Rounding",
        "Corner rounding of track and fill, 0..0.5 (0.5 = pill). Default: 0.5.",
        { min: 0, max: 0.5, step: 0.05, order: 5 },
      ),
      trackColor: fColor(
        "Track color",
        "Unfilled bar (supports alpha). Default: #ECECEC.",
        "#ECECEC",
        6,
      ),
      fillColor: fColor("Fill color", "The rising fill. Default: #8B5CF6.", "#8B5CF6", 7),
      tipFlash: fBool(
        "Tip flash",
        "Flash the bar briefly on each tip — the 'donation just landed' cue. Default: on.",
        8,
      ),
      flashColor: fColor(
        "Flash color",
        "Tip-flash color (supports alpha). Default: #FFFFFF@0.4.",
        "#FFFFFF",
        9,
      ),
      trackImage: fImage(
        "Track image",
        "Replace the drawn track with an image (stretched to the bar). Default: drawn track.",
        10,
      ),
      fillImage: fImage(
        "Fill image",
        "Replace the drawn fill with an image (e.g. gradient art); it slides with the level. Default: drawn fill.",
        11,
      ),
    },
  },
  label: {
    type: "group",
    required: false,
    description: "Counter look: placement, size, colors.",
    meta: { ui: { label: "Counter look", order: 13, collapsedByDefault: true } },
    fields: {
      placement: fEnum(
        "Placement",
        ["left", "right", "above", "none"],
        "Where the counter sits relative to the bar. Default: left.",
        1,
      ),
      widthFrac: fNum(
        "Zone width",
        "Counter zone width as a fraction of widget width (left/right placements). Default: 0.16.",
        { min: 0.06, max: 0.5, step: 0.01, order: 2 },
      ),
      fontScale: fNum(
        "Font scale",
        "Multiplier on the auto-fit font size. Default: 1.",
        { min: 0.3, max: 2.5, step: 0.05, order: 3 },
      ),
      color: fColor("Text color", "Counter fill. Default: #FFFFFF.", "#FFFFFF", 4),
      outlineColor: fColor(
        "Outline color",
        "Counter outline for legibility over footage (supports alpha). Default: black@0.85.",
        "#000000",
        5,
      ),
      outlineFrac: fNum(
        "Outline width",
        "Outline width as a fraction of font size (0 = none). Default: 0.07.",
        { min: 0, max: 0.25, step: 0.01, order: 6 },
      ),
      bold: fBool("Bold", "Bold counter. Default: on.", 7),
    },
  },
  layoutM0: {
    type: "m0",
    required: false,
    description:
      "Escape hatch: an m0 layout for the intended canvas resolving to exactly ONE rect — the widget band (wide, w >= 2*h, h >= 20). Overrides the placement preset; exact-pixel Geometry (Agent props) still wins per-field. Default: empty (preset placement).",
    meta: {
      control: { placeholder: "e.g. 5[-,-,-,-,F]" },
      ui: { label: "Layout (m0)", order: 14 },
    },
  },
  backgroundColor: {
    type: "string",
    required: false,
    description:
      'Canvas background when no Video is set (standalone/demo). Use "black@0" for a transparent overlay export. Default: "#101014".',
    meta: {
      constraints: { isColor: true },
      control: { colorPicker: true, defaultColor: "#101014" },
      ui: { label: "Background", order: 15 },
    },
  },
  reduceMotion: {
    type: "boolean",
    required: false,
    description:
      "Reduce motion: no rising fill, no counting, no flashes — the bar and counter park at the schedule's final amount. Default: off.",
    meta: { ui: { label: "Reduce motion", order: 16 } },
  },
  geometry: {
    type: "json",
    required: false,
    description:
      "Exact-pixel geometry overrides, merged per-field: { barRect?, labelRect?, fontSizePx? } (canvas px). Wins over Layout (m0) and placement. Default: empty.",
    meta: {
      control: { flavor: "jsonModal" },
      ui: { label: "Geometry (px)", order: 17, consumer: "agent" },
    },
  },
  debugLayout: {
    type: "boolean",
    required: false,
    description:
      "Dev-only: draw the layout contract (label/bar boxes; counter text fits its slot) instead of the overlay. Default: off.",
    meta: { ui: { label: "Debug layout", order: 18 } },
  },
});
