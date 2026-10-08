import type {
  MosaicColor,
  MosaicDocument,
  MosaicEngineContext,
  MosaicOverlayExpr,
  MosaicSource,
} from "@m0saic/types";
import { asAssetId, asTemplateId } from "@m0saic/types";
import { circleMask, toM0String } from "@m0saic/dsl-stdlib";
import {
  bindProp,
  bindPropPath,
  bindProps,
  defineMosaicTemplate,
  definePropsSchema,
  entrance,
  makeColorTile,
  placeInsetPieces,
  resolvePinnedDurationMs,
  tag,
} from "@m0saic/template-utils";
import type { LayoutConstraint } from "@m0saic/template-utils";
import { textFitsMeasured, withLayoutIntent } from "./layout";
import { budget, cleanCopy, fitText, type TextFit } from "./text";

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

const ID = "@m0saic-dev/devops/run-recap/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;

export const RUN_RECAP_MIN_SEC = 8;
export const RUN_RECAP_MAX_SEC = 30;
export const RUN_RECAP_MAX_STEPS = 12;
/** Cards drawn before the rest collapse into "+N more". */
export const RUN_RECAP_SHOWN_STEPS = 6;
export const RUN_RECAP_MAX_STATS = 4;

export const RUN_STATUSES = ["succeeded", "failed", "needs_review", "cancelled"] as const;
export const STEP_KINDS = ["agent", "run", "tool"] as const;
export const STEP_STATUSES = ["passed", "failed", "skipped", "running"] as const;
/**
 * Where the report is going, as the canvas it wants. The knob drives
 * `resolveOutputHints`, so a Make user who keeps the resolution locked to
 * the template just picks a platform and the canvas follows; an explicit
 * `-w/-h` or Device choice still wins at render.
 */
export const RECAP_PLATFORMS = {
  /** 16:9 at full size - a chat message's inline player. */
  chat: { width: 1920, height: 1080 },
  /** 16:9 at 720p - the same frame, a lighter file for an inbox. */
  email: { width: 1280, height: 720 },
  /** 1:1 - a chat thumbnail, a dashboard tile. */
  square: { width: 1080, height: 1080 },
  /** 9:16 - a phone; the steps become a list. */
  mobile: { width: 1080, height: 1920 },
} as const;
export type RecapPlatform = keyof typeof RECAP_PLATFORMS;
export const RECAP_PLATFORM_KEYS = Object.keys(RECAP_PLATFORMS) as RecapPlatform[];

export const RECAP_THEMES = ["light", "dark"] as const;
export type RecapTheme = (typeof RECAP_THEMES)[number];

/** The page and text pair each theme starts from; `background` / `ink` override either half. */
export const RECAP_THEME_COLORS: Record<RecapTheme, { background: string; ink: string }> = {
  light: { background: "#f6f7f9", ink: "#161a22" },
  dark: { background: "#0f1218", ink: "#eef1f6" },
};

/** Statuses keep their meaning in every theme and under every accent. */
export const STATUS_COLORS: Record<RunStatus | RunStepStatus, string> = {
  succeeded: "#22a06b",
  passed: "#22a06b",
  failed: "#e5484d",
  needs_review: "#e9a23b",
  running: "#e9a23b",
  cancelled: "#8b919c",
  skipped: "#8b919c",
};

const STATUS_WORDS: Record<RunStatus, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  needs_review: "Needs review",
  cancelled: "Cancelled",
};

/** Generic on purpose: this repo is public, so the defaults name no real company, product or person. */
const DEFAULTS = {
  platform: "chat" as RecapPlatform,
  brandName: "Acme Engineering",
  kicker: "Run report",
  workflowName: "implement-issue",
  status: "succeeded" as RunStatus,
  triggerLabel: "Ticket ACME-482 - Fix null pointer in checkout",
  startedLabel: "Tue 7 Oct, 09:08",
  durationLabel: "6m 12s",
  steps: [
    { name: "Triage", kind: "agent", status: "passed", durationSec: 42 },
    { name: "Mark in progress", kind: "tool", status: "passed", durationSec: 2 },
    { name: "Fix issue", kind: "agent", status: "passed", durationSec: 190, retries: 1 },
    { name: "npm test", kind: "run", status: "passed", durationSec: 62 },
    { name: "Open PR", kind: "agent", status: "passed", durationSec: 18 },
  ] as RunStep[],
  outcomeTitle: "PR #482 is ready for review",
  summary: "Null-checked the cart total in CheckoutService and added a regression test. One test run failed on a stale fixture; the fix step re-ran and all 212 tests pass.",
  stats: [
    { label: "files changed", value: "4" },
    { label: "lines", value: "+120 -34" },
    { label: "tests", value: "212 passed" },
    { label: "agent cost", value: "$0.77" },
  ] as RunStat[],
  costLabel: "3 agent steps - $0.77 - 2 vCPU runner, 6 min",
  outcomeUrl: "git.example/acme/shop/pull/482",
  theme: "dark" as RecapTheme,
  accent: "#5b8def",
  durationSec: 14,
};

// What each prop IS. How Make presents it lives in run-recap.catalog.json.
const propsSchema = definePropsSchema<RunRecapProps>({
  platform: { type: "string", required: false, meta: { constraints: { oneOf: [...RECAP_PLATFORM_KEYS] } } },
  brandName: { type: "string", required: false },
  brandLogo: {
    type: "media[]",
    required: false,
    meta: { control: { multiple: false, picker: "file", accept: ["image", "video"] } },
  },
  kicker: { type: "string", required: false },
  workflowName: { type: "string", required: false },
  status: { type: "string", required: false, meta: { constraints: { oneOf: [...RUN_STATUSES] } } },
  triggerLabel: { type: "string", required: false },
  startedLabel: { type: "string", required: false },
  durationLabel: { type: "string", required: false },
  steps: {
    type: "json",
    required: false,
    meta: {
      constraints: {
        jsonSchema: {
          type: "array",
          minItems: 1,
          maxItems: RUN_RECAP_MAX_STEPS,
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              kind: { type: "string", enum: [...STEP_KINDS] },
              status: { type: "string", enum: [...STEP_STATUSES] },
              durationSec: { type: "number", minimum: 0 },
              retries: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    },
  },
  outcomeTitle: { type: "string", required: false },
  summary: { type: "string", required: false },
  stats: {
    type: "json",
    required: false,
    meta: {
      constraints: {
        jsonSchema: {
          type: "array",
          maxItems: RUN_RECAP_MAX_STATS,
          items: { type: "object", required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } },
        },
      },
    },
  },
  costLabel: { type: "string", required: false },
  outcomeUrl: { type: "string", required: false },
  theme: { type: "string", required: false, meta: { constraints: { oneOf: [...RECAP_THEMES] } } },
  accent: {
    type: "string",
    required: false,
    meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.accent } },
  },
  background: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
  ink: { type: "string", required: false, meta: { constraints: { isColor: true }, control: { colorPicker: true } } },
  durationSec: {
    type: "number",
    required: false,
    meta: { constraints: { min: RUN_RECAP_MIN_SEC, max: RUN_RECAP_MAX_SEC } },
  },
  debugLayout: { type: "boolean", required: false },
});

/* ── timing ── */

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
export function recapBeats(totalSec: number, cardCount: number): RecapBeats {
  const D = round3(totalSec);
  const rise = round3(Math.min(0.4, 0.05 * D));
  const stagger = round3(Math.min(0.35, 0.04 * D));
  const cut1 = round3(0.1 * D);
  const cut2 = round3(Math.min(0.5 * D, cut1 + (cardCount + 1) * stagger + rise + 0.4));
  return { total: D, cuts: [cut1, cut2], rise, stagger };
}

/* ── geometry ── */

export type RecapRect = { x: number; y: number; w: number; h: number };
export type RecapBlock = { fit: TextFit; rect: RecapRect };

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
export function durationText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

/** The small line under a step's name: kind, duration, retries. */
export function stepMeta(step: RecapStep): string {
  const parts = [step.kind.toUpperCase()];
  if (step.durationSec !== null) parts.push(durationText(step.durationSec));
  if (step.retries > 0) parts.push(`retried x${step.retries}`);
  if (step.status === "skipped") parts.push("skipped");
  if (step.status === "running") parts.push("running");
  return parts.join(" - ");
}

/** The cards shown: all of them up to the cap, else the first cap-1 and a "+N more". */
export function shownSteps(steps: RecapStep[]): RecapStep[] {
  if (steps.length <= RUN_RECAP_SHOWN_STEPS) return steps;
  const head = steps.slice(0, RUN_RECAP_SHOWN_STEPS - 1);
  const rest = steps.slice(RUN_RECAP_SHOWN_STEPS - 1);
  const failed = rest.some((s) => s.status === "failed");
  return [...head, { name: `+${rest.length} more`, kind: "run", status: failed ? "failed" : "passed", durationSec: rest.reduce((a, s) => a + (s.durationSec ?? 0), 0), retries: 0, index: -1 }];
}

/**
 * Three bands, top to bottom, in every orientation: the header (chrome row,
 * status + workflow, trigger + when), the steps (a row of cards, or a list
 * in portrait), the outcome (result, summary, tiles, cost + link). Every
 * text rect is sized FROM its fitted block, so nothing can overflow.
 */
export function layoutRunRecap(copy: RecapCopy, W: number, H: number): RecapLayout {
  const S = Math.min(W, H);
  const stacked = W / H < 0.9;
  const margin = Math.round(0.05 * S);
  const gap = Math.round(0.018 * S);
  const x0 = margin;
  const cw = W - 2 * margin;
  const clamp = (r: RecapRect): RecapRect => {
    const x = Math.max(0, Math.min(W - 1, Math.round(r.x)));
    const y = Math.max(0, Math.min(H - 1, Math.round(r.y)));
    return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w))), h: Math.max(1, Math.min(H - y, Math.round(r.h))) };
  };
  const at = (fit: TextFit, rect: RecapRect): RecapBlock => ({ fit, rect });

  // ── chrome row: wordmark (or logo) left, kicker right ──
  const rowH = Math.max(10, Math.round(0.036 * S));
  const wmFit = fitText(copy.brandName.toUpperCase(), budget(Math.round(cw * 0.55)), rowH, Math.round(0.026 * S), 8, 1, "bold");
  const logo = copy.hasLogo ? clamp({ x: x0, y: Math.round(0.035 * S), w: Math.round(Math.min(cw * 0.5, 0.36 * W)), h: Math.round(0.08 * S) }) : null;
  const wmY = logo ? logo.y + Math.round((logo.h - wmFit.h) / 2) : Math.round(0.045 * S);
  const wordmark = at(wmFit, clamp({ x: x0, y: wmY, w: Math.round(cw * 0.55), h: wmFit.h }));
  const kickerFit = copy.kicker ? fitText(copy.kicker.toUpperCase(), budget(Math.round(cw * 0.4)), rowH, Math.round(0.024 * S), 8, 1, "regular") : null;
  const kicker = kickerFit ? at(kickerFit, clamp({ x: x0 + cw - Math.round(cw * 0.4), y: wmY + Math.round((wmFit.h - kickerFit.h) / 2), w: Math.round(cw * 0.4), h: kickerFit.h })) : null;
  const chromeBottom = logo ? logo.y + logo.h : wordmark.rect.y + wordmark.rect.h;

  // ── header: status badge + workflow name, then trigger and when ──
  const titlePx = Math.round(0.064 * S);
  const badgeText = fitText(STATUS_WORDS[copy.status].toUpperCase(), budget(Math.round(cw * 0.3)), titlePx * 1.3, Math.round(0.024 * S), 8, 1, "bold");
  const badgeH = badgeText.h + Math.round(badgeText.px * 0.6);
  const badgeW = Math.ceil(badgeText.width / 0.94) + Math.round(badgeText.px * 1.6);
  const titleY = chromeBottom + Math.round(0.04 * S);
  const titleFit = fitText(copy.workflowName, budget(cw - badgeW - gap), titlePx * 1.4, titlePx, 12, 1, "bold");
  const titleH = Math.max(titleFit.h, badgeH);
  const badge = clamp({ x: x0, y: titleY + (titleH - badgeH) / 2, w: badgeW, h: badgeH });
  const title = at(titleFit, clamp({ x: x0 + badgeW + gap, y: titleY + (titleH - titleFit.h) / 2, w: cw - badgeW - gap, h: titleFit.h }));
  const subPx = Math.round(0.028 * S);
  const whenText = [copy.startedLabel, copy.durationLabel].filter(Boolean).join("  -  ");
  const whenFit = whenText ? fitText(whenText, budget(Math.round(cw * 0.42)), subPx * 1.6, subPx, 8, 1, "regular") : null;
  const triggerW = whenFit ? cw - Math.round(cw * 0.42) - gap : cw;
  const triggerFit = copy.triggerLabel ? fitText(copy.triggerLabel, budget(triggerW), subPx * 1.6, subPx, 8, 1, "regular") : null;
  const subY = titleY + titleH + Math.round(gap * 0.7);
  const trigger = triggerFit ? at(triggerFit, clamp({ x: x0, y: subY, w: triggerW, h: triggerFit.h })) : null;
  const when = whenFit ? at(whenFit, clamp({ x: x0 + cw - Math.round(cw * 0.42), y: subY, w: Math.round(cw * 0.42), h: whenFit.h })) : null;
  const headerEnd = trigger || when ? subY + Math.max(trigger?.rect.h ?? 0, when?.rect.h ?? 0) : titleY + titleH;

  // ── progress line, and the vertical budget below the header ──
  const barH = Math.max(3, Math.round(0.006 * S));
  const bar: RecapRect = { x: 0, y: H - barH, w: W, h: barH };
  const bodyY0 = headerEnd + Math.round(0.045 * S);
  const bodyY1 = H - barH - Math.round(0.045 * S);
  const bodyH = Math.max(1, bodyY1 - bodyY0);

  // ── the steps ──
  const shown = shownSteps(copy.steps);
  const n = shown.length;
  const cards: RecapCard[] = [];
  let rail: RecapRect | null = null;
  let stepsEnd: number;
  const namePx = Math.round(0.024 * S);
  const metaPx = Math.round(0.018 * S);
  const dotD = Math.max(6, Math.round(0.014 * S));
  const pad = Math.round(0.014 * S);
  if (!stacked) {
    // One shared height, sized from the tallest card's content under a cap:
    // dot, name (two lines at most), meta right under it.
    const cap = Math.round(Math.min(0.17 * H, 0.3 * bodyH));
    const cardW = Math.floor((cw - gap * (n - 1)) / n);
    const innerW = cardW - 2 * pad;
    const fitted = shown.map((step) => ({
      step,
      nameFit: fitText(step.name, budget(innerW), cap * 0.5, namePx, 8, 2, "bold"),
      metaFit: fitText(stepMeta(step), budget(innerW), cap * 0.4, metaPx, 7, 2, "regular"),
    }));
    const needed = fitted.reduce((m, f) => Math.max(m, pad + dotD + Math.round(pad * 0.6) + f.nameFit.h + Math.round(gap * 0.3) + f.metaFit.h + pad), 0);
    const cardH = Math.min(cap, needed);
    rail = clamp({ x: x0, y: bodyY0 + cardH / 2 - 1, w: cw, h: Math.max(2, Math.round(0.003 * S)) });
    fitted.forEach(({ step, nameFit, metaFit }, i) => {
      const rect = clamp({ x: x0 + i * (cardW + gap), y: bodyY0, w: cardW, h: cardH });
      const dot = clamp({ x: rect.x + pad, y: rect.y + pad, w: dotD, h: dotD });
      const nameY = dot.y + dot.h + Math.round(pad * 0.6);
      const nameRect = clamp({ x: rect.x + pad, y: nameY, w: innerW, h: nameFit.h });
      const metaRect = clamp({ x: rect.x + pad, y: nameRect.y + nameRect.h + Math.round(gap * 0.3), w: innerW, h: metaFit.h });
      cards.push({ step, rect, dot, name: at(nameFit, nameRect), meta: at(metaFit, metaRect) });
    });
    stepsEnd = bodyY0 + cardH;
  } else {
    const rowHh = Math.round(Math.min(0.055 * H, (0.42 * bodyH - gap * (n - 1)) / n));
    shown.forEach((step, i) => {
      const rect = clamp({ x: x0, y: bodyY0 + i * (rowHh + gap), w: cw, h: rowHh });
      const dot = clamp({ x: rect.x + pad, y: rect.y + (rect.h - dotD) / 2, w: dotD, h: dotD });
      const textX = dot.x + dot.w + pad;
      const metaW = Math.round(cw * 0.38);
      const nameW = rect.x + rect.w - pad - metaW - gap - textX;
      const nameFit = fitText(step.name, budget(nameW), rowHh * 0.8, namePx, 8, 1, "bold");
      const metaFit = fitText(stepMeta(step), budget(metaW), rowHh * 0.7, metaPx, 7, 1, "regular");
      cards.push({
        step,
        rect,
        dot,
        name: at(nameFit, clamp({ x: textX, y: rect.y + (rect.h - nameFit.h) / 2, w: nameW, h: nameFit.h })),
        meta: at(metaFit, clamp({ x: rect.x + rect.w - pad - metaW, y: rect.y + (rect.h - metaFit.h) / 2, w: metaW, h: metaFit.h })),
      });
    });
    stepsEnd = bodyY0 + n * rowHh + (n - 1) * gap;
  }

  // ── the outcome ──
  const oy0 = stepsEnd + Math.round(0.045 * S);
  const oH = Math.max(1, bodyY1 - oy0);
  const outcomeFit = fitText(copy.outcomeTitle, budget(cw), oH * 0.3, Math.round(0.046 * S), 10, 2, "bold");
  const summaryFit = copy.summary ? fitText(copy.summary, budget(Math.round(cw * (stacked ? 1 : 0.8))), oH * 0.32, Math.round(0.027 * S), 8, 3, "regular") : null;
  const m = Math.min(RUN_RECAP_MAX_STATS, copy.stats.length);
  const tileH = m > 0 ? Math.round(Math.min(0.13 * S, oH * 0.3)) : 0;
  const costFit = copy.costLabel ? fitText(copy.costLabel, budget(Math.round(cw * 0.6)), oH * 0.12, Math.round(0.022 * S), 7, 1, "regular") : null;
  const urlFit = copy.outcomeUrl ? fitText(copy.outcomeUrl, budget(Math.round(cw * 0.5)), oH * 0.12, Math.round(0.024 * S), 7, 1, "bold") : null;
  const pillH = urlFit ? urlFit.h + Math.round(urlFit.px * 0.7) : 0;
  const lastH = Math.max(costFit?.h ?? 0, pillH);
  const heights = [outcomeFit.h, summaryFit?.h ?? 0, tileH, lastH];
  const total = heights.reduce((a, b) => a + b, 0) + gap * (heights.filter((h) => h > 0).length - 1);
  let y = oy0 + Math.max(0, Math.min((oH - total) / 2, Math.round(0.03 * S)));
  const outcome = at(outcomeFit, clamp({ x: x0, y, w: cw, h: outcomeFit.h }));
  y += outcomeFit.h + gap;
  let summary: RecapBlock | null = null;
  if (summaryFit) {
    summary = at(summaryFit, clamp({ x: x0, y, w: Math.round(cw * (stacked ? 1 : 0.8)), h: summaryFit.h }));
    y += summaryFit.h + gap;
  }
  const tiles: RecapTile[] = [];
  if (m > 0) {
    const tileW = Math.floor((cw - gap * (m - 1)) / m);
    const valuePx = Math.round(0.04 * S);
    const labelPx = Math.round(0.02 * S);
    copy.stats.slice(0, m).forEach((stat, i) => {
      const rect = clamp({ x: x0 + i * (tileW + gap), y, w: tileW, h: tileH });
      const innerW = rect.w - 2 * pad;
      const valueFit = fitText(stat.value, budget(innerW), tileH * 0.55, valuePx, 8, 1, "bold");
      const labelFit = fitText(stat.label.toUpperCase(), budget(innerW), tileH * 0.3, labelPx, 7, 1, "regular");
      const blockH = valueFit.h + labelFit.h;
      const top = rect.y + Math.max(pad * 0.5, (rect.h - blockH) / 2);
      tiles.push({
        stat,
        index: i,
        rect,
        value: at(valueFit, clamp({ x: rect.x + pad, y: top, w: innerW, h: valueFit.h })),
        label: at(labelFit, clamp({ x: rect.x + pad, y: top + valueFit.h, w: innerW, h: labelFit.h })),
      });
    });
    y += tileH + gap;
  }
  let pill: RecapRect | null = null;
  if (urlFit) {
    const pw = Math.min(Math.round(cw * 0.5), Math.ceil(urlFit.width / 0.94) + Math.round(urlFit.px * 1.6));
    pill = clamp({ x: x0 + cw - pw, y: y + (lastH - pillH) / 2, w: pw, h: pillH });
  }
  const cost = costFit ? at(costFit, clamp({ x: x0, y: y + (lastH - costFit.h) / 2, w: Math.round(cw * 0.6), h: costFit.h })) : null;

  return { W, H, stacked, wordmark, logo, kicker, badge, badgeText, title, trigger, when, rail, cards, outcome, summary, tiles, cost, pill, url: urlFit, bar };
}

/** What the geometry promises, label by label. */
export function runRecapContract(L: RecapLayout): LayoutConstraint[] {
  const out: LayoutConstraint[] = [];
  const fits = (label: string, fit: TextFit | null | undefined) => {
    if (fit) out.push(textFitsMeasured(label, fit.lines.join("\n"), fit.px, fit.width));
  };
  if (!L.logo) fits("wordmark", L.wordmark.fit);
  fits("kicker", L.kicker?.fit);
  fits("status", L.badgeText);
  fits("workflow", L.title.fit);
  fits("trigger", L.trigger?.fit);
  fits("when", L.when?.fit);
  L.cards.forEach((c, i) => {
    fits(`step-${i}-name`, c.name.fit);
    fits(`step-${i}-meta`, c.meta.fit);
    out.push({ label: `step-${i}-dot`, aspect: 1, aspectTolerance: 0.2 });
  });
  fits("outcome", L.outcome.fit);
  fits("summary", L.summary?.fit);
  L.tiles.forEach((t, i) => {
    fits(`stat-${i}-value`, t.value.fit);
    fits(`stat-${i}-label`, t.label.fit);
  });
  fits("cost", L.cost?.fit);
  fits("url", L.url);
  out.push({ label: L.logo ? "logo" : "wordmark", within: { yFrac: [0, 0.2] } });
  out.push({ label: "progress", minWidthFrac: 0.98, within: { yFrac: [0.9, 1] } });
  return out;
}

export const RunRecapV1 = defineMosaicTemplate<RunRecapProps>({
  id: asTemplateId(ID),
  capabilities: { tier: "core" },

  outputHints: {
    ...RECAP_PLATFORMS[DEFAULTS.platform],
    fps: 30,
    durationMs: DEFAULTS.durationSec * 1000,
    format: { kind: "video", container: "mp4" },
    note: "The canvas follows the platform knob (chat 1920x1080 by default; email is 720p, square keeps the step row, mobile lists the steps); an explicit -w/-h wins. The clip is durationSec long; an explicit --durationMs overrides it.",
  },
  // The canvas and the length are knobs: a host seeds its Device and Duration
  // fields from the props and re-seeds when they change. Never throws.
  resolveOutputHints: (props) => {
    const key = typeof props?.platform === "string" ? props.platform.trim().toLowerCase() : "";
    const dims = RECAP_PLATFORMS[(key in RECAP_PLATFORMS ? key : DEFAULTS.platform) as RecapPlatform];
    const sec = numberOr(props?.durationSec, DEFAULTS.durationSec, RUN_RECAP_MIN_SEC, RUN_RECAP_MAX_SEC);
    return { ...dims, durationMs: Math.round(sec * 1000) };
  },

  propsSchema,
  defaultProps: {
    platform: DEFAULTS.platform,
    brandName: DEFAULTS.brandName,
    brandLogo: [],
    kicker: DEFAULTS.kicker,
    workflowName: DEFAULTS.workflowName,
    status: DEFAULTS.status,
    triggerLabel: DEFAULTS.triggerLabel,
    startedLabel: DEFAULTS.startedLabel,
    durationLabel: DEFAULTS.durationLabel,
    steps: DEFAULTS.steps.map((s) => ({ ...s })),
    outcomeTitle: DEFAULTS.outcomeTitle,
    summary: DEFAULTS.summary,
    stats: DEFAULTS.stats.map((s) => ({ ...s })),
    costLabel: DEFAULTS.costLabel,
    outcomeUrl: DEFAULTS.outcomeUrl,
    theme: DEFAULTS.theme,
    accent: DEFAULTS.accent,
    durationSec: DEFAULTS.durationSec,
    debugLayout: false,
  },
  // `background` is the document's own fill; `ink` and the length can carry a
  // handle and deliberately do not. `status` and `theme` are closed sets.
  bindings: { unbound: { background: "canvas", ink: "theme", durationSec: "timing" } },

  render,
});

export default RunRecapV1;

/* ── input: the schema is documentation, render() is the gate ── */

function numberOr(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** undefined = the default, "" = removed. */
function pickText(value: unknown, fallback: string, name: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`${ID}: ${name} must be a string.`);
  return cleanCopy(value);
}

function pickColor(value: unknown, fallback: string, name: string): MosaicColor {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length === 0) return fallback as MosaicColor;
  if (!HEX.test(s)) throw new Error(`${ID}: ${name} ${JSON.stringify(value)} must be #rrggbb.`);
  return s as MosaicColor;
}

function pickInt(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${ID}: ${name} must be a whole number from ${min} to ${max}. Got ${JSON.stringify(value)}.`);
  }
  return n;
}

function pickChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T, name: string): T {
  if (value === undefined || value === null || value === "") return fallback;
  const s = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
  if (!(choices as readonly string[]).includes(s)) {
    throw new Error(`${ID}: ${name} must be one of ${choices.join(", ")}. Got ${JSON.stringify(value)}.`);
  }
  return s as T;
}

/** An editor may deliver a json prop as a string; a row export may too. */
function pickJson(value: unknown, name: string): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${ID}: ${name} is not valid JSON.`);
  }
}

function pickSteps(value: unknown): RecapStep[] {
  const v = pickJson(value, "steps");
  if (v === undefined || v === null) return DEFAULTS.steps.map((s, i) => normalizeStep(s, i));
  if (!Array.isArray(v) || v.length < 1 || v.length > RUN_RECAP_MAX_STEPS) {
    throw new Error(`${ID}: steps must be an array of 1 to ${RUN_RECAP_MAX_STEPS} steps.`);
  }
  return v.map((s, i) => normalizeStep(s, i));
}

function normalizeStep(raw: unknown, i: number): RecapStep {
  if (!raw || typeof raw !== "object") throw new Error(`${ID}: steps[${i}] must be an object.`);
  const s = raw as Record<string, unknown>;
  const name = pickText(s.name, "", `steps[${i}].name`);
  if (!name) throw new Error(`${ID}: steps[${i}].name is required.`);
  const dur = s.durationSec;
  let durationSec: number | null = null;
  if (dur !== undefined && dur !== null && dur !== "") {
    const n = typeof dur === "string" ? Number(dur) : dur;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error(`${ID}: steps[${i}].durationSec must be a number >= 0.`);
    durationSec = n;
  }
  return {
    name,
    kind: pickChoice(s.kind, STEP_KINDS, "run", `steps[${i}].kind`),
    status: pickChoice(s.status, STEP_STATUSES, "passed", `steps[${i}].status`),
    durationSec,
    retries: pickInt(s.retries, 0, 0, 99, `steps[${i}].retries`),
    index: i,
  };
}

function pickStats(value: unknown): RunStat[] {
  const v = pickJson(value, "stats");
  if (v === undefined || v === null) return DEFAULTS.stats.map((s) => ({ ...s }));
  if (!Array.isArray(v)) throw new Error(`${ID}: stats must be an array of { label, value }.`);
  return v.slice(0, RUN_RECAP_MAX_STATS).map((raw, i) => {
    if (!raw || typeof raw !== "object") throw new Error(`${ID}: stats[${i}] must be an object.`);
    const s = raw as Record<string, unknown>;
    const label = pickText(s.label, "", `stats[${i}].label`);
    const val = s.value;
    const value = typeof val === "number" ? String(val) : pickText(val, "", `stats[${i}].value`);
    if (!label || !value) throw new Error(`${ID}: stats[${i}] needs a label and a value.`);
    return { label, value };
  });
}

/** A zero-or-one media prop: an array of path strings; more than one is an error. */
function pickMedia(value: unknown, name: string): string {
  if (value === undefined || value === null) return "";
  if (!Array.isArray(value)) throw new Error(`${ID}: ${name} must be an array of zero or one path.`);
  const refs = value.map((v) => String(v).trim()).filter(Boolean);
  if (refs.length > 1) throw new Error(`${ID}: ${name} accepts zero or one file (got ${refs.length}).`);
  return refs[0] ?? "";
}

const ASSET_ID_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

function mediaKindOf(ctx: MosaicEngineContext, assetId: string, ref: string): "image" | "video" {
  const known = ctx.media?.[assetId as keyof NonNullable<typeof ctx.media>] as { kind?: string } | undefined;
  if (known?.kind === "video" || known?.kind === "image") return known.kind;
  return VIDEO_EXT.test(ref) ? "video" : "image";
}

/* ── colour ── */

function rgb(c: MosaicColor): [number, number, number] {
  const n = parseInt(String(c).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: MosaicColor, b: MosaicColor, t: number): MosaicColor {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const ch = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  return `#${((1 << 24) + (ch(ar, br) << 16) + (ch(ag, bg) << 8) + ch(ab, bb)).toString(16).slice(1)}` as MosaicColor;
}

function luminance(c: MosaicColor): number {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function onColor(fill: MosaicColor, a: MosaicColor, b: MosaicColor): MosaicColor {
  const l = luminance(fill);
  return Math.abs(luminance(a) - l) >= Math.abs(luminance(b) - l) ? a : b;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ── sources ── */

function textSource(fit: TextFit, color: MosaicColor, label: string, overlay: MosaicOverlayExpr | undefined, hAlign: "left" | "center" | "right" = "left"): MosaicSource {
  return tag({
    type: "text",
    rasterizer: "svg",
    renderMode: { kind: "image" },
    layers: [
      {
        content: { kind: "literal", text: fit.lines.join("\n") },
        style: {
          fontSize: fit.px,
          fontColor: color,
          ...(fit.face === "bold" ? { fontWeight: "bold" } : {}),
          ...(fit.face === "italic" ? { fontStyle: "italic" } : {}),
        },
        placement: { hAlign, vAlign: "middle" },
      },
    ],
    ...(overlay ? { overlay } : {}),
    editor: { owner: "template" },
  } as MosaicSource, label);
}

async function render(props: RunRecapProps, ctx: MosaicEngineContext): Promise<MosaicDocument> {
  const brandName = pickText(props.brandName, DEFAULTS.brandName, "brandName");
  if (!brandName) throw new Error(`${ID}: brandName is required - the report is from someone.`);
  const workflowName = pickText(props.workflowName, DEFAULTS.workflowName, "workflowName");
  if (!workflowName) throw new Error(`${ID}: workflowName is required - the report is about a run.`);
  const outcomeTitle = pickText(props.outcomeTitle, DEFAULTS.outcomeTitle, "outcomeTitle");
  if (!outcomeTitle) throw new Error(`${ID}: outcomeTitle is required - the report says what came out.`);
  const logoRef = pickMedia(props.brandLogo, "brandLogo");
  // The canvas comes from ctx.target; the knob is still validated so a typo fails with a name.
  pickChoice(props.platform, RECAP_PLATFORM_KEYS, DEFAULTS.platform, "platform");
  const copy: RecapCopy = {
    brandName,
    hasLogo: logoRef.length > 0,
    kicker: pickText(props.kicker, DEFAULTS.kicker, "kicker"),
    workflowName,
    status: pickChoice(props.status, RUN_STATUSES, DEFAULTS.status, "status"),
    triggerLabel: pickText(props.triggerLabel, DEFAULTS.triggerLabel, "triggerLabel"),
    startedLabel: pickText(props.startedLabel, DEFAULTS.startedLabel, "startedLabel"),
    durationLabel: pickText(props.durationLabel, DEFAULTS.durationLabel, "durationLabel"),
    steps: pickSteps(props.steps),
    outcomeTitle,
    summary: pickText(props.summary, DEFAULTS.summary, "summary"),
    stats: pickStats(props.stats),
    costLabel: pickText(props.costLabel, DEFAULTS.costLabel, "costLabel"),
    outcomeUrl: pickText(props.outcomeUrl, DEFAULTS.outcomeUrl, "outcomeUrl"),
  };
  const theme = RECAP_THEME_COLORS[pickChoice(props.theme, RECAP_THEMES, DEFAULTS.theme, "theme")];
  const accent = pickColor(props.accent, DEFAULTS.accent, "accent");
  const bg = pickColor(props.background, theme.background, "background");
  const ink = pickColor(props.ink, theme.ink, "ink");
  const dim = mix(ink, bg, 0.6);
  const card = mix(ink, bg, 0.07);
  const railColor = mix(ink, bg, 0.18);
  const statusColor = STATUS_COLORS[copy.status] as MosaicColor;

  const assets: NonNullable<MosaicDocument["assets"]> = {};
  const logoId = logoRef ? asAssetId(ASSET_ID_RE.test(logoRef) ? logoRef : "brand-logo") : undefined;
  const logoKind = logoId ? mediaKindOf(ctx, String(logoId), logoRef) : "image";
  if (logoId) assets[logoId] = { kind: "file", path: logoRef, mediaType: logoKind };

  const pinned = resolvePinnedDurationMs(ctx);
  const durationMs = pinned !== undefined ? Math.round(pinned) : pickInt(props.durationSec, DEFAULTS.durationSec, RUN_RECAP_MIN_SEC, RUN_RECAP_MAX_SEC, "durationSec") * 1000;
  const W = Math.max(1, Math.round(ctx.target.width));
  const H = Math.max(1, Math.round(ctx.target.height));
  const L = layoutRunRecap(copy, W, H);
  const T = recapBeats(durationMs / 1000, L.cards.length);
  const [cut1, cut2] = T.cuts;

  /** Arrive `step` staggers into a beat and hold. Slides ride the overlay fast path; `rise` is for the few text blocks. */
  const arrive = (startSec: number, step: number, kind: "slide-up" | "rise" | "fade" = "slide-up") =>
    entrance({ kind, durationMs: T.rise * 1000, atSec: round3(startSec + step * T.stagger), ease: "easeOut" });

  const pieces: Parameters<typeof placeInsetPieces>[0]["pieces"] = [];
  const piece = (rect: RecapRect, importance: number, source: MosaicSource) => pieces.push({ rect: { ...rect, importance }, source });

  // ── chrome ──
  if (L.logo && logoId) {
    piece(L.logo, 1, bindProp(tag({
      type: "media",
      mediaType: logoKind,
      assetId: logoId,
      placement: { fit: "contain", hAlign: "left", vAlign: "middle" },
      ...(logoKind === "video" ? { loopMode: "loop", audio: { enabled: false } } : {}),
      editor: { owner: "template" },
    } as MosaicSource, "logo"), "brandLogo", 0));
  } else {
    // The wordmark carries both handles: the name to edit, and the logo slot as a drop target.
    piece(L.wordmark.rect, 1, bindProps(textSource(L.wordmark.fit, ink, "wordmark", undefined), [{ propKey: "brandName" }, { propKey: "brandLogo", index: 0 }]));
  }
  if (L.kicker) piece(L.kicker.rect, 1, bindProp(textSource(L.kicker.fit, dim, "kicker", undefined, "right"), "kicker"));
  piece(L.bar, 1, bindProp(tag(makeColorTile(accent, { overlay: { xExpr: `-W*(1-min(1,t/${T.total}))` } }) as MosaicSource, "progress"), "accent"));

  // ── header: static from frame 0 ──
  piece(L.badge, 2, tag(makeColorTile(statusColor, { effects: { rounding: { cornerStyle: "pill" } } }) as MosaicSource, "status-pill"));
  piece(L.badge, 3, textSource(L.badgeText, onColor(statusColor, bg, ink), "status", undefined, "center"));
  piece(L.title.rect, 2, bindProp(textSource(L.title.fit, ink, "workflow", undefined), "workflowName"));
  if (L.trigger) piece(L.trigger.rect, 2, bindProp(textSource(L.trigger.fit, dim, "trigger", undefined), "triggerLabel"));
  if (L.when) piece(L.when.rect, 2, bindProps(textSource(L.when.fit, dim, "when", undefined, "right"), [{ propKey: "startedLabel" }, { propKey: "durationLabel" }]));

  // ── the steps, one card at a time ──
  if (L.rail) piece(L.rail, 1, tag(makeColorTile(railColor, { overlay: arrive(cut1, 0, "fade") }) as MosaicSource, "rail"));
  L.cards.forEach((c, i) => {
    const motion = arrive(cut1, i + 1);
    const dotColor = STATUS_COLORS[c.step.status] as MosaicColor;
    const dot = { kind: "inline-mask" as const, ...circleMask(c.dot.w, c.dot.h) };
    piece(c.rect, 2, tag(makeColorTile(card, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.25 } }, overlay: motion }) as MosaicSource, `step-${i}-card`));
    piece(c.dot, 3, tag(makeColorTile(dotColor, { mask: dot, overlay: motion }) as MosaicSource, `step-${i}-dot`));
    const nameSrc = textSource(c.name.fit, ink, `step-${i}-name`, motion);
    const metaSrc = textSource(c.meta.fit, c.step.kind === "agent" ? accent : dim, `step-${i}-meta`, motion, L.stacked ? "right" : "left");
    if (c.step.index >= 0) {
      piece(c.name.rect, 3, bindPropPath(nameSrc, "steps", [c.step.index, "name"], "string"));
      piece(c.meta.rect, 3, bindPropPath(metaSrc, "steps", [c.step.index, "durationSec"], "number"));
    } else {
      piece(c.name.rect, 3, nameSrc);
      piece(c.meta.rect, 3, metaSrc);
    }
  });

  // ── the outcome: holds to the last frame ──
  piece(L.outcome.rect, 2, bindProp(textSource(L.outcome.fit, ink, "outcome", arrive(cut2, 0, "rise")), "outcomeTitle"));
  if (L.summary) piece(L.summary.rect, 2, bindProp(textSource(L.summary.fit, dim, "summary", arrive(cut2, 1, "rise")), "summary"));
  L.tiles.forEach((t, i) => {
    const motion = arrive(cut2, 2 + i);
    piece(t.rect, 2, tag(makeColorTile(card, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.25 } }, overlay: motion }) as MosaicSource, `stat-${i}-tile`));
    piece(t.value.rect, 3, bindPropPath(textSource(t.value.fit, ink, `stat-${i}-value`, motion), "stats", [t.index, "value"], "string"));
    piece(t.label.rect, 3, bindPropPath(textSource(t.label.fit, dim, `stat-${i}-label`, motion), "stats", [t.index, "label"], "string"));
  });
  const lastStep = 2 + L.tiles.length;
  if (L.cost) piece(L.cost.rect, 2, bindProp(textSource(L.cost.fit, dim, "cost", arrive(cut2, lastStep, "rise")), "costLabel"));
  if (L.pill && L.url) {
    const motion = arrive(cut2, lastStep, "fade");
    piece(L.pill, 2, tag(makeColorTile(accent, { effects: { rounding: { cornerStyle: "pill" } }, overlay: motion }) as MosaicSource, "url-pill"));
    piece(L.pill, 3, bindProp(textSource(L.url, onColor(accent, bg, ink), "url", motion, "center"), "outcomeUrl"));
  }

  const placed = placeInsetPieces({ rootW: W, rootH: H, pieces });
  const doc: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: toM0String(placed.m0, ID),
    assets,
    size: { width: W, height: H },
    fps: ctx.target.fps,
    durationMs,
    backgroundColor: bg,
    sources: placed.sources,
    editor: { label: `Run Recap - ${copy.workflowName} (${STATUS_WORDS[copy.status]})` },
  };
  return withLayoutIntent(doc, ctx, { templateId: ID, constraints: runRecapContract(L), debug: props.debugLayout === true });
}
