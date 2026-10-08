import type { LayoutConstraint } from "@m0saic/template-utils";
import { type TextFit } from "./text";
/**
 * `@m0saic-dev/devops/run-recap/v1` - the report a workflow run sends when it
 * is done: what triggered it, the steps it took, what came out, what it cost.
 *
 * ONE CONCEPT: **every run can end with a clip.** An agent-workflow platform
 * already holds everything on this frame - the trigger, each step's kind,
 * status and duration, the retries a gate caused, the PR it opened, the
 * spend. One more job on `run.completed` turns that record into props and
 * renders this; the person who filed the ticket gets a twenty-second video
 * in Slack or their inbox instead of a dashboard link. The agent that did
 * the work writes ONE sentence (`summary`); everything else is data, and
 * the template is the gate that keeps a thousand reports looking like one.
 *
 * The frame builds up rather than cutting away - it is a report, not an ad:
 *
 *   1. the header  - status, workflow, trigger, when and how long. Static
 *                    from frame 0, so the thumbnail already says "succeeded".
 *   2. the steps   - one card per step, arriving in order: kind, name,
 *                    duration, a status dot, and "retried" when a gate sent
 *                    it back. A row in landscape and square; a list in
 *                    portrait.
 *   3. the outcome - the result line, the agent's sentence, up to four stat
 *                    tiles, the cost, the link. Holds to the last frame.
 *
 * The rule that bites: **`steps` and `stats` are JSON, and render() is the
 * gate.** A row with a missing name, an unknown kind or a negative duration
 * fails the render with the field named - a bad export never ships as a
 * blank card. More than six steps collapse into "+N more"; more than four
 * stats are dropped from the fifth.
 *
 * Text is Latin (the bundled Roboto): emoji and other scripts in a step
 * name are dropped rather than drawn as empty boxes.
 */
export type RunStepKind = "agent" | "run" | "tool";
export type RunStepStatus = "passed" | "failed" | "skipped" | "running";
export type RunStatus = "succeeded" | "failed" | "needs_review" | "cancelled";
export type RunStep = {
    /** The step's key or label. Required. */
    name: string;
    /** agent | run | tool (default run). */
    kind?: string;
    /** passed | failed | skipped | running (default passed). */
    status?: string;
    /** Wall time in seconds. Omit to hide. */
    durationSec?: number;
    /** How many times a gate sent the run back to this step (default 0). */
    retries?: number;
};
export type RunStat = {
    /** The small line under the number. */
    label: string;
    /** The number, as text ("212 passed", "+120 -34"). */
    value: string;
};
export type RunRecapProps = {
    /** Where the report is going (chat | email | square | mobile): sets the canvas it is rendered at. */
    platform?: string;
    /** The small wordmark on every frame, and the clip's name. Required. */
    brandName?: string;
    /** Zero or one logo (image or short video, absolute path) in place of the wordmark text. */
    brandLogo?: string[];
    /** The small label opposite the wordmark. Empty removes it. */
    kicker?: string;
    /** The workflow that ran. Required. */
    workflowName?: string;
    /** succeeded | failed | needs_review | cancelled. */
    status?: string;
    /** What started the run, in one line. Empty removes it. */
    triggerLabel?: string;
    /** When it started, as text. Empty removes it. */
    startedLabel?: string;
    /** How long it took, as text. Empty removes it. */
    durationLabel?: string;
    /** The steps, in order (1..12). */
    steps?: RunStep[];
    /** The result in one line ("PR #482 is ready for review"). Required. */
    outcomeTitle?: string;
    /** The agent's one or two sentences on what it did. Empty removes it. */
    summary?: string;
    /** Up to four numbers worth a tile. */
    stats?: RunStat[];
    /** What the run cost, as text. Empty removes it. */
    costLabel?: string;
    /** Where to go, in the pill. Empty removes the pill. */
    outcomeUrl?: string;
    /** Light or dark: the page and text pair the clip starts from. */
    theme?: string;
    /** The brand colour: the pill, the kind tags, the progress line (#rrggbb). Statuses keep their own colours. */
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
export declare const RUN_RECAP_MIN_SEC = 8;
export declare const RUN_RECAP_MAX_SEC = 30;
export declare const RUN_RECAP_MAX_STEPS = 12;
/** Cards drawn before the rest collapse into "+N more". */
export declare const RUN_RECAP_SHOWN_STEPS = 6;
export declare const RUN_RECAP_MAX_STATS = 4;
export declare const RUN_STATUSES: readonly ["succeeded", "failed", "needs_review", "cancelled"];
export declare const STEP_KINDS: readonly ["agent", "run", "tool"];
export declare const STEP_STATUSES: readonly ["passed", "failed", "skipped", "running"];
/**
 * Where the report is going, as the canvas it wants. The knob drives
 * `resolveOutputHints`, so a Make user who keeps the resolution locked to
 * the template just picks a platform and the canvas follows; an explicit
 * `-w/-h` or Device choice still wins at render.
 */
export declare const RECAP_PLATFORMS: {
    /** 16:9 at full size - a chat message's inline player. */
    readonly chat: {
        readonly width: 1920;
        readonly height: 1080;
    };
    /** 16:9 at 720p - the same frame, a lighter file for an inbox. */
    readonly email: {
        readonly width: 1280;
        readonly height: 720;
    };
    /** 1:1 - a chat thumbnail, a dashboard tile. */
    readonly square: {
        readonly width: 1080;
        readonly height: 1080;
    };
    /** 9:16 - a phone; the steps become a list. */
    readonly mobile: {
        readonly width: 1080;
        readonly height: 1920;
    };
};
export type RecapPlatform = keyof typeof RECAP_PLATFORMS;
export declare const RECAP_PLATFORM_KEYS: RecapPlatform[];
export declare const RECAP_THEMES: readonly ["light", "dark"];
export type RecapTheme = (typeof RECAP_THEMES)[number];
/** The page and text pair each theme starts from; `background` / `ink` override either half. */
export declare const RECAP_THEME_COLORS: Record<RecapTheme, {
    background: string;
    ink: string;
}>;
/** Statuses keep their meaning in every theme and under every accent. */
export declare const STATUS_COLORS: Record<RunStatus | RunStepStatus, string>;
export type RecapBeats = {
    total: number;
    /** Where the steps start arriving, and where the outcome does. */
    cuts: [number, number];
    rise: number;
    stagger: number;
};
/**
 * 10% header alone, then one card per stagger; the outcome starts a beat
 * after the last card has landed, so a run with two steps does not leave the
 * lower half empty while one with six still reads in order. Ramps shorten
 * on a short clip.
 */
export declare function recapBeats(totalSec: number, cardCount: number): RecapBeats;
export type RecapRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type RecapBlock = {
    fit: TextFit;
    rect: RecapRect;
};
export type RecapStep = {
    name: string;
    kind: RunStepKind;
    status: RunStepStatus;
    durationSec: number | null;
    retries: number;
    /** The ORIGINAL index into the prop (bindings use it). -1 for the "+N more" card. */
    index: number;
};
export type RecapCopy = {
    brandName: string;
    hasLogo: boolean;
    kicker: string;
    workflowName: string;
    status: RunStatus;
    triggerLabel: string;
    startedLabel: string;
    durationLabel: string;
    steps: RecapStep[];
    outcomeTitle: string;
    summary: string;
    stats: RunStat[];
    costLabel: string;
    outcomeUrl: string;
};
export type RecapCard = {
    step: RecapStep;
    rect: RecapRect;
    dot: RecapRect;
    name: RecapBlock;
    meta: RecapBlock;
};
export type RecapTile = {
    stat: RunStat;
    index: number;
    rect: RecapRect;
    value: RecapBlock;
    label: RecapBlock;
};
export type RecapLayout = {
    W: number;
    H: number;
    /** Cards as a vertical list (portrait) instead of a row. */
    stacked: boolean;
    wordmark: RecapBlock;
    logo: RecapRect | null;
    kicker: RecapBlock | null;
    badge: RecapRect;
    badgeText: TextFit;
    title: RecapBlock;
    trigger: RecapBlock | null;
    when: RecapBlock | null;
    rail: RecapRect | null;
    cards: RecapCard[];
    outcome: RecapBlock;
    summary: RecapBlock | null;
    tiles: RecapTile[];
    cost: RecapBlock | null;
    pill: RecapRect | null;
    url: TextFit | null;
    bar: RecapRect;
};
/** "42s", "3m 10s", "1h 02m". */
export declare function durationText(sec: number): string;
/** The small line under a step's name: kind, duration, retries. */
export declare function stepMeta(step: RecapStep): string;
/** The cards shown: all of them up to the cap, else the first cap-1 and a "+N more". */
export declare function shownSteps(steps: RecapStep[]): RecapStep[];
/**
 * Three bands, top to bottom, in every orientation: the header (chrome row,
 * status + workflow, trigger + when), the steps (a row of cards, or a list
 * in portrait), the outcome (result, summary, tiles, cost + link). Every
 * text rect is sized FROM its fitted block, so nothing can overflow.
 */
export declare function layoutRunRecap(copy: RecapCopy, W: number, H: number): RecapLayout;
/** What the geometry promises, label by label. */
export declare function runRecapContract(L: RecapLayout): LayoutConstraint[];
export declare const RunRecapV1: import("@m0saic/types").MosaicTemplate<RunRecapProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default RunRecapV1;
