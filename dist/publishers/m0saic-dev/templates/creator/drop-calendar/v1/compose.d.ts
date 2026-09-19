/**
 * Compose — every element of the calendar becomes a REAL m0 rect (the Rect
 * Thesis): pieces are gathered as integer pixel rects with paint importance
 * and laundered by `placeInsetPieces`, which owns the frame↔source mapping
 * (layer-major, quantized y/x) and emits zip-ordered `GeometryExpectation`s.
 *
 * Geometry is Recipe 2 inset recovery (basis 120): the m0 GCD-collapses ~6x
 * for heavy scenes and each source carries a recovery `placement.inset` that
 * paints it back on the EXACT computed rect — the engine bakes text canvases
 * and shrinks media/color destinations at the inset box. The old "exact
 * rects" mode (lattice pitch forced to 1) existed only so canvas selection
 * overlays aligned; Make's selection overlay now bakes insets in, so
 * recovery is the one path (founder 2026-09-15).
 *
 * Timing (cue highlights, the dim wash, spotlights) rides per-source
 * `overlay.enable` gates (`between(t,a,b)` unions), the tip-goal flash-gate
 * shape. Everything else is static text/color/media tiles.
 *
 * The one non-tile piece is the facecam when several clips are picked: those
 * become a stitched pipeline child (`children.dc_facecam_reel`) referenced by
 * the facecam cell — see `buildFacecamReelPipeline`.
 */
import type { MosaicDocument } from "@m0saic/types";
import { type GeometryExpectation } from "@m0saic/template-utils";
import type { MediaKind, ResolvedConfig } from "./resolve";
export type ComposeStats = {
    /** True when the doc has motion (facecam, cues, or teaser video in a cell). */
    animated: boolean;
    weekRows: number;
    cueCount: number;
    spotlightCount: number;
    sourceCount: number;
    /** Picked facecam regions (0 = the whole clip plays). */
    facecamClips: number;
};
export type ComposeOutcome = {
    ok: true;
    doc: MosaicDocument;
    stats: ComposeStats;
    warnings: string[];
    /** Zip-ordered zero-drift expectations (one per painted frame). */
    expectations: GeometryExpectation[];
} | {
    ok: false;
    code: string;
    message: string;
};
export declare function buildDropCalendarDoc(cfg: ResolvedConfig, W: number, H: number, fps: number, durationMs: number, classify: (path: string) => MediaKind): ComposeOutcome;
/** `children` key of the stitched facecam reel. */
export declare const FACECAM_REEL_REF = "dc_facecam_reel";
