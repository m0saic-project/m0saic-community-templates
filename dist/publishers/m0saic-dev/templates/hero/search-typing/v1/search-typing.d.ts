/**
 * `@m0saic-dev/hero/search-typing/v1` — looping search-bar typing hero.
 *
 * One MosaicDocument with REAL GEOMETRY (the Rect Thesis — founder-directed
 * revision of plan D1's flat overlay stack): every element is a true m0 cell,
 * so the document carries selectable bounding boxes — card, icon, label zone,
 * word zone, underline band — instead of an opaque full-canvas stack.
 *
 * Placement is geometry-recipes Recipe 1: each cell SNAPS OUTWARD to an 8px
 * grid (`SNAP_PX`) before `placeRects`, which GCD-collapses the splits (all
 * edges share the grid) while every source is authored local to its SNAPPED
 * cell — masks bound to the cell's exact dims, glyph/track coordinates offset
 * by (exact − snapped). No `placement.inset` anywhere: lavfi drawbox tracks
 * render at their true cell size, which inset recovery cannot guarantee
 * (cell-filling track content is the documented non-fit for inset pieces).
 * The page background stays `document.backgroundColor` (never a base
 * overlay).
 *
 * Paint order via piece importance: card (0) → icon + label chrome (1) →
 * word strips (2, one layer each — same rect) → cover curtain + underline
 * grow (3) → caret (4). ffmpeg enable-gates only — no per-frame JS, no
 * drawtext, every track under the 500-box budget.
 */
import type { MosaicTemplate } from "@m0saic/types";
import { type SearchTypingProps } from "./schema";
export declare const SearchTyping: MosaicTemplate<SearchTypingProps>;
export default SearchTyping;
