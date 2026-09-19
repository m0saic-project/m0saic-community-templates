import type {
  MosaicDocument,
  MosaicEngineContext,
  MosaicRenderableFile,
  MosaicColor,
  MosaicSource,
} from "@m0saic/types";
import { isValidM0String } from "@m0saic/dsl";
import {
  mmToPx,
  placeInsetPieces,
  snapPxToLatticeFriendly,
  type ResolvedDieline,
} from "@m0saic/template-utils";
import { applyDvdLayoutContract, checkDvdLayout, dvdLayoutConstraints } from "./contract";
import { dvdLatticeSnapTolerancePx, type DvdPanelId } from "./dieline";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";
import type { EffectiveDvdVariant } from "./variants";
import {
  buildPackagingSidecar,
  type DvdPackagingSidecar,
  type DvdValidationResult,
} from "./validation";
import { buildBackPanel, buildPackagingBarcode, type BarcodeBuild } from "./panels/back";
import {
  createDvdAssetRegistry,
  solidPiece,
  textSource,
  type PanelGeometry,
  type PanelPiece,
  type PxRect,
} from "./panels/common";
import { buildFrontPanel } from "./panels/front";
import { buildSpinePanel } from "./panels/spine";

type ArtifactRenderResult = {
  doc: MosaicDocument;
  sidecar: DvdPackagingSidecar;
  layoutViolations: unknown[];
};

function scaleRect(
  rect: { x: number; y: number; width: number; height: number },
  scale: number,
): PxRect {
  const x = Math.round(rect.x * scale);
  const y = Math.round(rect.y * scale);
  const right = Math.round((rect.x + rect.width) * scale);
  const bottom = Math.round((rect.y + rect.height) * scale);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function globalPanelGeometries(
  dieline: ResolvedDieline<DvdPanelId>,
  scale: number,
): Record<DvdPanelId, PanelGeometry> {
  const canvasW = Math.round(dieline.canvas.width * scale);
  const canvasH = Math.round(dieline.canvas.height * scale);
  const get = (id: DvdPanelId) => {
    const panel = dieline.panels.find((entry) => entry.id === id);
    if (!panel) throw new Error(`missing ${id} panel`);
    const trim = scaleRect(panel.trim, scale);
    let paint: PxRect;
    if (id === "back") paint = { x: 0, y: 0, w: trim.x + trim.w, h: canvasH };
    else if (id === "front") paint = { x: trim.x, y: 0, w: canvasW - trim.x, h: canvasH };
    else paint = { x: trim.x, y: 0, w: trim.w, h: canvasH };
    return {
      id,
      trim,
      paint,
      safe: scaleRect(panel.safe, scale),
      widthMm: panel.widthMm,
      heightMm: dieline.spec.heightMm,
      dpi: dieline.dpi * scale,
    };
  };
  return { back: get("back"), spine: get("spine"), front: get("front") };
}

function localPanelGeometry(
  dieline: ResolvedDieline<DvdPanelId>,
  id: DvdPanelId,
): PanelGeometry {
  const panel = dieline.panels.find((entry) => entry.id === id);
  if (!panel) throw new Error(`missing ${id} panel`);
  // Lattice-friendly canvas for the standalone panel artifact — same snap the
  // full-wrap dieline gets (a bare 130mm @300DPI lands on 1535 = 5·307, which
  // has no usable divisor pitch and would emit unit columns).
  const tolerancePx = dvdLatticeSnapTolerancePx(dieline.dpi);
  const w = snapPxToLatticeFriendly(mmToPx(panel.widthMm, dieline.dpi), { tolerancePx });
  const h = snapPxToLatticeFriendly(mmToPx(dieline.spec.heightMm, dieline.dpi), { tolerancePx });
  const panelSpec = dieline.spec.panels.find((entry) => entry.id === id);
  const safeInset = mmToPx(panelSpec?.safeMarginMm ?? dieline.spec.safeMarginMm, dieline.dpi);
  return {
    id,
    trim: { x: 0, y: 0, w, h },
    paint: { x: 0, y: 0, w, h },
    safe: { x: safeInset, y: safeInset, w: w - safeInset * 2, h: h - safeInset * 2 },
    widthMm: panel.widthMm,
    heightMm: dieline.spec.heightMm,
    dpi: dieline.dpi,
  };
}

function guideRectPieces(rect: PxRect, color: MosaicColor, label: string, thickness: number): PanelPiece[] {
  const t = Math.max(1, thickness);
  return [
    solidPiece({ x: rect.x, y: rect.y, w: rect.w, h: t }, color, `${label} top`, 20),
    solidPiece({ x: rect.x, y: rect.y + rect.h - t, w: rect.w, h: t }, color, `${label} bottom`, 20),
    solidPiece({ x: rect.x, y: rect.y, w: t, h: rect.h }, color, `${label} left`, 20),
    solidPiece({ x: rect.x + rect.w - t, y: rect.y, w: t, h: rect.h }, color, `${label} right`, 20),
  ];
}

function dielineGuidePieces(
  dieline: ResolvedDieline<DvdPanelId>,
  scale: number,
): PanelPiece[] {
  const thickness = Math.max(1, Math.round(scale * 2));
  const trim = scaleRect(dieline.trimBox, scale);
  const pieces = guideRectPieces(trim, "#00ffff@0.8", "trim guide", thickness);
  dieline.panels.forEach((panel) => pieces.push(...guideRectPieces(scaleRect(panel.safe, scale), "#00ff88@0.7", `${panel.id} safe guide`, thickness)));
  dieline.foldLinesX.forEach((x, index) => pieces.push(solidPiece(
    { x: Math.round(x * scale), y: 0, w: thickness, h: Math.round(dieline.canvas.height * scale) },
    "#ff3bd4@0.8",
    `fold guide ${index + 1}`,
    21,
  )));
  return pieces;
}

function proofBandPieces(args: {
  rect: PxRect;
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  dieline: ResolvedDieline<DvdPanelId>;
  barcode: BarcodeBuild;
}): PanelPiece[] {
  const { rect, props, variant, validation, dieline, barcode } = args;
  const errorCount = validation.diagnostics.filter((item) => item.severity === "error").length;
  const warnCount = validation.diagnostics.filter((item) => item.severity === "warn").length;
  const lines = [
    `${variant.skuLabel} | ${variant.profile.label} | ${variant.catalogNumber}`,
    // dieline.dpi, not props.dpi: a device/CLI canvas override scales the
    // render via the effective dpi — the proof must state what was printed.
    `${dieline.canvasWidthMm} x ${dieline.canvasHeightMm} mm | ${dieline.canvas.width} x ${dieline.canvas.height} px | ${Math.round(dieline.dpi)} DPI | RGB PNG`,
    `${variant.profile.barcodeSymbology.toUpperCase()} ${validation.normalizedBarcode} | module ${barcode.moduleWidthPx}px | ${barcode.achievedMagnificationPct.toFixed(1)}% magnification`,
    `${errorCount} errors | ${warnCount} warnings | placeholder badges ${props.usePlaceholderBadges ? "enabled" : "disabled"}`,
  ];
  const rowH = Math.max(1, Math.floor(rect.h / lines.length));
  const pieces: PanelPiece[] = [solidPiece(rect, "#f4f4f1", "proof metadata band", 0)];
  lines.forEach((line, index) => pieces.push({
    rect: { x: rect.x + Math.round(rect.w * 0.02), y: rect.y + index * rowH, w: Math.round(rect.w * 0.96), h: index === lines.length - 1 ? rect.h - index * rowH : rowH, importance: 2 },
    source: textSource({ text: line, fontSize: Math.max(8, rowH * 0.3), color: "#17191d", label: `proof metadata ${index + 1}`, hAlign: "left" }),
  }));
  return pieces;
}

function buildPiecesForPanels(args: {
  panelIds: DvdPanelId[];
  geometries: Record<DvdPanelId, PanelGeometry>;
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  assets: ReturnType<typeof createDvdAssetRegistry>;
}): {
  pieces: PanelPiece[];
  piecesByPanel: Record<DvdPanelId, PanelPiece[]>;
  childrenByPanel: Record<DvdPanelId, Record<string, MosaicRenderableFile>>;
  barcode?: BarcodeBuild;
} {
  const pieces: PanelPiece[] = [];
  const piecesByPanel: Record<DvdPanelId, PanelPiece[]> = {
    back: [],
    spine: [],
    front: [],
  };
  const childrenByPanel: Record<DvdPanelId, Record<string, MosaicRenderableFile>> = {
    back: {},
    spine: {},
    front: {},
  };
  let barcode: BarcodeBuild | undefined;
  for (const id of args.panelIds) {
    let panelPieces: PanelPiece[];
    if (id === "back") {
      const built = buildBackPanel({
        ...args,
        geometry: args.geometries.back,
        children: childrenByPanel.back,
      });
      panelPieces = built.pieces;
      barcode = built.barcode;
    } else if (id === "spine") {
      const built = buildSpinePanel({ ...args, geometry: args.geometries.spine });
      panelPieces = built.pieces;
      childrenByPanel.spine = built.children;
    } else {
      panelPieces = buildFrontPanel({ ...args, geometry: args.geometries.front });
    }
    piecesByPanel[id] = panelPieces;
    pieces.push(...panelPieces);
  }
  return { pieces, piecesByPanel, childrenByPanel, ...(barcode ? { barcode } : {}) };
}

function groupPiecesAsChild(args: {
  key: string;
  label: string;
  bounds: PxRect;
  pieces: PanelPiece[];
  children: Record<string, MosaicRenderableFile>;
  nestedChildren?: Record<string, MosaicRenderableFile>;
  assets: ReturnType<typeof createDvdAssetRegistry>["manifest"];
  backgroundColor?: MosaicColor;
  importance?: number;
}): PanelPiece {
  const normalized = args.pieces.map((piece) => ({
    ...piece,
    rect: {
      ...piece.rect,
      x: piece.rect.x - args.bounds.x,
      y: piece.rect.y - args.bounds.y,
    },
  }));
  const placed = placeInsetPieces({
    rootW: args.bounds.w,
    rootH: args.bounds.h,
    pieces: normalized,
  });
  if (!isValidM0String(String(placed.m0))) {
    throw new Error(`DVD ${args.label}: generated invalid child m0`);
  }
  args.children[args.key] = {
    kind: "mosaic_document",
    version: 1,
    m0: placed.m0,
    sources: placed.sources,
    assets: args.assets,
    ...(args.nestedChildren && Object.keys(args.nestedChildren).length
      ? { children: args.nestedChildren }
      : {}),
    size: { width: args.bounds.w, height: args.bounds.h },
    fps: 30,
    durationMs: 1000,
    backgroundColor: args.backgroundColor ?? "none",
    editor: { label: args.label },
  };
  const source: MosaicSource = {
    type: "mosaic",
    ref: args.key,
    placement: { fit: "contain" },
    editor: { owner: "template", label: args.label },
  };
  return {
    rect: { ...args.bounds, importance: args.importance ?? 1 },
    source,
  };
}

export function renderDvdArtifact(args: {
  artifact: DvdWrapArtifact;
  props: DvdWrapV1Props;
  variant: EffectiveDvdVariant;
  validation: DvdValidationResult;
  dieline: ResolvedDieline<DvdPanelId>;
  ctx: MosaicEngineContext;
}): ArtifactRenderResult {
  const { artifact, props, variant, validation, dieline, ctx } = args;
  const assets = createDvdAssetRegistry();
  const children: Record<string, MosaicRenderableFile> = {};
  let canvasW: number;
  let canvasH: number;
  let pieces: PanelPiece[];
  let backSafe: PxRect | undefined;
  let barcode: BarcodeBuild | undefined;

  if (artifact === "front" || artifact === "spine" || artifact === "back") {
    const geometry = localPanelGeometry(dieline, artifact);
    canvasW = geometry.trim.w;
    canvasH = geometry.trim.h;
    const geometries = { back: geometry, spine: geometry, front: geometry };
    const built = buildPiecesForPanels({ panelIds: [artifact], geometries, props, variant, validation, assets });
    pieces = [groupPiecesAsChild({
      key: `panel-${artifact}`,
      label: `${artifact} panel`,
      bounds: geometry.paint,
      pieces: built.piecesByPanel[artifact],
      children,
      nestedChildren: built.childrenByPanel[artifact],
      assets: assets.manifest,
      backgroundColor: "#10141d",
    })];
    barcode = built.barcode;
    if (artifact === "back") backSafe = geometry.safe;
  } else {
    const scale = artifact === "preview" ? 900 / dieline.canvas.width : 1;
    const geometries = globalPanelGeometries(dieline, scale);
    canvasW = Math.round(dieline.canvas.width * scale);
    const wrapH = Math.round(dieline.canvas.height * scale);
    const proofBandH = artifact === "proof" ? mmToPx(16, dieline.dpi) : 0;
    canvasH = wrapH + proofBandH;
    const built = buildPiecesForPanels({ panelIds: ["back", "spine", "front"], geometries, props, variant, validation, assets });
    pieces = (["back", "spine", "front"] as DvdPanelId[]).map((id) => groupPiecesAsChild({
      key: `panel-${id}`,
      label: `${id} panel`,
      bounds: geometries[id].paint,
      pieces: built.piecesByPanel[id],
      children,
      nestedChildren: built.childrenByPanel[id],
      assets: assets.manifest,
      backgroundColor: "#10141d",
    }));
    barcode = built.barcode;
    backSafe = geometries.back.safe;
    if (props.dielineOverlay || artifact === "proof") {
      pieces.push(groupPiecesAsChild({
        key: "dieline-guides",
        label: "dieline guides",
        bounds: { x: 0, y: 0, w: canvasW, h: wrapH },
        pieces: dielineGuidePieces(dieline, scale),
        children,
        assets: assets.manifest,
        importance: 20,
      }));
    }
    if (artifact === "proof") {
      const proofBarcode = barcode ?? buildPackagingBarcode(variant, validation.normalizedBarcode, dieline.dpi);
      const proofRect = { x: 0, y: wrapH, w: canvasW, h: proofBandH };
      pieces.push(groupPiecesAsChild({
        key: "proof-metadata",
        label: "proof metadata",
        bounds: proofRect,
        pieces: proofBandPieces({ rect: proofRect, props, variant, validation, dieline, barcode: proofBarcode }),
        children,
        assets: assets.manifest,
        backgroundColor: "#f4f4f1",
        importance: 20,
      }));
    }
  }

  barcode ??= buildPackagingBarcode(variant, validation.normalizedBarcode, dieline.dpi);
  const placed = placeInsetPieces({ rootW: canvasW, rootH: canvasH, pieces });
  if (!isValidM0String(String(placed.m0))) {
    throw new Error(`DVD ${artifact}: generated invalid m0`);
  }
  let doc: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: placed.m0,
    sources: placed.sources,
    assets: assets.manifest,
    ...(Object.keys(children).length ? { children } : {}),
    size: { width: canvasW, height: canvasH },
    fps: 30,
    durationMs: 1000,
    format: { kind: "image", container: "png", pixelFormat: "rgba" },
    backgroundColor: "#10141d",
    editor: { label: `${variant.skuLabel} ${artifact}` },
  };
  const constraints = dvdLayoutConstraints({ artifact, props, canvasW, canvasH, ...(backSafe ? { backSafe } : {}) });
  const layout = checkDvdLayout(doc, constraints);
  const sidecar = buildPackagingSidecar({
    artifact, props, variant, dieline, validation,
    moduleWidthPx: barcode.moduleWidthPx,
    achievedMagnificationPct: barcode.achievedMagnificationPct,
    layout: layout.violations,
  });
  doc = { ...doc, sidecars: { packaging: sidecar } };
  doc = applyDvdLayoutContract(doc, ctx, constraints, props.debugLayout ?? false);
  return { doc, sidecar, layoutViolations: layout.violations };
}
