/**
 * ============================================================================
 * hero/search-typing timeline — per-character typing/deleting band math
 * ============================================================================
 *
 * Hand-rolled analog of template-utils' `computeTimeline` for VARIABLE-length
 * steps (word bands vary with word length, so the uniform-step helper does not
 * apply — this module reuses its IDIOM, not the function). Each word k
 * contributes a band:
 *
 *   emptyHoldMs + L_k·typeCharMs + wordHoldMs + (deletes_k ? L_k·deleteCharMs : 0)
 *
 * and the natural duration is `leadMs + Σ_k band_k + trailMs`. When the render
 * pins an output duration (`resolvePinnedDurationMs`), EVERY emitted second is
 * multiplied by the same k = pinned/natural — bands, char times, and holds keep
 * their ratios at any output length (no truncation, no dead air).
 *
 * Char conventions (all windows half-open [from, to)):
 * - Char i (0-based) is TYPED at `typeStart + (i+1)·typeCharMs` — each char
 *   appears at the END of its keystroke interval, so the word is fully visible
 *   exactly when its typing window closes and its hold begins.
 * - Deleting removes chars in reverse: char i is DELETED at
 *   `deleteStart + (L−i)·deleteCharMs`. Char 0's deleteAt therefore lands
 *   exactly on the band end, where the word strip's own overlay window closes.
 * - endBehavior "hold": the last word never deletes (`deleteAtSec` absent) and
 *   its band extends through the trail to the clip end — the poster frame.
 *   "loop": the last word deletes like every other; lead and trail both show
 *   the empty bar, so the clip loops seamlessly.
 *
 * Frame-0 guard: `leadMs` clamps to ≥ one frame (1000/fps) so no enable-gate
 * flips exactly at t=0; the first word's cover boxes are lt-gates, already ON
 * at frame 0. A pinned duration far below natural compresses char times below
 * one frame — chars then appear in clumps; graceful by design, no hard floor.
 *
 * Pure module: no engine imports, no randomness, no wall-clock. Same inputs →
 * same timeline, byte-identical.
 * ============================================================================
 */

export type SearchTypingEndBehavior = "hold" | "loop";

export type TypingTimingSpec = {
  /** Per typed char (ms). */
  typeCharMs: number;
  /** Per deleted char (ms) — reference deletes slightly faster than it types. */
  deleteCharMs: number;
  /** Empty-bar hold before a word starts typing (ms). */
  emptyHoldMs: number;
  /** Fully-typed word hold (ms). */
  wordHoldMs: number;
  /** Pad before the first band (ms); clamped ≥ one frame. */
  leadMs: number;
  /** Pad after the last band (ms). */
  trailMs: number;
};

export type CharTiming = {
  /** Second this char becomes visible (its cover box lifts). */
  typeAtSec: number;
  /** Second this char is hidden again; absent when the word holds to the end. */
  deleteAtSec?: number;
};

export type WordBand = {
  word: string;
  /** Band start — the empty-bar hold before typing. */
  startSec: number;
  /** Typing begins (first keystroke interval opens). */
  typeStartSec: number;
  /** Word fully visible — typing done, hold begins. */
  typedAtSec: number;
  /** Deleting begins; absent when the word holds to the end. */
  deleteStartSec?: number;
  /** Band end. A held last word ends at the clip end (trail included). */
  endSec: number;
  /** Per-char visibility windows, index-aligned to the word's chars. */
  chars: CharTiming[];
  /** True when this band never deletes (endBehavior "hold", last word). */
  holdsToEnd: boolean;
};

export type TypingTimeline = {
  bands: WordBand[];
  /** Output duration in integer ms (drives doc.durationMs). */
  durationMs: number;
  /** durationMs in seconds — every band/char time lives in [0, durationSec]. */
  durationSec: number;
  /** Content-driven length in ms before any pin (exact, unrounded). */
  naturalDurationMs: number;
  /** durationMs/natural uniform rescale factor (1 when unpinned with an
   *  integer-ms natural; the ±0.5ms duration rounding folds into it). */
  scale: number;
  /** Lead pad in output seconds (post-rescale). */
  leadSec: number;
  /** Trail pad in output seconds (post-rescale). */
  trailSec: number;
};

export type BuildTypingTimelineOptions = {
  /**
   * Authored output duration to fit EXACTLY (uniform rescale of every band,
   * char time, and hold). Omit / 0 → the natural recommendation.
   */
  pinnedDurationMs?: number;
  /** Render fps for the frame-0 lead clamp. Default 30. */
  fps?: number;
};

const TIMING_KEYS = [
  "typeCharMs",
  "deleteCharMs",
  "emptyHoldMs",
  "wordHoldMs",
  "leadMs",
  "trailMs",
] as const;

/**
 * Build the per-word, per-char timeline. Deterministic; validates its inputs
 * fail-fast (the props schema validates too — this keeps the pure module safe
 * standalone).
 */
export function buildTypingTimeline(
  words: string[],
  timing: TypingTimingSpec,
  endBehavior: SearchTypingEndBehavior,
  options: BuildTypingTimelineOptions = {},
): TypingTimeline {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error("search-typing timeline: words must be a non-empty array");
  }
  for (const word of words) {
    if (typeof word !== "string" || word.length === 0) {
      throw new Error("search-typing timeline: every word must be a non-empty string");
    }
  }
  for (const key of TIMING_KEYS) {
    const value = timing[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`search-typing timeline: timing.${key} must be a finite number > 0`);
    }
  }
  if (endBehavior !== "hold" && endBehavior !== "loop") {
    throw new Error(`search-typing timeline: endBehavior must be hold or loop (got "${endBehavior}")`);
  }

  const fps = options.fps != null && options.fps > 0 ? options.fps : 30;
  const leadMs = Math.max(timing.leadMs, 1000 / fps);

  // Natural pass — exact ms, one running cursor; bands abut with no gaps.
  let cursorMs = leadMs;
  const naturalBands = words.map((word, k) => {
    const deletes = endBehavior === "loop" || k < words.length - 1;
    const length = word.length;
    const startMs = cursorMs;
    const typeStartMs = startMs + timing.emptyHoldMs;
    const typedAtMs = typeStartMs + length * timing.typeCharMs;
    const deleteStartMs = deletes ? typedAtMs + timing.wordHoldMs : undefined;
    const endMs =
      deleteStartMs != null
        ? deleteStartMs + length * timing.deleteCharMs
        : typedAtMs + timing.wordHoldMs;
    cursorMs = endMs;
    return { word, deletes, length, startMs, typeStartMs, typedAtMs, deleteStartMs, endMs };
  });
  const naturalDurationMs = cursorMs + timing.trailMs;

  const pinnedMs =
    options.pinnedDurationMs != null && options.pinnedDurationMs > 0
      ? options.pinnedDurationMs
      : undefined;
  const durationMs = Math.round(pinnedMs ?? naturalDurationMs);
  // Rescale against the ROUNDED emitted duration (doc.durationMs is integer
  // ms), so every band/char time lands exactly inside [0, durationSec] even
  // when the natural duration is fractional (e.g. a frame-clamped lead).
  const scale = durationMs / naturalDurationMs;
  const durationSec = durationMs / 1000;
  const toSec = (ms: number): number => (ms * scale) / 1000;

  const bands: WordBand[] = naturalBands.map((band) => {
    const chars: CharTiming[] = Array.from({ length: band.length }, (_, i) => {
      const typeAtSec = toSec(band.typeStartMs + (i + 1) * timing.typeCharMs);
      if (band.deleteStartMs == null) return { typeAtSec };
      return {
        typeAtSec,
        deleteAtSec: toSec(band.deleteStartMs + (band.length - i) * timing.deleteCharMs),
      };
    });
    return {
      word: band.word,
      startSec: toSec(band.startMs),
      typeStartSec: toSec(band.typeStartMs),
      typedAtSec: toSec(band.typedAtMs),
      ...(band.deleteStartMs != null ? { deleteStartSec: toSec(band.deleteStartMs) } : {}),
      endSec: band.deletes ? toSec(band.endMs) : durationSec,
      chars,
      holdsToEnd: !band.deletes,
    };
  });

  return {
    bands,
    durationMs,
    durationSec,
    naturalDurationMs,
    scale,
    leadSec: toSec(leadMs),
    trailSec: toSec(timing.trailMs),
  };
}
