import type { MosaicSubtitleTrack } from "@m0saic/types";
import { scoreDialogueLikeness, selectLearnTrack } from "./tracks";

function track(args: {
  language?: string;
  title?: string;
  isDefault?: boolean;
  cues: Array<{ startMs: number; endMs: number }>;
}): MosaicSubtitleTrack {
  return {
    stream: {
      streamIndex: 0,
      codecName: "subrip",
      language: args.language,
      title: args.title,
      default: args.isDefault ?? false,
      forced: false,
    },
    cues: args.cues.map((c, i) => ({ ...c, text: `line ${i}` })),
  } as MosaicSubtitleTrack;
}

/** ~Dialogue: 2s cues every 4s. */
const dialogueCues = Array.from({ length: 300 }, (_, i) => ({ startMs: i * 4000, endMs: i * 4000 + 2000 }));
/** ~Karaoke spam: 60 concurrent-ish 200ms cues packed in one minute. */
const spamCues = Array.from({ length: 4000 }, (_, i) => ({
  startMs: 60000 + (i % 200) * 80,
  endMs: 60000 + (i % 200) * 80 + 200,
}));

describe("scoreDialogueLikeness", () => {
  it("ranks dialogue far above typesetting spam", () => {
    expect(scoreDialogueLikeness(track({ cues: dialogueCues }))).toBeGreaterThan(
      scoreDialogueLikeness(track({ cues: spamCues })),
    );
  });
  it("empty tracks (bitmap subs) are unusable", () => {
    expect(scoreDialogueLikeness(track({ cues: [] }))).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("selectLearnTrack", () => {
  const spam = track({ language: "eng", title: "Signs & Songs", isDefault: true, cues: spamCues });
  const dialogue = track({ language: "eng", title: "English subs", cues: dialogueCues });
  const spanish = track({ language: "spa", cues: dialogueCues });

  it("prefers the dialogue track over a default-flagged spam track (the anime trap)", () => {
    const pick = selectLearnTrack([spam, dialogue, spanish], {});
    expect(pick?.track.stream.title).toBe("English subs");
    expect(pick?.rule).toBe("dialogue-score");
  });

  it("language match narrows candidates, still scored", () => {
    const pick = selectLearnTrack([spam, dialogue, spanish], { languageCode: "eng" });
    expect(pick?.track.stream.title).toBe("English subs");
    expect(pick?.rule).toBe("language-match");
  });

  it("explicit index wins; empty track at index is unusable", () => {
    expect(selectLearnTrack([spam, dialogue], { trackIndex: 0 })?.rule).toBe("explicit-index");
    expect(selectLearnTrack([track({ cues: [] })], { trackIndex: 0 })).toBeNull();
  });

  it("returns null when nothing is usable", () => {
    expect(selectLearnTrack([], {})).toBeNull();
    expect(selectLearnTrack(undefined, {})).toBeNull();
    expect(selectLearnTrack([spam, dialogue], { languageCode: "jpn" })).toBeNull();
  });
});
