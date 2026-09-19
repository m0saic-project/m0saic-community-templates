"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tracks_1 = require("./tracks");
function track(args) {
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
    };
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
        expect((0, tracks_1.scoreDialogueLikeness)(track({ cues: dialogueCues }))).toBeGreaterThan((0, tracks_1.scoreDialogueLikeness)(track({ cues: spamCues })));
    });
    it("empty tracks (bitmap subs) are unusable", () => {
        expect((0, tracks_1.scoreDialogueLikeness)(track({ cues: [] }))).toBe(Number.NEGATIVE_INFINITY);
    });
});
describe("selectLearnTrack", () => {
    const spam = track({ language: "eng", title: "Signs & Songs", isDefault: true, cues: spamCues });
    const dialogue = track({ language: "eng", title: "English subs", cues: dialogueCues });
    const spanish = track({ language: "spa", cues: dialogueCues });
    it("prefers the dialogue track over a default-flagged spam track (the anime trap)", () => {
        const pick = (0, tracks_1.selectLearnTrack)([spam, dialogue, spanish], {});
        expect(pick?.track.stream.title).toBe("English subs");
        expect(pick?.rule).toBe("dialogue-score");
    });
    it("language match narrows candidates, still scored", () => {
        const pick = (0, tracks_1.selectLearnTrack)([spam, dialogue, spanish], { languageCode: "eng" });
        expect(pick?.track.stream.title).toBe("English subs");
        expect(pick?.rule).toBe("language-match");
    });
    it("explicit index wins; empty track at index is unusable", () => {
        expect((0, tracks_1.selectLearnTrack)([spam, dialogue], { trackIndex: 0 })?.rule).toBe("explicit-index");
        expect((0, tracks_1.selectLearnTrack)([track({ cues: [] })], { trackIndex: 0 })).toBeNull();
    });
    it("returns null when nothing is usable", () => {
        expect((0, tracks_1.selectLearnTrack)([], {})).toBeNull();
        expect((0, tracks_1.selectLearnTrack)(undefined, {})).toBeNull();
        expect((0, tracks_1.selectLearnTrack)([spam, dialogue], { languageCode: "jpn" })).toBeNull();
    });
});
