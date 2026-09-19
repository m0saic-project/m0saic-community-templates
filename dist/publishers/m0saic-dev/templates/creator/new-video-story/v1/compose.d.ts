/**
 * Compose — every element of the story becomes a REAL m0 rect (the Rect
 * Thesis): pieces are gathered as integer pixel rects with paint importance
 * and laundered by `placeInsetPieces` (Recipe 2 inset recovery, basis 120),
 * which owns the frame↔source mapping and emits zip-ordered
 * `GeometryExpectation`s for the geometry contract.
 *
 * Paint order (importance, higher on top):
 *   screenshot / placeholder (0–1) → badge (2–3) → sticker lines (4–9, the
 *   big line over the badge's corner) → CTA frame + text (10–11) → arrows
 *   (12) → link pill body, glyph, text (13–15).
 *
 * Motion rides per-source `overlay` bundles from motion.ts; a still
 * (`animate: false`) carries no overlay at all. The stage colour is
 * `document.backgroundColor` (never a base layer).
 */
import type { MosaicDocument } from "@m0saic/types";
import { type GeometryExpectation } from "@m0saic/template-utils";
import { type Rect } from "./layout";
import type { MediaKind, ResolvedConfig } from "./resolve";
export type ComposeStats = {
    /** True when the doc has motion (animation on, or a video screenshot). */
    animated: boolean;
    hasMedia: boolean;
    mediaKind?: MediaKind;
    sourceCount: number;
    /** The rect the screenshot landed in (default slot or the drawn one). */
    mediaRect: Rect;
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
export declare function buildNewVideoStoryDoc(cfg: ResolvedConfig, W: number, H: number, fps: number, durationMs: number, classify: (path: string) => MediaKind): ComposeOutcome;
