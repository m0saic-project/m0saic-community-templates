/**
 * Props schema for `@m0saic-dev/hero/search-typing/v1` — deterministic defaults +
 * fail-fast validation.
 *
 * The curtain trick (D2/D4) makes one prop load-bearing: cover boxes paint
 * `style.cardColor` OVER the word glyphs, so the card fill and the cover-box
 * fill must be the SAME fully-opaque color. `parseProps` therefore requires
 * `cardColor` to be plain hex and normalizes it to one canonical `#rrggbb`
 * string — the single resolved value both the svg card tile and the drawbox
 * cover track consume (any drift shows ghost rectangles).
 */

import type { MosaicColor } from "@m0saic/types";
import { GATED_BOX_BUDGET, definePropsSchema } from "@m0saic/template-utils";

import type { SearchTypingEndBehavior, TypingTimingSpec } from "./timeline";

export const SEARCH_TYPING_ID = "@m0saic-dev/hero/search-typing/v1";

/** Explicit output kind: this template is a video loop, never a still. */
export const SEARCH_TYPING_FORMAT = { kind: "video", container: "mp4" } as const;

export const MAX_WORDS = 8;
export const MAX_WORD_CHARS = 24;
/** Label cap: bounds the chrome atlas's real glyph-contour count well under
 *  MASK_SUBPATH_BUDGET (the mask resolver's argv wall). */
export const MAX_LABEL_CHARS = 40;

export type SearchTypingUnderlineMode = "grow" | "static" | "none";

/**
 * "fill" (default): the search box IS the canvas — tight bounds for nested
 * callers, who carve the cell and place this template inside it. "card": the
 * standalone hero presentation — a px-clamped floating card centered on the
 * page color.
 */
export type SearchTypingFrameMode = "fill" | "card";

export type SearchTypingTimingProps = Partial<TypingTimingSpec>;

export type SearchTypingCaretProps = {
  /** Show a blinking caret (the reference has none). */
  show?: boolean;
  /** Full blink period (ms); on for the first half. */
  blinkMs?: number;
  /** Caret bar width (px). */
  widthPx?: number;
};

export type SearchTypingIconProps = {
  /** Show the polygon magnifier icon. */
  show?: boolean;
};

export type SearchTypingStyleProps = {
  /** Page background behind the card → document.backgroundColor. */
  pageColor?: string;
  /** Card fill — MUST be opaque plain hex (cover boxes paint this color). */
  cardColor?: string;
  /** Label + icon color. */
  labelColor?: string;
  /** Word, underline, and caret ink. Defaults to the label color — the
   *  reference look is uniform; set a darker value for a two-tone split. */
  inkColor?: string;
  /** Card corner radius (px), clamped to barH/2 at layout. */
  cornerRadiusPx?: number;
  /** Bar width as a fraction of canvas width (px-clamped at layout). */
  barWidthFrac?: number;
  /** barH = barW·barAspect (px-clamped at layout). */
  barAspect?: number;
};

export type SearchTypingProps = {
  /** Rotating words typed and deleted character-by-character. */
  words?: string[];
  /** Static gray prompt before the word; "" hides it. */
  label?: string;
  /** "fill" = the box is the canvas (nested-caller default); "card" = floating hero card. */
  frame?: SearchTypingFrameMode;
  timing?: SearchTypingTimingProps;
  /** "hold" keeps the last word typed (poster frame); "loop" is seamless. */
  endBehavior?: SearchTypingEndBehavior;
  caret?: SearchTypingCaretProps;
  underline?: SearchTypingUnderlineMode;
  /** Dev-only layout contract: assert the icon stays square and ≤2em. */
  debugLayout?: boolean;
  icon?: SearchTypingIconProps;
  style?: SearchTypingStyleProps;
};

export type ResolvedSearchTypingProps = {
  words: string[];
  label: string;
  frame: SearchTypingFrameMode;
  timing: TypingTimingSpec;
  endBehavior: SearchTypingEndBehavior;
  caret: Required<SearchTypingCaretProps>;
  underline: SearchTypingUnderlineMode;
  debugLayout: boolean;
  icon: Required<SearchTypingIconProps>;
  style: Omit<
    Required<SearchTypingStyleProps>,
    "pageColor" | "cardColor" | "labelColor" | "inkColor"
  > & {
    pageColor: MosaicColor;
    /** Canonicalized `#rrggbb` — the ONE value the card tile AND the cover
     *  boxes paint (any drift shows ghost rectangles). */
    cardColor: MosaicColor;
    labelColor: MosaicColor;
    inkColor: MosaicColor;
  };
};

/** Deterministic defaults with every nested knob concrete (deep-required). */
export type SearchTypingDefaults = {
  words: string[];
  label: string;
  frame: SearchTypingFrameMode;
  timing: TypingTimingSpec;
  endBehavior: SearchTypingEndBehavior;
  caret: Required<SearchTypingCaretProps>;
  underline: SearchTypingUnderlineMode;
  debugLayout: boolean;
  icon: Required<SearchTypingIconProps>;
  style: Required<SearchTypingStyleProps>;
};

export const defaultProps: SearchTypingDefaults = {
  words: ["Ideas", "Answers", "Templates", "Tutorials", "Inspiration"],
  label: "Search for",
  frame: "fill",
  timing: {
    typeCharMs: 120,
    deleteCharMs: 90,
    emptyHoldMs: 850,
    wordHoldMs: 1100,
    leadMs: 400,
    trailMs: 400,
  },
  endBehavior: "hold",
  caret: { show: false, blinkMs: 1000, widthPx: 2 },
  underline: "grow",
  debugLayout: false,
  icon: { show: true },
  style: {
    pageColor: "#F2F3F5",
    cardColor: "#FFFFFF",
    labelColor: "#9AA0A6",
    // Defaults to the label color: the reference renders label, typed word,
    // and underline in ONE uniform color (founder-confirmed on candidate-002).
    inkColor: "#9AA0A6",
    cornerRadiusPx: 16,
    barWidthFrac: 0.62,
    barAspect: 0.26,
  },
};

const FRAME_MODES: SearchTypingFrameMode[] = ["fill", "card"];
const END_BEHAVIORS: SearchTypingEndBehavior[] = ["hold", "loop"];
const UNDERLINE_MODES: SearchTypingUnderlineMode[] = ["grow", "static", "none"];

/** A cleared / "none" / blank color knob falls back to the default (the
 *  alpine-pack convention) so clearing a picker never blanks an element. */
function resolveColor(value: string | undefined | null, fallback: string): MosaicColor {
  const v = (value ?? "").trim();
  return (v && v.toLowerCase() !== "none" ? v : fallback) as MosaicColor;
}

/**
 * Canonicalize an opaque plain-hex color to lowercase `#rrggbb`. Throws on
 * anything that could carry alpha (rgba(), #rrggbbaa, named colors) — the
 * curtain requires a provably opaque fill shared verbatim by two paint paths.
 */
export function normalizeOpaqueHex(value: string, propPath: string): MosaicColor {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    throw new Error(
      `search-typing: ${propPath} must be opaque plain hex (#rgb or #rrggbb) — cover boxes must exactly match the card fill (got "${value}")`,
    );
  }
  const hex =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : match[1];
  return `#${hex.toLowerCase()}` as MosaicColor;
}

function expectFinitePositive(value: unknown, propPath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`search-typing: ${propPath} must be a finite number > 0`);
  }
  return value;
}

function expectBoolean(value: unknown, propPath: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`search-typing: ${propPath} must be a boolean`);
  }
  return value;
}

/**
 * Reject characters the typing/atlas engines cannot treat as one visible
 * glyph: surrogate halves (emoji — bundled Roboto has no glyphs for them),
 * combining marks surviving NFC, and zero-width/bidi format characters
 * (which measure 0 advance and rasterize to an empty path).
 */
function assertTypeableText(value: string, propPath: string): void {
  const hasSurrogate = /[\uD800-\uDFFF]/.test(value);
  const hasCombiningMark =
    /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/.test(value);
  const hasZeroWidthOrBidi =
    /[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/.test(value);
  if (hasSurrogate || hasCombiningMark || hasZeroWidthOrBidi) {
    throw new Error(
      `search-typing: ${propPath} must not contain emoji, combining marks, or zero-width characters — every character must be one visible glyph`,
    );
  }
}

function parseWords(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("search-typing: words must be a non-empty array of strings");
  }
  if (value.length > MAX_WORDS) {
    throw new Error(`search-typing: words allows at most ${MAX_WORDS} entries (got ${value.length})`);
  }
  return value.map((word, index) => {
    if (typeof word !== "string") {
      throw new Error(`search-typing: words[${index}] must be a string`);
    }
    // NFC first so decomposed accents ("e" + U+0301) become one typed char.
    const trimmed = word.trim().normalize("NFC");
    if (trimmed.length === 0) {
      throw new Error(`search-typing: words[${index}] is empty after trimming`);
    }
    if (trimmed.length > MAX_WORD_CHARS) {
      throw new Error(
        `search-typing: words[${index}] allows at most ${MAX_WORD_CHARS} chars (got ${trimmed.length})`,
      );
    }
    if (/[\n\r]/.test(trimmed)) {
      throw new Error(`search-typing: words[${index}] must be single-line`);
    }
    // Every UTF-16 unit is one keystroke — it must be one visible glyph.
    assertTypeableText(trimmed, `words[${index}]`);
    return trimmed;
  });
}

/**
 * Merge over defaults and validate fail-fast. Returns the fully-resolved prop
 * set every other module consumes (words trimmed, cardColor canonicalized).
 */
export function parseProps(props: SearchTypingProps | undefined): ResolvedSearchTypingProps {
  const input = props ?? {};

  const words = parseWords(input.words ?? defaultProps.words);

  const rawLabel = input.label ?? defaultProps.label;
  if (typeof rawLabel !== "string" || /[\n\r]/.test(rawLabel)) {
    throw new Error("search-typing: label must be a single-line string");
  }
  // Trim so a whitespace-only label hides like "" (no orphan underline zone);
  // layout adds the one separator space itself.
  const label = rawLabel.trim();
  if (label.length > MAX_LABEL_CHARS) {
    throw new Error(
      `search-typing: label allows at most ${MAX_LABEL_CHARS} chars (got ${label.length})`,
    );
  }
  if (label) assertTypeableText(label, "label");

  const frame = input.frame ?? defaultProps.frame;
  if (!FRAME_MODES.includes(frame)) {
    throw new Error(`search-typing: frame must be fill or card (got "${frame}")`);
  }

  const timing: TypingTimingSpec = { ...defaultProps.timing, ...(input.timing ?? {}) };
  for (const key of Object.keys(defaultProps.timing) as (keyof TypingTimingSpec)[]) {
    expectFinitePositive(timing[key], `timing.${key}`);
  }

  const endBehavior = input.endBehavior ?? defaultProps.endBehavior;
  if (!END_BEHAVIORS.includes(endBehavior)) {
    throw new Error(`search-typing: endBehavior must be hold or loop (got "${endBehavior}")`);
  }

  const underline = input.underline ?? defaultProps.underline;
  if (!UNDERLINE_MODES.includes(underline)) {
    throw new Error(`search-typing: underline must be grow, static, or none (got "${underline}")`);
  }

  const caret = { ...defaultProps.caret, ...(input.caret ?? {}) };
  expectBoolean(caret.show, "caret.show");
  expectFinitePositive(caret.blinkMs, "caret.blinkMs");
  expectFinitePositive(caret.widthPx, "caret.widthPx");

  const icon = { ...defaultProps.icon, ...(input.icon ?? {}) };
  expectBoolean(icon.show, "icon.show");

  const styleInput = input.style ?? {};
  const cornerRadiusPx = styleInput.cornerRadiusPx ?? defaultProps.style.cornerRadiusPx;
  if (
    typeof cornerRadiusPx !== "number" ||
    !Number.isFinite(cornerRadiusPx) ||
    cornerRadiusPx < 0
  ) {
    throw new Error("search-typing: style.cornerRadiusPx must be a finite number ≥ 0");
  }
  const barWidthFrac = styleInput.barWidthFrac ?? defaultProps.style.barWidthFrac;
  if (
    typeof barWidthFrac !== "number" ||
    !Number.isFinite(barWidthFrac) ||
    barWidthFrac <= 0 ||
    barWidthFrac > 1
  ) {
    throw new Error("search-typing: style.barWidthFrac must be a number in (0, 1]");
  }
  const barAspect = expectFinitePositive(
    styleInput.barAspect ?? defaultProps.style.barAspect,
    "style.barAspect",
  );

  const style: ResolvedSearchTypingProps["style"] = {
    pageColor: resolveColor(styleInput.pageColor, defaultProps.style.pageColor),
    cardColor: normalizeOpaqueHex(
      resolveColor(styleInput.cardColor, defaultProps.style.cardColor),
      "style.cardColor",
    ),
    labelColor: resolveColor(styleInput.labelColor, defaultProps.style.labelColor),
    inkColor: resolveColor(styleInput.inkColor, defaultProps.style.inkColor),
    cornerRadiusPx,
    barWidthFrac,
    barAspect,
  };

  // Word limits already bound the cover track (2 boxes/char ≤ 2·8·24 = 384),
  // but the budget is the engine wall — assert it so a future limit bump
  // cannot silently cross it.
  const coverBoxWorstCase = 2 * words.reduce((sum, word) => sum + word.length, 0);
  if (coverBoxWorstCase > GATED_BOX_BUDGET) {
    throw new Error(
      `search-typing: ${coverBoxWorstCase} worst-case cover boxes exceed the ${GATED_BOX_BUDGET}-box track budget`,
    );
  }

  // Strict-boolean passthrough — deterministic default false; anything but
  // literal true stays off (debug is opt-in, never inferred).
  const debugLayout = input.debugLayout === true;
  return { words, label, frame, timing, endBehavior, caret, underline, icon, style, debugLayout };
}

// Tiny field helpers mirror page-skeleton/screencap_grid and stay pack-local.
/* eslint-disable @typescript-eslint/no-explicit-any */
const fBool = (label: string, description = ""): any => ({
  type: "boolean",
  required: false,
  description,
  meta: { ui: { label } },
});
const fNum = (
  label: string,
  description = "",
  control?: any,
  constraints?: any,
): any => ({
  type: "number",
  required: false,
  description,
  meta: {
    ...(constraints ? { constraints } : {}),
    ...(control ? { control } : {}),
    ui: { label },
  },
});
const fColor = (label: string, description = ""): any => ({
  type: "string",
  required: false,
  description,
  meta: {
    constraints: { isColor: true },
    control: { colorPicker: true },
    ui: { label },
  },
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const searchTypingPropsSchema = definePropsSchema<SearchTypingProps>({
  words: {
    type: "string[]",
    required: false,
    description: `Rotating words typed and deleted character-by-character (1–${MAX_WORDS} entries, each 1–${MAX_WORD_CHARS} chars).`,
    meta: { ui: { label: "Words", order: 1, primary: true } },
  },
  label: {
    type: "string",
    required: false,
    description: 'Static prompt before the typed word ("Search for"). Clear to hide it.',
    meta: { ui: { label: "Label", order: 2, primary: true } },
  },
  frame: {
    type: "string",
    required: false,
    description:
      "fill makes the search box the whole canvas (tight bounds for nested use); card floats a px-clamped bar on the page color.",
    meta: {
      constraints: { oneOf: ["fill", "card"] },
      control: {
        options: [
          { value: "fill", label: "Fill the canvas" },
          { value: "card", label: "Floating card" },
        ],
      },
      ui: { label: "Frame", order: 3, primary: true },
    },
  },
  endBehavior: {
    type: "string",
    required: false,
    description:
      "hold keeps the last word typed for a strong poster frame; loop deletes it for a seamless loop.",
    meta: {
      constraints: { oneOf: ["hold", "loop"] },
      control: {
        options: [
          { value: "hold", label: "Hold last word" },
          { value: "loop", label: "Seamless loop" },
        ],
      },
      ui: { label: "End behavior", order: 3, primary: true },
    },
  },
  underline: {
    type: "string",
    required: false,
    description:
      "grow extends the underline with each typed char; static spans label+word; none hides it.",
    meta: {
      constraints: { oneOf: ["grow", "static", "none"] },
      ui: { label: "Underline", order: 4 },
    },
  },
  debugLayout: {
    type: "boolean",
    required: false,
    description:
      "Dev-only layout contract: assert the magnifier stays square and never exceeds 2em of the resolved font. Deterministic default false; production never sets it.",
    meta: { ui: { label: "Debug layout" } },
  },
  timing: {
    type: "group",
    required: false,
    description: "Typing cadence in ms. A pinned render duration rescales everything uniformly.",
    meta: { ui: { label: "Timing", order: 5, collapsedByDefault: true } },
    fields: {
      typeCharMs: fNum("Type per char", "Milliseconds per typed character.", undefined, { min: 1 }),
      deleteCharMs: fNum("Delete per char", "Milliseconds per deleted character.", undefined, { min: 1 }),
      emptyHoldMs: fNum("Empty hold", "Empty-bar hold before each word.", undefined, { min: 1 }),
      wordHoldMs: fNum("Word hold", "Fully-typed word hold.", undefined, { min: 1 }),
      leadMs: fNum("Lead", "Pad before the first word (clamped to ≥ one frame).", undefined, { min: 1 }),
      trailMs: fNum("Trail", "Pad after the last band.", undefined, { min: 1 }),
    },
  },
  caret: {
    type: "group",
    required: false,
    description: "Optional typing caret (the reference animation has none).",
    meta: { ui: { label: "Caret", order: 6, collapsedByDefault: true } },
    fields: {
      show: fBool("Show caret"),
      blinkMs: fNum("Blink period", "Full blink cycle in ms; on for the first half.", undefined, { min: 1 }),
      widthPx: fNum("Width", "Caret bar width in px.", undefined, { min: 1, max: 12 }),
    },
  },
  icon: {
    type: "group",
    required: false,
    description: "Magnifier icon in the card's left zone.",
    meta: { ui: { label: "Icon", order: 7, collapsedByDefault: true } },
    fields: {
      show: fBool("Show magnifier"),
    },
  },
  style: {
    type: "group",
    required: false,
    description: "Colors and card geometry.",
    meta: { ui: { label: "Style", order: 8, collapsedByDefault: true } },
    fields: {
      pageColor: fColor("Page", "Background behind the card."),
      cardColor: fColor(
        "Card",
        "Card fill — must be opaque plain hex; the typing curtain paints this exact color.",
      ),
      labelColor: fColor("Label", "Prompt label and icon color."),
      inkColor: fColor("Ink", "Typed word, underline, and caret color."),
      cornerRadiusPx: fNum(
        "Corner radius",
        "Card corner radius in px (clamped to half the bar height).",
        { flavor: "slider", step: 1, unit: "px" },
        { min: 0, max: 100 },
      ),
      barWidthFrac: fNum(
        "Bar width",
        "Bar width as a fraction of the canvas width (px-clamped).",
        { flavor: "slider", step: 0.01 },
        { min: 0.2, max: 1 },
      ),
      barAspect: fNum(
        "Bar aspect",
        "Bar height as a fraction of the bar width (px-clamped).",
        { flavor: "slider", step: 0.01 },
        { min: 0.1, max: 0.6 },
      ),
    },
  },
});
