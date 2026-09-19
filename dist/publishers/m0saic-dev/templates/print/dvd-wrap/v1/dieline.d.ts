import type { DielineSpec, ResolvedDieline } from "@m0saic/template-utils";
import type { DvdCaseType } from "./props";
export type DvdPanelId = "back" | "spine" | "front";
export declare const DVD_PANEL_HEIGHT_MM = 184;
export declare const DVD_PANEL_WIDTH_MM = 130;
export declare const DVD_SAFE_MARGIN_MM = 5;
export declare function dvdSpineWidthMm(caseType: DvdCaseType, discCount: number): number;
export declare function buildDvdDielineSpec(args: {
    caseType: DvdCaseType;
    discCount: number;
    spineWidthMm?: number;
    bleedMm: number;
}): DielineSpec<DvdPanelId>;
/** Snap tolerance in px for a given DPI — ±0.25mm at 300 DPI, never 0. */
export declare function dvdLatticeSnapTolerancePx(dpi: number): number;
export declare function resolveDvdDieline(args: {
    caseType: DvdCaseType;
    discCount: number;
    spineWidthMm?: number;
    bleedMm: number;
    dpi: number;
}): ResolvedDieline<DvdPanelId>;
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
export declare function dvdFitDpiToTarget(args: {
    caseType: DvdCaseType;
    discCount: number;
    spineWidthMm?: number;
    bleedMm: number;
    dpi: number;
    target?: {
        width: number;
        height: number;
    } | null;
}): number;
