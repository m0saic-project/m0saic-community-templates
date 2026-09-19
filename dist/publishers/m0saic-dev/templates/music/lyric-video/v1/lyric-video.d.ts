import type { MosaicTemplate, MosaicTimedCue } from "@m0saic/types";
/**
 * @m0saic-dev/music/lyric-video/v1 — line-level lyric video.
 *
 * A song + an ordered cue track of lyric lines (`picker: "cue-track"` — timed
 * in Make's Cue Timing Studio, or hand-authored) + an optional background →
 * a rendered lyric video. The output duration FOLLOWS THE SONG (the Q3
 * duration-follow law): an explicit user ask wins, else the probed song
 * length, else the last timed line; the doc authors the result so the
 * engine's slot-length audio cap never truncates the track.
 *
 * Design doc: the internal lyric-video-cue-track notes
 */
export type LyricVideoProps = {
    songId?: string;
    lyrics?: MosaicTimedCue[] | string;
    backgroundId?: string;
    backgroundColor?: string;
    textColor?: string;
    position?: "top" | "middle" | "bottom";
    align?: "left" | "center" | "right";
    textScale?: number;
    revealStyle?: "cut" | "fade";
    leadInMs?: number;
    tailMs?: number;
    karaoke?: "off" | "highlight" | "dot";
    karaokeColor?: string;
    bestEffortTiming?: boolean;
};
export declare const MAX_LYRIC_CUES = 400;
export declare const LYRIC_VIDEO_TEMPLATE_ID: import("@m0saic/types").TemplateId;
export declare const LyricVideo: MosaicTemplate<LyricVideoProps>;
