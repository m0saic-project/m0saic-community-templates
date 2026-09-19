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

import { inkLeftPadPx, inkRightPadPx, type SearchBarLayout } from "./layout";
import type { TypingTimeline } from "./timeline";

/** Caret x-gap after the last typed glyph (plan D7). */
export const CARET_GAP_PX = 3;
/** Caret-track box cap: transitions + blink slots must stay well under the
 *  500-box track budget even for very long pinned renders — blink coarsens. */
export const CARET_BOX_BUDGET = 400;

export type CharSpan = { x0: number; x1: number };

/** Cover/underline spans for word `wordIndex`, in integer canvas px. */
export function charSpans(layout: SearchBarLayout, wordIndex: number): CharSpan[] {
  const { advances } = layout.words[wordIndex];
  const length = advances.length - 1;
  const lsbPad = inkLeftPadPx(layout.fontSize);
  const rsbPad = inkRightPadPx(layout.fontSize);
  return Array.from({ length }, (_, i) => ({
    x0: Math.floor(layout.wordX + advances[i] - lsbPad),
    x1: Math.ceil(layout.wordX + advances[i + 1] + 1 + (i === length - 1 ? rsbPad : 0)),
  }));
}

/**
 * The card-color curtain (D4): char i of word k is covered until typed and
 * again once deleted. 2 boxes per deleting char, 1 per held char — bounded by
 * the schema's word limits at 2·8·24 = 384 ≤ the 500-box track budget.
 */
export function buildCoverBoxes(
  timeline: TypingTimeline,
  layout: SearchBarLayout,
): GatedBox[] {
  const y = layout.glyphTop;
  const h = layout.glyphBottom - layout.glyphTop;
  const boxes: GatedBox[] = [];
  timeline.bands.forEach((band, k) => {
    const spans = charSpans(layout, k);
    band.chars.forEach((char, i) => {
      const rect = { x: spans[i].x0, y, w: spans[i].x1 - spans[i].x0, h };
      boxes.push({
        ...rect,
        ...(k === 0 ? {} : { fromSec: band.startSec }),
        toSec: char.typeAtSec,
      });
      // Char 0's deleteAt IS the band end (the strip window closes there), so
      // its delete box would be zero-duration — skip degenerate windows.
      if (char.deleteAtSec != null && char.deleteAtSec < band.endSec) {
        boxes.push({ ...rect, fromSec: char.deleteAtSec, toSec: band.endSec });
      }
    });
  });
  return boxes;
}

/**
 * The growing ink underline (D6): one exact-px segment per char, on while the
 * char is visible. The label's static segment is chrome (glyphs.ts); these
 * extend it under the typed word. ≤ 1 box/char.
 */
export function buildUnderlineBoxes(
  timeline: TypingTimeline,
  layout: SearchBarLayout,
): GatedBox[] {
  const boxes: GatedBox[] = [];
  timeline.bands.forEach((band, k) => {
    const spans = charSpans(layout, k);
    band.chars.forEach((char, i) => {
      boxes.push({
        x: spans[i].x0,
        y: layout.underlineY,
        w: spans[i].x1 - spans[i].x0,
        h: layout.underlineHeightPx,
        fromSec: char.typeAtSec,
        toSec: char.deleteAtSec ?? band.endSec,
      });
    });
  });
  return boxes;
}

type CaretOptions = { blinkMs: number; widthPx: number };

/** Blink slots at `x` over [fromSec, toSec): on for the first half-period. */
function blinkBoxes(
  x: number,
  fromSec: number,
  toSec: number,
  blinkSec: number,
  rect: { y: number; w: number; h: number },
): GatedBox[] {
  const boxes: GatedBox[] = [];
  for (let t = fromSec; t < toSec; t += blinkSec) {
    const on = Math.min(t + blinkSec / 2, toSec);
    if (on - t <= 0) break;
    boxes.push({ x, ...rect, fromSec: t, toSec: on });
  }
  return boxes;
}

/**
 * The opt-in caret (D7): a widthPx×glyph-band ink bar. Typing: sits after the
 * just-typed char for [typeAt_i, typeAt_{i+1}); deleting mirrored; holds
 * (empty-bar + full-word) blink every `blinkMs` (on for the first half). If
 * the blink slots would push the track past {@link CARET_BOX_BUDGET} (very
 * long pinned renders — blink is real-time, holds rescale), the blink period
 * coarsens uniformly instead of overflowing the track budget.
 */
export function buildCaretBoxes(
  timeline: TypingTimeline,
  layout: SearchBarLayout,
  caret: CaretOptions,
): GatedBox[] {
  const rect = {
    y: layout.glyphTop,
    w: Math.max(1, Math.round(caret.widthPx)),
    h: layout.glyphBottom - layout.glyphTop,
  };
  const posAt = (wordIndex: number, visibleChars: number): number =>
    Math.round(layout.wordX + layout.words[wordIndex].advances[visibleChars] + CARET_GAP_PX);

  const build = (blinkSec: number): GatedBox[] => {
    const boxes: GatedBox[] = [];
    timeline.bands.forEach((band, k) => {
      const length = band.chars.length;
      // Empty-bar hold: blink at the word origin.
      boxes.push(...blinkBoxes(posAt(k, 0), band.startSec, band.typeStartSec, blinkSec, rect));
      // First keystroke interval: solid at the origin.
      boxes.push({ x: posAt(k, 0), ...rect, fromSec: band.typeStartSec, toSec: band.chars[0].typeAtSec });
      // Typing: after char i until the next keystroke.
      for (let i = 0; i + 1 < length; i++) {
        boxes.push({
          x: posAt(k, i + 1),
          ...rect,
          fromSec: band.chars[i].typeAtSec,
          toSec: band.chars[i + 1].typeAtSec,
        });
      }
      // Full-word hold: blink at the word end.
      const holdEnd = band.deleteStartSec ?? band.endSec;
      boxes.push(...blinkBoxes(posAt(k, length), band.typedAtSec, holdEnd, blinkSec, rect));
      if (band.deleteStartSec != null) {
        // Deleting runs in reverse; deleteAt is strictly decreasing in i.
        // After char i vanishes the caret sits at the surviving prefix's end,
        // until char i−1 vanishes. Char 0's deleteAt IS the band end.
        const deleteAt = (i: number): number => band.chars[i].deleteAtSec as number;
        boxes.push({
          x: posAt(k, length),
          ...rect,
          fromSec: band.deleteStartSec,
          toSec: deleteAt(length - 1),
        });
        for (let i = length - 1; i >= 1; i--) {
          boxes.push({ x: posAt(k, i), ...rect, fromSec: deleteAt(i), toSec: deleteAt(i - 1) });
        }
      }
    });
    return boxes;
  };

  // Coarsen by doubling until under budget. Converges: transition boxes are
  // period-invariant but bounded (2L/word ≤ 384 at the schema caps) and blink
  // slots bottom out at one per hold (≤ 16), so a fixpoint ≤ 400 exists.
  let period = Math.max(0.05, caret.blinkMs / 1000);
  let boxes = build(period);
  for (let guard = 0; boxes.length > CARET_BOX_BUDGET && guard < 24; guard++) {
    period *= 2;
    boxes = build(period);
  }
  // between(t,a,b) is inclusive at BOTH ends: adjacent windows sharing an
  // exact boundary float would paint two carets on a frame landing there.
  // Trim every close 1ms (sub-frame at any real fps) so only the later
  // window claims the boundary frame.
  return boxes.map((box) =>
    box.fromSec != null && box.toSec != null && box.toSec - box.fromSec > 0.003
      ? { ...box, toSec: box.toSec - 0.001 }
      : box,
  );
}
