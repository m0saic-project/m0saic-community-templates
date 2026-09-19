/**
 * Document builders — the nested-children architecture:
 *
 *   parent (WxH)   m0: F{labelRect?|barRect}   sources: [base, counter text?, tg_bar ref]
 *   └─ tg_bar (barW x barH): track + sliding fill + gated tip flash
 *
 * The bar child document is the CLIP BOUNDARY for the fill slide (the alpine
 * progress-card "plot child" mechanism): the fill tile spans the whole bar
 * and slides in from the left via `overlay.xExpr`, so whatever hangs past
 * x=0 is cut by the child canvas. The parent's `tg_bar` ref carries the
 * pill/rounded `effects.rounding`, which the engine applies to the rendered
 * child (buildChildMosaicSource merges parent-cell effects) — the whole bar,
 * fill and flash included, keeps the track's silhouette.
 */

import type {
  MosaicAsset,
  MosaicColor,
  MosaicDocument,
  MosaicSource,
  MosaicTextSource,
} from "@m0saic/types";
import { placeRects } from "@m0saic/dsl-stdlib";
import {
  type M0String,
  parseM0StringComplete,
  parseM0StringToRenderFrames,
} from "@m0saic/dsl";
import {
  bindProp,
  bindProps,
  makeColorTile,
  tag,
  transparentSlot,
} from "@m0saic/template-utils";

import type { ResolvedConfig } from "./resolve";
import { formatAmount } from "./resolve";
import {
  buildCounterTextExpr,
  buildFillXExpr,
  buildTipFlashGate,
} from "./schedule";
import { computeTipGoalGeometry, type Rect } from "./layout";

export type BaseMedia = {
  assetId: string;
  asset: MosaicAsset;
  mediaType: "video" | "image";
};

export type TipGoalStats = {
  anchorCount: number;
  tipCount: number;
  flashCount: number;
  fontPx: number;
  /** What the counter rendered as — the layout-contract gate keys off this. */
  counterKind: "expr" | "literal" | "none";
};

export type ComposeOutcome =
  | { ok: true; doc: MosaicDocument; stats: TipGoalStats; warnings: string[] }
  | { ok: false; code: string; message: string };

const asColor = (c: string): MosaicColor => c as MosaicColor;

export function buildTipGoalDoc(
  cfg: ResolvedConfig,
  W: number,
  H: number,
  fps: number,
  durationMs: number,
  base: BaseMedia | undefined,
): ComposeOutcome {
  const warnings: string[] = [];

  // The widest string the counter will show — the font auto-fit target.
  const maxShown = Math.max(cfg.finalAmount, cfg.startAmount, cfg.goalAmount);
  const sampleText = `${cfg.prefix}${formatAmount(maxShown)}${cfg.suffixText}`;

  const geomOut = computeTipGoalGeometry(
    W,
    H,
    {
      placement: cfg.bar.placement,
      widthFrac: cfg.bar.widthFrac,
      heightFrac: cfg.bar.heightFrac,
      marginFrac: cfg.bar.marginFrac,
      labelPlacement: cfg.label.placement,
      labelWidthFrac: cfg.label.widthFrac,
      fontScale: cfg.label.fontScale,
    },
    sampleText,
    cfg.layoutRect,
    cfg.geometryOverride,
  );
  if (!geomOut.ok) return geomOut;
  warnings.push(...geomOut.warnings);
  const geom = geomOut.geom;

  const rounding =
    cfg.bar.rounding >= 0.5
      ? ({ cornerStyle: "pill" } as const)
      : ({ cornerStyle: "rounded", borderRadius: cfg.bar.rounding } as const);

  // ── Fill motion ──
  const anchors = cfg.reduceMotion
    ? [{ t: 0, v: cfg.finalAmount }]
    : cfg.anchors;
  const fillX = buildFillXExpr(anchors, cfg.goalAmount);

  // ── Bar child: track + sliding fill + gated flash ──
  const barAssets: Record<string, MosaicAsset> = {};

  let trackSrc: MosaicSource;
  if (cfg.bar.trackImage) {
    barAssets["tg_track_img"] = assetFor(cfg.bar.trackImage, "image");
    trackSrc = coverImageSource("tg_track_img");
  } else {
    trackSrc = bindProp(makeColorTile(asColor(cfg.bar.trackColor)), "bar.trackColor");
  }
  trackSrc = tag(trackSrc, "track");

  let fillSrc: MosaicSource;
  if (cfg.bar.fillImage) {
    barAssets["tg_fill_img"] = assetFor(cfg.bar.fillImage, "image");
    fillSrc = {
      ...coverImageSource("tg_fill_img"),
      effects: { rounding },
      overlay: { xExpr: fillX },
    } as MosaicSource;
  } else {
    fillSrc = bindProp(
      makeColorTile(asColor(cfg.bar.fillColor), {
        effects: { rounding },
        overlay: { xExpr: fillX },
      }),
      "bar.fillColor",
    );
  }
  fillSrc = tag(fillSrc, "fill");

  const flashGate =
    cfg.bar.tipFlash && !cfg.reduceMotion
      ? buildTipFlashGate(cfg.tipTimes)
      : undefined;
  const flashSrc: MosaicSource | undefined = flashGate
    ? makeColorTile(asColor(cfg.bar.flashColor), {
        overlay: { enable: flashGate.enable, window: flashGate.window },
      })
    : undefined;

  const barLayers = [fillSrc, ...(flashSrc ? [flashSrc] : [])];
  const barChild: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: nestOverlays(barLayers.length),
    assets: barAssets,
    sources: [trackSrc, ...barLayers],
    size: { width: geom.barRect.w, height: geom.barRect.h },
  };

  // ── Counter text ──
  // The number hugs the bar: right-aligned when the label sits left of the
  // bar (the count-up grows leftward, the bar-adjacent edge stays put),
  // left-aligned when it sits right of / above the bar.
  const counterAlign = cfg.label.placement === "left" ? "right" : "left";
  let counterKind: TipGoalStats["counterKind"] = "none";
  let counterSrc: MosaicTextSource | undefined;
  if (geom.labelRect) {
    counterKind = cfg.reduceMotion ? "literal" : "expr";
    counterSrc =
      counterKind === "literal"
        ? counterLiteralSource(cfg, geom.fontPx, counterAlign, `${cfg.prefix}${formatAmount(cfg.finalAmount)}${cfg.suffixText}`)
        : counterExprSource(cfg, geom.fontPx, counterAlign);
    counterSrc = bindProps(tag(counterSrc, "counter"), [
      { propKey: "currency" },
      { propKey: "label.color" },
    ]);
  }

  // ── Parent ──
  const regions: Array<{ key: string; rect: Rect }> = [
    ...(geom.labelRect ? [{ key: "label", rect: geom.labelRect }] : []),
    { key: "bar", rect: geom.barRect },
  ];
  const bound = bindRects(regions, W, H, (key) =>
    key === "label"
      ? (counterSrc as MosaicSource)
      : tag({ type: "mosaic", ref: "tg_bar", effects: { rounding } } as MosaicSource, "bar"),
  );
  if (!bound.ok) return bound;

  const assets: Record<string, MosaicAsset> = {};
  let baseSource: MosaicSource;
  if (base) {
    assets[base.assetId] = base.asset;
    baseSource =
      base.mediaType === "video"
        ? ({
            type: "media",
            mediaType: "video",
            assetId: base.assetId as never,
            placement: { fit: "cover" },
            playback: { loopMode: "loop" },
          } as MosaicSource)
        : ({
            type: "media",
            mediaType: "image",
            assetId: base.assetId as never,
            placement: { fit: "cover" },
          } as MosaicSource);
    // `sourceId` is a media prop and media props are never bindable (the
    // shared classifier rejects them as unsupported-type), so the base carries
    // no binding — the file picker in the props panel is the swap surface.
  } else if (cfg.background.transparent) {
    baseSource = transparentSlot();
  } else {
    // Empty base: the demo color, editable in place.
    baseSource = bindProp(makeColorTile(asColor(cfg.background.color)), "backgroundColor");
  }

  // backgroundColor stays UNSET so a transparent standalone overlay keeps its
  // alpha on alpha-capable targets.
  const doc: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: `F{${bound.m0}}` as M0String,
    assets,
    sources: [baseSource, ...bound.sources],
    children: { tg_bar: barChild },
    size: { width: W, height: H },
    fps,
    durationMs,
  };

  return {
    ok: true,
    doc,
    warnings,
    stats: {
      anchorCount: anchors.length,
      tipCount: cfg.tipTimes.length,
      flashCount: flashGate ? cfg.tipTimes.length : 0,
      fontPx: geom.fontPx,
      counterKind,
    },
  };
}

// ── Counter sources ───────────────────────────────────────────────────────

function counterStyle(cfg: ResolvedConfig, fontPx: number) {
  const borderW = Math.round(fontPx * cfg.label.outlineFrac);
  return {
    fontSize: fontPx,
    fontColor: asColor(cfg.label.color),
    ...(cfg.label.bold ? { fontWeight: 700 as const } : {}),
    ...(borderW > 0
      ? { borderWidth: borderW, borderColor: asColor(cfg.label.outlineColor) }
      : {}),
  };
}

function counterExprSource(
  cfg: ResolvedConfig,
  fontPx: number,
  hAlign: "left" | "right",
): MosaicTextSource {
  const expr = buildCounterTextExpr(cfg.anchors, cfg.prefix, cfg.suffixText);
  return {
    type: "text",
    renderMode: { kind: "video" },
    visual: { backgroundColor: asColor("black@0") },
    layers: [
      {
        content: { kind: "expr", expr, eval: "frame" },
        style: counterStyle(cfg, fontPx),
        placement: { hAlign, vAlign: "middle" },
      },
    ],
  };
}

function counterLiteralSource(
  cfg: ResolvedConfig,
  fontPx: number,
  hAlign: "left" | "right",
  text: string,
): MosaicTextSource {
  return {
    type: "text",
    visual: { backgroundColor: asColor("black@0") },
    layers: [
      {
        content: { kind: "literal", text: text || " " },
        style: counterStyle(cfg, fontPx),
        placement: { fit: "contain", hAlign, vAlign: "middle" },
      },
    ],
  };
}

// ── Shared ────────────────────────────────────────────────────────────────

/** A user image stretched over the whole cell (keeps its own alpha). */
function coverImageSource(assetId: string): MosaicSource {
  return {
    type: "media",
    mediaType: "image",
    assetId: assetId as never,
    placement: { fit: "cover" },
  } as MosaicSource;
}

function assetFor(path: string, mediaType: "video" | "image"): MosaicAsset {
  return /^https?:\/\//i.test(path)
    ? ({ kind: "url", url: path, mediaType } as MosaicAsset)
    : ({ kind: "file", path, mediaType } as MosaicAsset);
}

/** `F` nested under `n` overlay layers: 0 → "F", 1 → "F{F}", 2 → "F{F{F}}"… */
export function nestOverlays(n: number): M0String {
  let s = "F";
  for (let i = 0; i < n; i++) s = `F{${s}}`;
  return s as M0String;
}

type BindOutcome =
  | { ok: true; m0: M0String; sources: MosaicSource[] }
  | { ok: false; code: string; message: string };

/**
 * placeRects + positional DFS binding (the beat-hero / scene-highlight
 * composeLayout mechanism): parse the emitted m0 back to render frames and
 * bind one source per frame by exact geometry match.
 */
function bindRects(
  regions: Array<{ key: string; rect: Rect }>,
  W: number,
  H: number,
  sourceForKey: (key: string) => MosaicSource,
): BindOutcome {
  let m0: M0String;
  try {
    m0 = placeRects({
      rootW: W,
      rootH: H,
      rects: regions.map((r) => ({ x: r.rect.x, y: r.rect.y, w: r.rect.w, h: r.rect.h })),
    }).m0;
  } catch (err_) {
    return {
      ok: false,
      code: "TG_LAYOUT_INTERNAL",
      message: `placeRects failed: ${err_ instanceof Error ? err_.message : String(err_)}`,
    };
  }
  const result = parseM0StringComplete(m0, W, H);
  const frames = result.ok ? result.ir.renderFrames : parseM0StringToRenderFrames(m0, W, H);
  const sources: MosaicSource[] = [];
  for (const f of frames) {
    const region = regions.find(
      (r) => r.rect.x === f.x && r.rect.y === f.y && r.rect.w === f.width && r.rect.h === f.height,
    );
    if (!region) continue; // empty/null cell
    sources.push(sourceForKey(region.key));
  }
  if (sources.length !== regions.length) {
    return {
      ok: false,
      code: "TG_LAYOUT_INTERNAL",
      message: `Region/source binding mismatch: ${sources.length} of ${regions.length} regions bound.`,
    };
  }
  return { ok: true, m0, sources };
}
