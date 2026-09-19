import type {
  MosaicEngineContext,
  MosaicRenderableFile,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import {
  defineMosaicTemplate,
  makeErrorMosaic,
  withLayoutContract,
} from "@m0saic/template-utils";

import { TipGoalPropsSchema, type TipGoalV1Props } from "./types";
import { resolveTipGoal } from "./resolve";
import { buildTipGoalDoc, type BaseMedia } from "./compose";

/**
 * Tip Goal — a streamer-style donation/tip progress bar attachable to any
 * video: a rounded track fills toward a goal while a currency counter ticks
 * up. The GENERATOR owns the timeline (seeded auto stream, exact tip rows,
 * or absolute amount keyframes), so the overlay can seed the "donations are
 * already coming in" look on pre-cut footage — or mirror a real tracker.
 *
 * Deterministic: output depends only on props + ctx.target. No RNG beyond
 * the seeded auto generator, no wall-clock; duration derives from
 * `ctx.target` → `ctx.output` → the probed base media → 15 s.
 */

const TEMPLATE_ID = "@m0saic-dev/creator/tip-goal/v1";
const DEFAULT_DURATION_MS = 15_000;
const DEFAULT_ERROR_WIDTH = 1920;
const DEFAULT_ERROR_HEIGHT = 1080;

const DESCRIPTION =
  "A streamer-style tip/donation goal bar for any video: a rounded track fills toward a goal while a currency counter ticks up. The generator owns the timeline — a seeded auto tip stream, exact tip rows, or absolute amount keyframes — with per-tip rise easing, tip flashes, preset placements plus an m0 escape hatch, and replaceable art.";

type MediaProbe = { kind?: string; durationMs?: number };

function probeMedia(
  ctx: MosaicEngineContext,
  path: string,
): MediaProbe | undefined {
  const registry = (ctx as { media?: Record<string, MediaProbe> }).media;
  return registry?.[path];
}

function resolveDurationMs(
  ctx: MosaicEngineContext,
  probe: MediaProbe | undefined,
): number {
  const t = ctx?.target?.durationMs;
  if (typeof t === "number" && Number.isFinite(t) && t > 0) return Math.round(t);
  const o = ctx?.output?.durationMs;
  if (typeof o === "number" && Number.isFinite(o) && o > 0) return Math.round(o);
  const p = probe?.durationMs;
  if (typeof p === "number" && Number.isFinite(p) && p > 0) return Math.round(p);
  return DEFAULT_DURATION_MS;
}

function tipGoalError(
  ctx: MosaicEngineContext,
  code: string,
  message: string,
) {
  return makeErrorMosaic(message, {
    width: ctx?.target?.width ?? DEFAULT_ERROR_WIDTH,
    height: ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT,
    title: "Tip Goal",
    errorCode: code,
  });
}

export const TipGoalV1 = defineMosaicTemplate<TipGoalV1Props>({
  id: asTemplateId(TEMPLATE_ID),
  label: "Tip Goal",
  version: 1,
  description: DESCRIPTION,
  role: "renderable",
  capabilities: { tier: "core" },
  tags: ["creator", "overlay", "donations", "goal", "renderable", "creators", "social", "animated", "streamer", "twitch", "youtube", "stream-overlay", "donation-bar"],
  internal: false,

  outputHints: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationMs: DEFAULT_DURATION_MS,
    posterTimeMs: 8000,
    note:
      "Overlay HUD. Standalone mode renders a transparent overlay when the background is alpha-0 — use an alpha-capable target (ProRes 4444 / webm yuva) to keep alpha, or compose it as a cell over other content.",
  },

  propsSchema: TipGoalPropsSchema,
  defaultProps: {
    goalAmount: 100,
    startAmount: 0,
    currency: "$",
    suffix: "",
    showGoal: false,
    riseSec: 0.6,
    riseEase: "easeOut",
    backgroundColor: "#101014",
    reduceMotion: false,
    auto: {
      seed: 1,
      tipCount: 12,
      curve: "big-finish",
      startDelaySec: 1.5,
      finishFrac: 0.9,
    },
    bar: {
      placement: "bottom",
      widthFrac: 0.94,
      heightFrac: 0.11,
      marginFrac: 0.05,
      rounding: 0.5,
      trackColor: "#ECECEC",
      fillColor: "#8B5CF6",
      tipFlash: true,
      flashColor: "#FFFFFF@0.4",
    },
    label: {
      placement: "left",
      widthFrac: 0.16,
      fontScale: 1,
      color: "#FFFFFF",
      outlineColor: "black@0.85",
      outlineFrac: 0.07,
      bold: true,
    },
    debugLayout: false,
  },

  async render(
    props: TipGoalV1Props,
    ctx: MosaicEngineContext,
  ): Promise<MosaicRenderableFile> {
    const W = ctx?.target?.width ?? DEFAULT_ERROR_WIDTH;
    const H = ctx?.target?.height ?? DEFAULT_ERROR_HEIGHT;
    const fps = ctx?.target?.fps ?? 30;

    // ── Base media (optional) ──
    const sourceId =
      typeof props.sourceId === "string" ? props.sourceId.trim() : "";
    let base: BaseMedia | undefined;
    let probe: MediaProbe | undefined;
    if (sourceId !== "") {
      probe = probeMedia(ctx, sourceId);
      if (probe?.kind === "audio") {
        return tipGoalError(
          ctx,
          "TG_SOURCE_KIND",
          `The source must be a video or image — ${JSON.stringify(sourceId)} probed as audio.`,
        );
      }
      const mediaType = probe?.kind === "image" ? "image" : "video";
      base = {
        assetId: "tg_base",
        asset: /^https?:\/\//i.test(sourceId)
          ? ({ kind: "url", url: sourceId, mediaType } as BaseMedia["asset"])
          : ({ kind: "file", path: sourceId, mediaType } as BaseMedia["asset"]),
        mediaType,
      };
    }

    const durationMs = resolveDurationMs(ctx, probe);
    const durationSec = durationMs / 1000;

    // ── Resolve props → canonical config ──
    const resolved = resolveTipGoal(props, W, H, durationSec);
    if (!resolved.ok) return tipGoalError(ctx, resolved.code, resolved.message);

    // ── Build the document ──
    const built = buildTipGoalDoc(resolved.cfg, W, H, fps, durationMs, base);
    if (!built.ok) return tipGoalError(ctx, built.code, built.message);

    // Dev tripwire (the upstream layout-contract convention): debugLayout
    // draws the contract wireframe; falsy returns the doc untouched at zero
    // cost. Text-fit only checks the LITERAL counter — expr layers have
    // nothing static to measure, and an expr-text source shifts the
    // contract's frames↔sources zip, so constraints gate on the literal path.
    return withLayoutContract(built.doc, ctx, {
      templateId: TEMPLATE_ID,
      constraints:
        built.stats.counterKind === "literal"
          ? [{ label: "counter", textFits: { charWidthEm: 0.62 } }]
          : [],
      debug: props.debugLayout === true,
    });
  },
});


