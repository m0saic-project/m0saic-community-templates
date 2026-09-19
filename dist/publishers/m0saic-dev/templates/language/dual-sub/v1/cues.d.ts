import type { MosaicSubtitleCue } from "@m0saic/types";
/**
 * Cue-text hygiene for real-world subtitle sources.
 *
 * ffmpeg's ASS→SRT transcode leaves `<font …>`/`<i>` HTML tags and residual
 * ASS override tags (`{\an8}`) in cue text, and SDH-flavored subs carry sound
 * descriptions ("[música]"), ♪ lines, and speaker labels. Burned text must be
 * clean dialogue.
 */
export type SanitizeOptions = {
    /** Also strip SDH artifacts (bracketed descriptors, ♪ lines, speaker labels). */
    stripSdh: boolean;
};
export declare function sanitizeCueText(raw: string, opts: SanitizeOptions): string;
/**
 * Shift cues by `offsetMs` (external-file sync), clip them to the source
 * window [winStartMs, winEndMs], and remap to output-relative time.
 * Returns sanitized, non-empty cues only.
 */
export declare function prepareCues(cues: readonly MosaicSubtitleCue[], args: {
    winStartMs: number;
    winEndMs: number;
    offsetMs: number;
    sanitize: SanitizeOptions;
}): MosaicSubtitleCue[];
