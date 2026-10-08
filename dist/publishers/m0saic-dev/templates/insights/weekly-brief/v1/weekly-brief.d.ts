import type { LayoutConstraint } from "@m0saic/template-utils";
import { type TextFit } from "./text";
/**
 * `@m0saic-dev/insights/weekly-brief/v1` - the Monday brief: a greeting, one
 * sentence on the week, up to six stat tiles with a trend each, the two or
 * three things worth knowing, and where the numbers came from.
 *
 * ONE CONCEPT: **a brief is a list of questions, answered.** A data-retrieval
 * layer that turns "how many new customers last week?" into live rows (and
 * a plain-English line on how it got them) has already done the hard part;
 * the agent asks the same questions every Monday and this template is where
 * the answers land. The exec gets a video in their inbox - the same video
 * every week, only the numbers move - instead of a dashboard to log into.
 * The numbers are the system of record's, the sentence is the agent's, the
 * layout is signed off once.
 *
 * The frame builds up - it is a report, not an ad:
 *
 *   1. hello       - wordmark, "Weekly brief - week of ...", the greeting and
 *                    the headline sentence. Static from frame 0: the thumbnail
 *                    already says the one thing.
 *   2. the numbers - tiles arrive one at a time: label, value, a signed delta
 *                    coloured by direction x whether up is good, the trend as
 *                    a REAL chart (the line chart or the bar graph that ship
 *                    in m0saic, nested) drawing itself in, and the retrieval
 *                    layer's own caption under it.
 *   3. so what     - up to three highlights, then the footer (how many
 *                    questions, from which sources) and the link. Holds.
 *
 * **The series is the only source of truth.** A metric's `series` is the
 * data; the value is its last point, the delta its last change, the chart its
 * whole run - all derived here, from one array, so the number and the chart
 * cannot disagree (editing a delta to "+1.4%" over a falling line is not a
 * state this template can be in). Double-clicking the value in Make edits the
 * last data point; the value, the delta and the chart move together.
 *
 * **The charts are the shipped ones.** `@m0saic/charts/line-chart/v2` and
 * `@m0saic/charts/bar-graph/v3` are vendored byte-for-byte (only their ids
 * renamed - `src/_vendor/m0saic-templates/VENDORED.md`) and nested per tile
 * with `renderNestedTemplate`, themed to the tile through the upstream theme
 * tokens, their intro delayed to the tile's arrival. Nothing is drawn by
 * hand; the tile gets the chart's own animation for free.
 *
 * The rule that bites: **`metrics` is JSON and render() is the gate.** A
 * metric with no label, a `series` that is not numbers, a `value` or `delta`
 * beside a series, a `format` or `chart` outside its set, or more than six
 * metrics fails the render with the field named. Text is Latin (the bundled
 * Roboto); non-Latin scripts are dropped rather than drawn as empty boxes.
 */
export type BriefTrend = "up" | "down" | "flat";
export type BriefMetricInput = {
    /** Sentence case, no trailing colon. Required. */
    label: string;
    /**
     * The data, oldest to newest, 1 to 24 points - THE source of truth: the last
     * point is the value, the one before it the delta, the run the chart. Omit
     * it only for a one-off number; then `value` is required and no chart draws.
     */
    series?: number[];
    /** How the series prints: number (3,184 / 12.9K), currency ($412K), percent (41%, deltas in pts). Default number. */
    format?: string;
    /** Decimal places for the value when the format is not compact (default 0). */
    decimals?: number;
    /** A one-off number when there is no series ("$412K"). Refused beside a series. */
    value?: string;
    /** A one-off delta when there is no series ("+8.2%"). Refused beside a series. */
    delta?: string;
    /** Whether up is the good direction (default true). Colours the delta. */
    upIsGood?: boolean;
    /** line | bars (default line - a sparkline shows shape; bars measure from zero). */
    chart?: string;
    /** One short line under the chart - the retrieval layer's own explanation. */
    caption?: string;
    /**
     * The preparer's note on this tile, up to 140 characters. Any tile with a
     * note becomes a stop: after the board has built, the camera eases in on
     * the tile, the note shows on a card while there is time to read it, and
     * the camera moves on - then pulls back to the whole board. Empty = no stop.
     */
    note?: string;
};
export type WeeklyBriefProps = {
    /** Where the brief is going (email | chat | square | mobile): sets the canvas it is rendered at. */
    platform?: string;
    /** The small wordmark on every frame, and the clip's name. Required. */
    brandName?: string;
    /** Zero or one logo (image or short video, absolute path) in place of the wordmark text. */
    brandLogo?: string[];
    /** What this is ("Weekly brief"). Empty removes it. */
    title?: string;
    /** Which week ("Week of 6 Oct 2026"). Empty removes it. */
    periodLabel?: string;
    /** The word before the name ("Good morning"). Empty leaves the name alone. */
    greeting?: string;
    /** Who it is for. Empty removes the greeting line. */
    recipientName?: string;
    /** The one sentence on the week. Required. */
    headline?: string;
    /** One to six metrics. */
    metrics?: BriefMetricInput[];
    /** The period every delta compares to ("vs last week"). Empty removes it. */
    deltaLabel?: string;
    /** Up to three lines worth knowing. */
    highlights?: string[];
    /** Provenance, on the last row ("6 questions, answered live from ..."). Empty removes it. */
    footer?: string;
    /** Where to go, in the pill. Empty removes the pill. */
    ctaUrl?: string;
    /** Light or dark: the page and text pair the clip starts from. */
    theme?: string;
    /** The brand colour: the current period of every chart, the pill, the progress line (#rrggbb). */
    accent?: string;
    /** The page (#rrggbb). Empty takes the theme's. */
    background?: string;
    /** The text (#rrggbb). Empty takes the theme's. */
    ink?: string;
    /** Clip length in whole seconds (8..30). */
    durationSec?: number;
    /** Dev-only: check the layout contract and draw it over the frame. */
    debugLayout?: boolean;
};
export declare const BRIEF_MIN_SEC = 8;
export declare const BRIEF_MAX_SEC = 30;
export declare const BRIEF_MAX_METRICS = 6;
export declare const BRIEF_MAX_HIGHLIGHTS = 3;
export declare const BRIEF_PLATFORMS: {
    /** 16:9 at full size - the player in an inbox, or a slide. */
    readonly email: {
        readonly width: 1920;
        readonly height: 1080;
    };
    /** 16:9 at 720p - a lighter file for a chat message's inline player. */
    readonly chat: {
        readonly width: 1280;
        readonly height: 720;
    };
    /** 1:1 - a feed or a dashboard tile; two tiles across. */
    readonly square: {
        readonly width: 1080;
        readonly height: 1080;
    };
    /** 9:16 - a phone; two tiles across, the rest stacks. */
    readonly mobile: {
        readonly width: 1080;
        readonly height: 1920;
    };
};
export type BriefPlatform = keyof typeof BRIEF_PLATFORMS;
export declare const BRIEF_PLATFORM_KEYS: BriefPlatform[];
export declare const BRIEF_THEMES: readonly ["light", "dark"];
export type BriefTheme = (typeof BRIEF_THEMES)[number];
export declare const BRIEF_THEME_COLORS: Record<BriefTheme, {
    background: string;
    ink: string;
}>;
/** Status colours for a delta - reserved, never a series colour; the sign and the word carry the meaning too. */
export declare const BRIEF_GOOD = "#22a06b";
export declare const BRIEF_BAD = "#e5484d";
export declare const BRIEF_CHARTS: readonly ["line", "bars"];
export type BriefChart = (typeof BRIEF_CHARTS)[number];
export declare const BRIEF_FORMATS: readonly ["number", "currency", "percent"];
export type BriefFormat = (typeof BRIEF_FORMATS)[number];
/** Points per series - the chart templates' comfortable width for a sparkline slot. */
export declare const BRIEF_MAX_POINTS = 24;
/** The smallest slot a nested chart renders in (px); under it the tile shows no chart. */
export declare const BRIEF_MIN_CHART_W = 96;
export declare const BRIEF_MIN_CHART_H = 36;
/** The vendored chart templates this template nests (ids renamed from `@m0saic/charts/...`). */
export declare const BRIEF_LINE_CHART_ID = "@m0saic/charts/line-chart/v2";
export declare const BRIEF_BAR_GRAPH_ID = "@m0saic/charts/bar-graph/v3";
export type BriefBeats = {
    total: number;
    cuts: [number, number];
    rise: number;
    stagger: number;
};
/** 10% hello alone, one tile per stagger, the highlights a beat after the last tile; capped at half the clip. */
export declare function briefBeats(totalSec: number, tileCount: number): BriefBeats;
export type BriefRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type BriefBlock = {
    fit: TextFit;
    rect: BriefRect;
};
export type BriefMetric = {
    label: string;
    /** As drawn - derived from the series when there is one. */
    value: string;
    /** As drawn - derived from the series' last change when there is one. */
    delta: string;
    trend: BriefTrend;
    upIsGood: boolean;
    series: number[];
    chart: BriefChart;
    caption: string;
    /** The preparer's note; non-empty = a camera stop on this tile. */
    note: string;
    index: number;
};
export type BriefCopy = {
    brandName: string;
    hasLogo: boolean;
    title: string;
    periodLabel: string;
    greeting: string;
    recipientName: string;
    headline: string;
    metrics: BriefMetric[];
    deltaLabel: string;
    highlights: string[];
    footer: string;
    ctaUrl: string;
};
export type BriefTile = {
    metric: BriefMetric;
    rect: BriefRect;
    label: BriefBlock;
    value: BriefBlock;
    /** The signed delta, beside the value when it fits, else under it. */
    delta: BriefBlock | null;
    chart: BriefRect | null;
    caption: BriefBlock | null;
};
export type BriefHighlight = {
    index: number;
    dot: BriefRect;
    text: BriefBlock;
};
export type BriefLayout = {
    W: number;
    H: number;
    stacked: boolean;
    wordmark: BriefBlock;
    logo: BriefRect | null;
    kicker: BriefBlock | null;
    hello: BriefBlock | null;
    headline: BriefBlock;
    tiles: BriefTile[];
    highlights: BriefHighlight[];
    footer: BriefBlock | null;
    pill: BriefRect | null;
    url: TextFit | null;
    bar: BriefRect;
};
/**
 * Three bands in every orientation: the hello (chrome row, greeting,
 * headline), the grid of tiles (three across in landscape, two in square and
 * portrait), the so-what (highlights, then footer and link). The grid takes
 * what the other two leave; every text rect is sized FROM its fitted block.
 */
export declare function layoutWeeklyBrief(copy: BriefCopy, W: number, H: number): BriefLayout;
/** What the geometry promises, label by label. */
export declare function weeklyBriefContract(L: BriefLayout): LayoutConstraint[];
export declare const WeeklyBriefV1: import("@m0saic/types").MosaicTemplate<WeeklyBriefProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default WeeklyBriefV1;
/** The trend a delta string implies: a leading "+" is up, "-" is down, else flat. */
export declare function trendOfDelta(delta: string): BriefTrend;
/** Compact figures the way a stat tile prints them: 1,284 / 12.9K / $4.2M / 41%. */
export declare function formatValue(n: number, format: BriefFormat, decimals?: number): string;
/** The y-range a sparkline line is drawn in: the series' own min..max plus a tenth of air each side (a flat series gets a unit). */
export declare function lineDomain(series: number[]): {
    minValue: number;
    maxValue: number;
};
/** The last change: percentage points for a percent, else a signed percent of the previous point. */
export declare function formatDelta(last: number, prev: number, format: BriefFormat): string;
/** The noted tiles, in tile order - the camera stops. */
export declare function noteStops(metrics: BriefMetric[]): Array<{
    index: number;
    note: string;
}>;
/**
 * The clip length the props ask for, in ms: the length knob, plus the walk
 * when any tile carries a note. Never throws (hosts call it per edit) - junk
 * props fall back to the knob.
 */
export declare function plannedDurationMs(props: Partial<WeeklyBriefProps> | undefined): number;
