import type { MosaicSubtitleTrack } from "@m0saic/types";
import { matchesLanguageCode } from "@m0saic/platform";

/**
 * Track selection for real-world files, where metadata lies:
 * language tags are often all-`eng`, and the default flag can sit on a
 * karaoke/typesetting track (thousands of sub-second events packed into an
 * OP/ED). Cue statistics tell dialogue from garbage; titles carry the
 * human-facing semantics.
 */
export type TrackSelector = {
  trackIndex?: number;
  languageCode?: string;
};

export type TrackSelection = {
  track: MosaicSubtitleTrack;
  rule: "explicit-index" | "language-match" | "dialogue-score";
  score: number;
};

/**
 * Dialogue-likeness from cue statistics alone. Calibrated against real files:
 * dialogue ≈ 300–1100 cues/episode, median ~2s, ≤2 concurrent, duty ≤100%;
 * typesetting spam ≈ thousands of 20–500ms cues, >100 concurrent.
 */
export function scoreDialogueLikeness(track: MosaicSubtitleTrack): number {
  const cues = track.cues;
  if (!cues || cues.length === 0) return Number.NEGATIVE_INFINITY;

  const durations = cues.map((c) => c.endMs - c.startMs).sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];

  const events: Array<[number, number]> = [];
  for (const c of cues) events.push([c.startMs, 1], [c.endMs, -1]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let depth = 0;
  let maxConcurrent = 0;
  for (const [, d] of events) {
    depth += d;
    if (depth > maxConcurrent) maxConcurrent = depth;
  }

  let score = 0;
  score += cues.length >= 30 && cues.length <= 3000 ? 2 : -2;
  score += median >= 800 ? 2 : median >= 400 ? 0 : -2;
  score += maxConcurrent <= 3 ? 2 : -3;
  return score;
}

/**
 * Pick a track: explicit index → language match (best-scored among matches)
 * → best dialogue score overall. Returns null when nothing usable exists
 * (no tracks, or every track has zero cues — e.g. PGS bitmaps).
 */
export function selectLearnTrack(
  tracks: readonly MosaicSubtitleTrack[] | undefined,
  sel: TrackSelector,
): TrackSelection | null {
  if (!tracks || tracks.length === 0) return null;

  if (sel.trackIndex !== undefined) {
    const track = tracks[sel.trackIndex];
    if (!track || track.cues.length === 0) return null;
    return { track, rule: "explicit-index", score: scoreDialogueLikeness(track) };
  }

  const best = (candidates: readonly MosaicSubtitleTrack[]): TrackSelection | null => {
    let top: TrackSelection | null = null;
    for (const track of candidates) {
      const score = scoreDialogueLikeness(track);
      if (!Number.isFinite(score)) continue;
      if (!top || score > top.score) top = { track, rule: "dialogue-score", score };
    }
    return top;
  };

  if (sel.languageCode) {
    const matches = tracks.filter(
      (t) => t.stream.language && matchesLanguageCode(t.stream.language, sel.languageCode!),
    );
    const pick = best(matches);
    if (pick) return { ...pick, rule: "language-match" };
    return null;
  }

  return best(tracks);
}
