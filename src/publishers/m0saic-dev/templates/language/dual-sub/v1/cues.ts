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

const HTML_TAG = /<[^>]+>/g;
const ASS_OVERRIDE = /\{\\[^}]*\}/g;
/**
 * Characters drawtext renders as tofu (□): C0/C1 controls (a stray \r at
 * line-break positions is the common real-world case), zero-widths, BOM,
 * and Unicode line/para separators (those become real line breaks).
 *
 * TODO(font-coverage): this only removes KNOWN non-printing characters.
 * Glyphs the bundled font simply lacks (CJK, rare diacritics) still tofu —
 * drawtext offers no coverage detection (that's ffmpeg, not fixable here).
 * The sensible home for full coverage is the in-house SVG glyph rasterizer
 * (@m0saic/text, rasterizer:"svg") — see
 * the internal svg-text-glyph-fallback notes.
 */
const NON_PRINTING = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2060\uFEFF]/g;
const LINE_SEPARATORS = /[\u2028\u2029]/g;
/** A line that is entirely a sound descriptor: "[música]", "(GUNSHOT)". */
const SDH_DESCRIPTOR_LINE = /^\s*[[(][^\][()]*[\])]\s*$/;
/** Inline bracketed descriptor within a line. */
const SDH_DESCRIPTOR_INLINE = /[[(][^\][()]*[\])]/g;
/** Leading speaker label: "TOKIO:", "MAN 2:". Uppercase-ish, short. */
const SDH_SPEAKER_LABEL = /^\s*[A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9 .'-]{0,23}:\s+/;

export function sanitizeCueText(raw: string, opts: SanitizeOptions): string {
  const lines = raw
    .replace(HTML_TAG, "")
    .replace(ASS_OVERRIDE, "")
    .replace(LINE_SEPARATORS, "\n")
    .replace(NON_PRINTING, "")
    // Legacy SubRip pipe line-separator convention ("line one|line two").
    .replace(/\s*\|\s*/g, "\n")
    .split("\n")
    .map((line) => {
      let l = line;
      if (opts.stripSdh) {
        if (SDH_DESCRIPTOR_LINE.test(l) || l.includes("♪")) return "";
        l = l.replace(SDH_DESCRIPTOR_INLINE, "");
        l = l.replace(SDH_SPEAKER_LABEL, "");
      }
      return l.replace(/\s+/g, " ").trim();
    })
    .filter((l) => l.length > 0);
  return lines.join("\n");
}

/**
 * Shift cues by `offsetMs` (external-file sync), clip them to the source
 * window [winStartMs, winEndMs], and remap to output-relative time.
 * Returns sanitized, non-empty cues only.
 */
export function prepareCues(
  cues: readonly MosaicSubtitleCue[],
  args: {
    winStartMs: number;
    winEndMs: number;
    offsetMs: number;
    sanitize: SanitizeOptions;
  },
): MosaicSubtitleCue[] {
  const { winStartMs, winEndMs, offsetMs, sanitize } = args;
  const out: MosaicSubtitleCue[] = [];
  for (const cue of cues) {
    const start = cue.startMs + offsetMs;
    const end = cue.endMs + offsetMs;
    if (end <= winStartMs || start >= winEndMs || end <= start) continue;
    const text = sanitizeCueText(cue.text, sanitize);
    if (!text) continue;
    out.push({
      startMs: Math.max(0, start - winStartMs),
      endMs: Math.min(winEndMs, end) - winStartMs,
      text,
    });
  }
  return out;
}
