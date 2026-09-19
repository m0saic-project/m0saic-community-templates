import type { MosaicSubtitleTrack } from "@m0saic/types";
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
export declare function scoreDialogueLikeness(track: MosaicSubtitleTrack): number;
/**
 * Pick a track: explicit index → language match (best-scored among matches)
 * → best dialogue score overall. Returns null when nothing usable exists
 * (no tracks, or every track has zero cues — e.g. PGS bitmaps).
 */
export declare function selectLearnTrack(tracks: readonly MosaicSubtitleTrack[] | undefined, sel: TrackSelector): TrackSelection | null;
