import type { DielineSpec, PrintRectPx, ResolvedDieline } from "@m0saic/template-utils";
import {
  resolveDieline,
  snapEdgesToLattice,
  snapPxToLatticeFriendly,
} from "@m0saic/template-utils";
import type { DvdCaseType } from "./props";

export type DvdPanelId = "back" | "spine" | "front";

export const DVD_PANEL_HEIGHT_MM = 184;
export const DVD_PANEL_WIDTH_MM = 130;
export const DVD_SAFE_MARGIN_MM = 5;

export function dvdSpineWidthMm(caseType: DvdCaseType, discCount: number): number {
  if (!Number.isInteger(discCount) || discCount < 1) {
    throw new Error("dvdSpineWidthMm: discCount must be a positive integer");
  }
  if (caseType === "slim") return 7;
  if (caseType === "standard") return 14;
  return 22 + Math.max(0, discCount - 2) * 4;
}

export function buildDvdDielineSpec(args: {
  caseType: DvdCaseType;
  discCount: number;
  spineWidthMm?: number;
  bleedMm: number;
}): DielineSpec<DvdPanelId> {
  const spineMm = args.spineWidthMm ?? dvdSpineWidthMm(args.caseType, args.discCount);
  if (!Number.isFinite(spineMm) || spineMm < 3) {
    throw new Error(`DVD spine width ${spineMm}mm must be at least 3mm`);
  }
  return {
    panels: [
      { id: "back", widthMm: DVD_PANEL_WIDTH_MM },
      { id: "spine", widthMm: spineMm, safeMarginMm: Math.min(2, spineMm / 4) },
      { id: "front", widthMm: DVD_PANEL_WIDTH_MM },
    ],
    heightMm: DVD_PANEL_HEIGHT_MM,
    bleedMm: args.bleedMm,
    safeMarginMm: DVD_SAFE_MARGIN_MM,
  };
}

/** Snap tolerance in px for a given DPI — ±0.25mm at 300 DPI, never 0. */
export function dvdLatticeSnapTolerancePx(dpi: number): number {
  return Math.max(1, Math.min(3, Math.round(dpi / 100)));
}

/** Clamp a safe rect (computed from raw mm) inside a snapped trim rect. */
function clampSafeIntoTrim(safe: PrintRectPx, trim: PrintRectPx): PrintRectPx {
  const x = Math.max(safe.x, trim.x);
  const right = Math.min(safe.x + safe.width, trim.x + trim.width);
  const y = Math.max(safe.y, trim.y);
  const bottom = Math.min(safe.y + safe.height, trim.y + trim.height);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

/**
 * Snap the resolved dieline's PIXEL breakpoints to lattice-friendly values.
 *
 * Why: the raw mm→px conversion lands on whatever integers the math gives —
 * at 300 DPI that's canvas 3307 and panel paint widths 1571, all PRIME. The
 * layout emitters (`placeInsetPieces`) need a divisor lattice per axis; a
 * prime axis is "hostile" and degrades to exact unit columns, which is how
 * this template's m0 ballooned to ~73K chars (96% passthrough donors). Moving
 * the seams/canvas by ≤3px (≤0.25mm at 300 DPI — far inside print/fold
 * tolerance) makes every panel axis divisor-rich and the emit collapses to a
 * coarse lattice + exact recovery insets.
 *
 * The snap is JOINT across [back seam, front seam, canvas W] so the panel
 * paint spans (back = 0..seam1, spine = seam1..seam2, front = seam2..W) and
 * the canvas itself are all friendly at once. mm fields keep the spec values
 * (human-facing labels); px is the layout truth.
 */
function snapDvdDielinePx(
  raw: ResolvedDieline<DvdPanelId>,
  dpi: number,
): ResolvedDieline<DvdPanelId> {
  const [back, spine, front] = raw.panels;
  const tolerancePx = dvdLatticeSnapTolerancePx(dpi);

  const seam1 = spine.trim.x;
  const seam2 = front.trim.x;
  const [s1, s2, canvasW] = snapEdgesToLattice([seam1, seam2, raw.canvas.width], {
    tolerancePx,
  });
  const canvasH = snapPxToLatticeFriendly(raw.canvas.height, { tolerancePx });

  // Bleed offsets are preserved exactly; the trim box follows the snapped
  // canvas so outer bleed strips keep their raw px width.
  const bleedLeft = raw.trimBox.x;
  const bleedRight = raw.canvas.width - (raw.trimBox.x + raw.trimBox.width);
  const bleedTop = raw.trimBox.y;
  const bleedBottom = raw.canvas.height - (raw.trimBox.y + raw.trimBox.height);
  const trimRight = canvasW - bleedRight;
  const trimBottom = canvasH - bleedBottom;
  const trimH = trimBottom - bleedTop;

  const trims: Record<DvdPanelId, PrintRectPx> = {
    back: { x: bleedLeft, y: bleedTop, width: s1 - bleedLeft, height: trimH },
    spine: { x: s1, y: bleedTop, width: s2 - s1, height: trimH },
    front: { x: s2, y: bleedTop, width: trimRight - s2, height: trimH },
  };

  const panels = [back, spine, front].map((panel) => ({
    ...panel,
    trim: trims[panel.id],
    safe: clampSafeIntoTrim(panel.safe, trims[panel.id]),
  }));

  return {
    ...raw,
    canvas: { x: 0, y: 0, width: canvasW, height: canvasH },
    bleedBox: { x: 0, y: 0, width: canvasW, height: canvasH },
    trimBox: { x: bleedLeft, y: bleedTop, width: trimRight - bleedLeft, height: trimH },
    panels,
    foldLinesX: [s1, s2],
  };
}

export function resolveDvdDieline(args: {
  caseType: DvdCaseType;
  discCount: number;
  spineWidthMm?: number;
  bleedMm: number;
  dpi: number;
}): ResolvedDieline<DvdPanelId> {
  return snapDvdDielinePx(resolveDieline(buildDvdDielineSpec(args), args.dpi), args.dpi);
}

/**
 * Effective DPI honoring a REQUESTED output canvas (Make's Device dims, the
 * CLI's required `-w`/`-h`). The wrap's canvas is physical — mm × dpi with a
 * fixed aspect — so "user override wins" means SCALING the render: the
 * effective dpi is `dpi ×` the largest uniform scale that fits the request
 * (aspect preserved; the result is a scaled proof at the honest dpi, which
 * the sidecar and proof band report).
 *
 * A request within the snap tolerance (+2px slack) of the NATURAL canvas
 * keeps the exact print dpi — this covers the outputHints default, and
 * stale pre-snap customs (e.g. 3307 vs the snapped 3304). Clamped to
 * [24, 600]; a missing/degenerate target is ignored.
 */
export function dvdFitDpiToTarget(args: {
  caseType: DvdCaseType;
  discCount: number;
  spineWidthMm?: number;
  bleedMm: number;
  dpi: number;
  target?: { width: number; height: number } | null;
}): number {
  const { target, dpi } = args;
  if (
    !target ||
    !Number.isFinite(target.width) ||
    !Number.isFinite(target.height) ||
    target.width < 1 ||
    target.height < 1
  ) {
    return dpi;
  }
  const natural = resolveDvdDieline({
    caseType: args.caseType,
    discCount: args.discCount,
    ...(args.spineWidthMm != null ? { spineWidthMm: args.spineWidthMm } : {}),
    bleedMm: args.bleedMm,
    dpi,
  });
  const tol = dvdLatticeSnapTolerancePx(dpi) + 2;
  if (
    Math.abs(target.width - natural.canvas.width) <= tol &&
    Math.abs(target.height - natural.canvas.height) <= tol
  ) {
    return dpi;
  }
  const scale = Math.min(
    target.width / natural.canvas.width,
    target.height / natural.canvas.height,
  );
  if (!Number.isFinite(scale) || scale <= 0) return dpi;
  return Math.min(600, Math.max(24, dpi * scale));
}
