/**
 * Enable-gated drawbox builders — the typing curtain (D4), the growing
 * underline (D6), and the opt-in caret (D7). Pure math from timeline ×
 * layout; every builder returns `GatedBox[]` for ONE `gatedBoxTrackSource`
 * per concern (R6: N time-disjoint elements collapse into one lavfi track;
 * the track builder emits `replace=1` per box, R7).
 *
 * The curtain trick: cover boxes paint the CARD color over the word strips —
 * a covered char is indistinguishable from bare card. Gate shapes:
 *
 * - Word 0's typed-side covers are pure lt-gates (`lt(t, typeAt)`) — already
 *   ON at frame 0, so no gate flips at t=0 (the frame-0 guard, plan D8).
 * - Every later word's typed-side covers are `between(bandStart, typeAt)`:
 *   an lt-gate from t=0 would paint card color over the PREVIOUS words'
 *   visible glyphs (all words share the same x-region).
 * - Deleted-side covers are `between(deleteAt, bandEnd)` — the strip's own
 *   overlay window closes at bandEnd, so coverage can stop there.
 *
 * Char spans come from the layout's KERN-AWARE advances (D5), padded by the
 * font-proportional ink overhangs: a glyph's ink can start LEFT of its
 * advance origin (negative side bearing — "j" −0.032em, "ĩ" −0.05em), so
 * each span's left edge takes `inkLeftPadPx` and the last char's right edge
 * `inkRightPadPx` ("ſ" +0.065em). The left pad may briefly chop the previous
 * char's tail while the next cover is still down — accepted: leaking UNTYPED
 * ink past the curtain breaks the illusion harder than a one-keystroke
 * sub-glyph chop (risk 1).
 *
 * Deterministic; no engine imports beyond the GatedBox type.
 */
import type { GatedBox } from "@m0saic/template-utils";
import { type SearchBarLayout } from "./layout";
import type { TypingTimeline } from "./timeline";
/** Caret x-gap after the last typed glyph (plan D7). */
export declare const CARET_GAP_PX = 3;
/** Caret-track box cap: transitions + blink slots must stay well under the
 *  500-box track budget even for very long pinned renders — blink coarsens. */
export declare const CARET_BOX_BUDGET = 400;
export type CharSpan = {
    x0: number;
    x1: number;
};
/** Cover/underline spans for word `wordIndex`, in integer canvas px. */
export declare function charSpans(layout: SearchBarLayout, wordIndex: number): CharSpan[];
/**
 * The card-color curtain (D4): char i of word k is covered until typed and
 * again once deleted. 2 boxes per deleting char, 1 per held char — bounded by
 * the schema's word limits at 2·8·24 = 384 ≤ the 500-box track budget.
 */
export declare function buildCoverBoxes(timeline: TypingTimeline, layout: SearchBarLayout): GatedBox[];
/**
 * The growing ink underline (D6): one exact-px segment per char, on while the
 * char is visible. The label's static segment is chrome (glyphs.ts); these
 * extend it under the typed word. ≤ 1 box/char.
 */
export declare function buildUnderlineBoxes(timeline: TypingTimeline, layout: SearchBarLayout): GatedBox[];
type CaretOptions = {
    blinkMs: number;
    widthPx: number;
};
/**
 * The opt-in caret (D7): a widthPx×glyph-band ink bar. Typing: sits after the
 * just-typed char for [typeAt_i, typeAt_{i+1}); deleting mirrored; holds
 * (empty-bar + full-word) blink every `blinkMs` (on for the first half). If
 * the blink slots would push the track past {@link CARET_BOX_BUDGET} (very
 * long pinned renders — blink is real-time, holds rescale), the blink period
 * coarsens uniformly instead of overflowing the track budget.
 */
export declare function buildCaretBoxes(timeline: TypingTimeline, layout: SearchBarLayout, caret: CaretOptions): GatedBox[];
export {};
