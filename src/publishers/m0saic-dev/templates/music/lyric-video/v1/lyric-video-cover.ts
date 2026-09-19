/**
 * Lyric Video — the editor first-open cover, on the mosaic-branding
 * cover kit every shipped template converges on (`buildBrandedCover`
 * from `@m0saic/template-utils`): left chat pane (brand row, headline, overview,
 * the 3-step mental model, START HERE tip), right hero of REAL
 * MATERIAL — the template's own look, not brand art (the subtitle-burn
 * idiom for input-requiring templates): a black frame with a lyric
 * line exactly as the render paints it, the next line waiting dimmed,
 * and a cue strip hinting the time axis.
 */

import type { MosaicColor, MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import {
  buildBrandedCover,
  onboardingFrame,
  onboardingLeaf,
  onboardingOverlay,
  onboardingSolid,
  onboardingSplit,
  onboardingTextSource,
  type OnboardingComposition,
  type OnboardingTypeRamp,
} from "@m0saic/template-utils";
import type { MosaicThemeTokens } from "@m0saic/types";

/** The hero: the render's face — one bright line mid-song, next line
 *  dimmed — plus a cue strip below-right hinting at the tap pass. */
function coverHero(
  theme: MosaicThemeTokens,
  type: OnboardingTypeRamp,
): OnboardingComposition {
  const line = onboardingLeaf(
    onboardingTextSource({
      text: "Every line shows up right on time",
      fontSize: Math.round(type.headline * 0.58),
      color: "#ffffff" as MosaicColor,
      hAlign: "center",
      label: "hero lyric line",
    }),
  );
  const nextLine = onboardingLeaf(
    onboardingTextSource({
      text: "the next line waits, dimmed",
      fontSize: type.label,
      color: "#6d7688" as MosaicColor,
      hAlign: "center",
      label: "hero next line",
    }),
  );
  const frame = onboardingOverlay(
    onboardingSolid("#000000" as MosaicColor),
    onboardingSplit("row", [6, 3, 1, 2, 4], [null, line, null, nextLine, null]),
  );
  const cueStrip = onboardingSplit(
    "col",
    [4, 10, 4],
    [
      null,
      onboardingLeaf(
        onboardingTextSource({
          text: "0:42 - 0:45   “tap Space when you hear this line”   ·   B holds a silent beat",
          fontSize: type.micro,
          color: theme.textSecondary,
          hAlign: "center",
          backgroundColor: theme.surfaceInset,
          label: "hero cue strip",
        }),
      ),
      null,
    ],
  );
  return onboardingFrame(
    onboardingSplit("row", [15, 1, 2], [frame, null, cueStrip]),
    theme.borderStrong,
  );
}

/** Production cover: the family chat pane beside the lyric-frame hero. */
export function renderLyricVideoCover(ctx: MosaicEngineContext): MosaicDocument {
  return buildBrandedCover({
    ctx,
    copy: {
      productName: "Lyric Video",
      title: "Lyrics, on time.",
      overview:
        "Turn a song and its lyrics into a finished lyric video — line-timed text over your backdrop, the render exactly as long as the track.",
      overviewCompact: "A song plus lyrics in, a line-timed lyric video out.",
      messages: [
        {
          label: "ADD A SONG",
          body: "Drop the audio file. The render length follows the track, end to end.",
          bodyCompact: "The render length follows the track.",
        },
        {
          label: "PASTE LYRICS",
          body: "One line per lyric. Untimed lines auto-spread evenly; pasted SRT keeps its timings.",
          bodyCompact: "Untimed lines auto-spread evenly.",
        },
        {
          label: "TAP THE TIMING",
          body: "Space stamps each line as you hear it; B holds a silent beat; shift it all a touch earlier.",
          bodyCompact: "Space stamps lines; B holds a beat.",
        },
      ],
      tip: "Pick a song and paste lyrics — it renders immediately.",
    },
    hero: (theme, type) => coverHero(theme, type),
  });
}
