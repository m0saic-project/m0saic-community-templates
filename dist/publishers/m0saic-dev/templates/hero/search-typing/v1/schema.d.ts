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
import type { SearchTypingEndBehavior, TypingTimingSpec } from "./timeline";
export declare const SEARCH_TYPING_ID = "@m0saic-dev/hero/search-typing/v1";
/** Explicit output kind: this template is a video loop, never a still. */
export declare const SEARCH_TYPING_FORMAT: {
    readonly kind: "video";
    readonly container: "mp4";
};
export declare const MAX_WORDS = 8;
export declare const MAX_WORD_CHARS = 24;
/** Label cap: bounds the chrome atlas's real glyph-contour count well under
 *  MASK_SUBPATH_BUDGET (the mask resolver's argv wall). */
export declare const MAX_LABEL_CHARS = 40;
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
    style: Omit<Required<SearchTypingStyleProps>, "pageColor" | "cardColor" | "labelColor" | "inkColor"> & {
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
export declare const defaultProps: SearchTypingDefaults;
/**
 * Canonicalize an opaque plain-hex color to lowercase `#rrggbb`. Throws on
 * anything that could carry alpha (rgba(), #rrggbbaa, named colors) — the
 * curtain requires a provably opaque fill shared verbatim by two paint paths.
 */
export declare function normalizeOpaqueHex(value: string, propPath: string): MosaicColor;
/**
 * Merge over defaults and validate fail-fast. Returns the fully-resolved prop
 * set every other module consumes (words trimmed, cardColor canonicalized).
 */
export declare function parseProps(props: SearchTypingProps | undefined): ResolvedSearchTypingProps;
export declare const searchTypingPropsSchema: Record<keyof SearchTypingProps, import("@m0saic/types").MosaicTemplatePropDefinition>;
