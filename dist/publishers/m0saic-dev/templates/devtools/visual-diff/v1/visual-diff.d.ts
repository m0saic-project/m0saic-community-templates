import type { LayoutConstraint } from "@m0saic/template-utils";
import { type TextFit } from "./text";
import { type Capture, type Diff } from "./capture";
/**
 * `@m0saic-dev/devtools/visual-diff/v1` - "main vs this PR": two layouts of
 * the same page as labelled wireframes, side by side, with every difference
 * found, outlined, numbered and walked through by a camera.
 *
 * ONE CONCEPT: **a page's layout is data, so a visual regression is a diff.**
 * `tools/capture-html.mjs` loads any HTML (a file, a URL, the app under an
 * E2E run) in a real browser and writes the areas a person would name -
 * each a rect with a kind, a label and a path in the tree. Two captures of
 * the same page match element to element; what grew, moved, appeared or
 * vanished is exact, and a container that changed only because its content
 * did is a consequence, not a cause - so "1 visual difference" stays one.
 * The whole thing is m0's own debug-layout view, pointed at a real UX.
 *
 * The frame builds up:
 *
 *   1. the board   - the PR's title and status, the two windows (chrome bar,
 *                    page background, every area outlined with its label and
 *                    size). Static from frame 0: the thumbnail is the diff.
 *   2. the marks   - each primary change outlines itself in the accent on the
 *                    PR side (and its old box on main), numbered in reading
 *                    order; consequences in a muted tone; removals in red on
 *                    main. The caption counts them.
 *   3. the walk    - the camera eases in on each numbered change with a card
 *                    (what it is, what changed, the reviewer's note), then
 *                    pulls back. Clip length follows the changes.
 *
 * Sidecars: next to the render the engine writes `<out>.before.m0c` and
 * `<out>.after.m0c` - each side's layout as an m0 with every area's label
 * keyed by stable key, the capture and the diff in `custom` - and
 * `<out>.diff.json`. The exact geometry of what went wrong, openable in the
 * layout tool, not just a picture of it.
 *
 * The rule that bites: **render() is the gate.** A capture without the
 * format, a viewport or a rect field fails with the field named; a note
 * over 140 characters too. Text is Latin (the bundled Roboto).
 */
export type VisualDiffProps = {
    /** Where the clip is going (pr | chat | square | mobile): sets the canvas it is rendered at. */
    platform?: string;
    /** The small wordmark on every frame, and the clip's name. Required. */
    brandName?: string;
    /** Zero or one logo (image or short video, absolute path) in place of the wordmark text. */
    brandLogo?: string[];
    /** The PR, in one line. Required. */
    title?: string;
    /** The baseline's name, on its window ("main"). */
    baseLabel?: string;
    /** The change's name, on its window ("this PR"). */
    headLabel?: string;
    /** The baseline capture (page-skeleton schema with labels and paths; an object or JSON text). */
    before?: unknown;
    /** The PR's capture, same page. */
    after?: unknown;
    /** One line of status under the title ("65/67 E2E tests passed"). Empty removes it. */
    statusLabel?: string;
    /** A change smaller than this many pixels is not a change (0..32). */
    tolerancePx?: number;
    /** How many changes the camera visits (1..6). The rest stay outlined. */
    maxStops?: number;
    /** The reviewer's note per visited change, in order (up to 140 characters each). */
    notes?: string[];
    /** Draw each area's label and size inside its outline. */
    showLabels?: boolean;
    /** Light or dark: the page and text pair the clip starts from. */
    theme?: string;
    /** The brand colour: change outlines, badges, the pill, the progress line (#rrggbb). */
    accent?: string;
    /** The page (#rrggbb). Empty takes the theme's. */
    background?: string;
    /** The text (#rrggbb). Empty takes the theme's. */
    ink?: string;
    /** How long the board takes to build and hold, in whole seconds (6..30); the walk is appended. */
    durationSec?: number;
    /** Dev-only: check the layout contract and draw it over the frame. */
    debugLayout?: boolean;
};
export declare const DIFF_MIN_SEC = 6;
export declare const DIFF_MAX_SEC = 30;
export declare const DIFF_MAX_STOPS = 6;
export declare const DIFF_MAX_LABELS_PER_SIDE = 48;
export declare const DIFF_PLATFORMS: {
    /** 16:9 at full size - a PR comment's player, a review call. */
    readonly pr: {
        readonly width: 1920;
        readonly height: 1080;
    };
    /** 16:9 at 720p - a lighter file for a chat message. */
    readonly chat: {
        readonly width: 1280;
        readonly height: 720;
    };
    /** 1:1 - the two windows stack. */
    readonly square: {
        readonly width: 1080;
        readonly height: 1080;
    };
    /** 9:16 - a phone; the two windows stack. */
    readonly mobile: {
        readonly width: 1080;
        readonly height: 1920;
    };
};
export type DiffPlatform = keyof typeof DIFF_PLATFORMS;
export declare const DIFF_PLATFORM_KEYS: DiffPlatform[];
export declare const DIFF_THEMES: readonly ["light", "dark"];
export type DiffTheme = (typeof DIFF_THEMES)[number];
export declare const DIFF_THEME_COLORS: Record<DiffTheme, {
    background: string;
    ink: string;
}>;
/** Removals are red on every theme; the sign and the word carry it too. */
export declare const DIFF_REMOVED = "#e5484d";
export type DiffBeats = {
    total: number;
    cuts: [number, number];
    rise: number;
    stagger: number;
};
/** The board is static; the marks land from 12%, one per stagger; the walk starts after the last. */
export declare function diffBeats(totalSec: number, markCount: number): DiffBeats;
export type DiffRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type DiffBlock = {
    fit: TextFit;
    rect: DiffRect;
};
export type WindowLayout = {
    /** The whole window: chrome bar plus page. */
    frame: DiffRect;
    bar: DiffRect;
    dots: DiffRect[];
    label: DiffBlock;
    /** The page area the capture is fitted into. */
    page: DiffRect;
    /** Capture px -> page px. */
    scale: number;
    /** Where the capture's (0,0) lands. */
    origin: {
        x: number;
        y: number;
    };
};
export type DiffLayout = {
    W: number;
    H: number;
    stacked: boolean;
    wordmark: DiffBlock;
    logo: DiffRect | null;
    kicker: DiffBlock;
    title: DiffBlock;
    status: DiffBlock | null;
    caption: DiffBlock;
    before: WindowLayout;
    after: WindowLayout;
    bar: DiffRect;
};
export type DiffCopy = {
    brandName: string;
    hasLogo: boolean;
    title: string;
    baseLabel: string;
    headLabel: string;
    statusLabel: string;
    captionText: string;
    before: Capture;
    after: Capture;
};
/** "4 visual differences - 31 elements shifted" */
export declare function captionOf(diffs: Diff[]): string;
/** Map a capture rect into a window's page area. */
export declare function toPage(win: WindowLayout, r: {
    x: number;
    y: number;
    w: number;
    h: number;
}): DiffRect;
export declare function layoutVisualDiff(copy: DiffCopy, W: number, H: number): DiffLayout;
/** What the geometry promises. The wireframe rects are data, not promises. */
export declare function visualDiffContract(L: DiffLayout): LayoutConstraint[];
export declare const VisualDiffV1: import("@m0saic/types").MosaicTemplate<VisualDiffProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default VisualDiffV1;
/** The differences the props describe, in reading order. Throws with the field named. */
export declare function resolveDiffs(props: Partial<VisualDiffProps> | undefined): {
    before: Capture;
    after: Capture;
    diffs: Diff[];
    tolerancePx: number;
    maxStops: number;
};
/** The stops: the primary changes, in reading order, up to maxStops. */
export declare function diffStops(diffs: Diff[], maxStops: number): Diff[];
/** The clip length the props ask for (ms). Never throws - junk falls back to the knob. */
export declare function plannedDiffDurationMs(props: Partial<VisualDiffProps> | undefined): number;
