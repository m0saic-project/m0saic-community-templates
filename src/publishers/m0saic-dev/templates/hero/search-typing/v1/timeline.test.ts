import {
  buildTypingTimeline,
  type TypingTimingSpec,
} from "./timeline";

const WORDS = ["Ideas", "Answers", "Templates", "Tutorials", "Inspiration"];
// 5+7+9+9+11 = 41 chars; hold-last deletes 30 of them.
const TIMING: TypingTimingSpec = {
  typeCharMs: 120,
  deleteCharMs: 90,
  emptyHoldMs: 850,
  wordHoldMs: 1100,
  leadMs: 400,
  trailMs: 400,
};

describe("buildTypingTimeline — natural duration", () => {
  it("sums lead + Σ bands + trail exactly at the defaults (hold)", () => {
    // 400 + 5·850 + 41·120 + 5·1100 + 30·90 + 400 = 18170
    const t = buildTypingTimeline(WORDS, TIMING, "hold");
    expect(t.durationMs).toBe(18170);
    expect(t.naturalDurationMs).toBe(18170);
    expect(t.scale).toBe(1);
    expect(t.bands).toHaveLength(5);
  });

  it("loop adds the last word's deletes", () => {
    // hold + 11·90 = 19160
    const t = buildTypingTimeline(WORDS, TIMING, "loop");
    expect(t.durationMs).toBe(19160);
  });

  it("single held word: lead + empty + type + hold + trail", () => {
    const t = buildTypingTimeline(["Hi"], TIMING, "hold");
    // 400 + 850 + 2·120 + 1100 + 400 = 2990
    expect(t.durationMs).toBe(2990);
    expect(t.bands[0].holdsToEnd).toBe(true);
    expect(t.bands[0].endSec).toBe(t.durationSec);
  });
});

describe("buildTypingTimeline — band edges", () => {
  const t = buildTypingTimeline(WORDS, TIMING, "hold");

  it("first band's edges are exact", () => {
    const band = t.bands[0]; // "Ideas", L=5
    expect(band.startSec).toBeCloseTo(0.4, 9);
    expect(band.typeStartSec).toBeCloseTo(1.25, 9);
    expect(band.typedAtSec).toBeCloseTo(1.85, 9); // 1.25 + 5·0.12
    expect(band.deleteStartSec).toBeCloseTo(2.95, 9); // + 1.1 hold
    expect(band.endSec).toBeCloseTo(3.4, 9); // + 5·0.09
  });

  it("bands abut: each next band starts where the previous ends", () => {
    for (let k = 0; k + 1 < t.bands.length; k++) {
      expect(t.bands[k + 1].startSec).toBeCloseTo(t.bands[k].endSec, 9);
    }
  });

  it("char times are monotonic and every char window is positive", () => {
    for (const band of t.bands) {
      expect(band.chars).toHaveLength(band.word.length);
      for (let i = 0; i < band.chars.length; i++) {
        const char = band.chars[i];
        expect(char.typeAtSec).toBeGreaterThan(band.typeStartSec);
        expect(char.typeAtSec).toBeLessThanOrEqual(band.typedAtSec + 1e-9);
        if (i > 0) {
          expect(char.typeAtSec).toBeGreaterThan(band.chars[i - 1].typeAtSec);
        }
        if (char.deleteAtSec != null) {
          // Deletes run in reverse: later chars vanish earlier.
          expect(char.deleteAtSec).toBeGreaterThan(char.typeAtSec);
          if (i > 0 && band.chars[i - 1].deleteAtSec != null) {
            expect(char.deleteAtSec).toBeLessThan(band.chars[i - 1].deleteAtSec as number);
          }
        }
      }
    }
  });

  it("the last char types exactly at typedAt; char 0 deletes exactly at band end", () => {
    const band = t.bands[0];
    expect(band.chars[band.chars.length - 1].typeAtSec).toBeCloseTo(band.typedAtSec, 9);
    expect(band.chars[0].deleteAtSec).toBeCloseTo(band.endSec, 9);
  });
});

describe("buildTypingTimeline — endBehavior", () => {
  it("hold: the last band never deletes and runs to the clip end", () => {
    const t = buildTypingTimeline(WORDS, TIMING, "hold");
    const last = t.bands[t.bands.length - 1];
    expect(last.holdsToEnd).toBe(true);
    expect(last.deleteStartSec).toBeUndefined();
    expect(last.chars.every((char) => char.deleteAtSec === undefined)).toBe(true);
    expect(last.endSec).toBe(t.durationSec);
    // Every earlier band deletes.
    for (const band of t.bands.slice(0, -1)) {
      expect(band.holdsToEnd).toBe(false);
      expect(band.deleteStartSec).toBeDefined();
    }
  });

  it("loop: the last band deletes and only the trail follows", () => {
    const t = buildTypingTimeline(WORDS, TIMING, "loop");
    const last = t.bands[t.bands.length - 1];
    expect(last.holdsToEnd).toBe(false);
    expect(last.chars.every((char) => char.deleteAtSec != null)).toBe(true);
    expect(last.endSec + t.trailSec).toBeCloseTo(t.durationSec, 9);
  });
});

describe("buildTypingTimeline — pinned duration", () => {
  it("rescales every time by the same k and sums to the pinned ms", () => {
    const natural = buildTypingTimeline(WORDS, TIMING, "loop");
    const pinned = buildTypingTimeline(WORDS, TIMING, "loop", { pinnedDurationMs: 8000 });
    const k = 8000 / 19160;
    expect(pinned.durationMs).toBe(8000);
    expect(pinned.scale).toBeCloseTo(k, 12);
    expect(pinned.bands[0].typeStartSec).toBeCloseTo(natural.bands[0].typeStartSec * k, 9);
    expect(pinned.bands[2].chars[3].typeAtSec).toBeCloseTo(
      natural.bands[2].chars[3].typeAtSec * k,
      9,
    );
    const last = pinned.bands[pinned.bands.length - 1];
    expect(last.endSec + pinned.trailSec).toBeCloseTo(8, 9);
  });

  it("stretches when pinned past natural (no dead air)", () => {
    const t = buildTypingTimeline(WORDS, TIMING, "hold", { pinnedDurationMs: 30000 });
    expect(t.scale).toBeCloseTo(30000 / 18170, 12);
    expect(t.bands[0].typeStartSec).toBeCloseTo(1.25 * (30000 / 18170), 9);
    expect(t.durationSec).toBe(30);
  });

  it("hold keeps the last band pinned to the clip end", () => {
    const t = buildTypingTimeline(WORDS, TIMING, "hold", { pinnedDurationMs: 8000 });
    expect(t.bands[t.bands.length - 1].endSec).toBe(8);
  });

  it("fractional naturals still land every time inside [0, durationSec]", () => {
    // A sub-frame lead engages the 1000/30 = 33.33…ms clamp → fractional
    // natural; the rescale must fold the ±0.5ms duration rounding in.
    const t = buildTypingTimeline(["Hi"], { ...TIMING, leadMs: 5 }, "loop", { fps: 30 });
    const last = t.bands[t.bands.length - 1];
    expect(last.endSec + t.trailSec).toBeCloseTo(t.durationSec, 12);
    for (const band of t.bands) {
      expect(band.endSec).toBeLessThanOrEqual(t.durationSec);
      for (const char of band.chars) {
        expect(char.typeAtSec).toBeLessThanOrEqual(t.durationSec);
        if (char.deleteAtSec != null) {
          expect(char.deleteAtSec).toBeLessThanOrEqual(t.durationSec);
        }
      }
    }
  });
});

describe("buildTypingTimeline — frame-0 guard", () => {
  // The clamp applies to the INPUT leadMs; the emitted lead then carries the
  // uniform rescale (which folds the ±0.5ms duration rounding), so assert the
  // clamped value × scale.
  it("clamps a sub-frame lead to one frame", () => {
    const t = buildTypingTimeline(WORDS, { ...TIMING, leadMs: 5 }, "hold", { fps: 30 });
    expect(t.bands[0].startSec).toBeCloseTo((1000 / 30 / 1000) * t.scale, 9);
    expect(t.bands[0].startSec).toBeCloseTo(1000 / 30 / 1000, 5);
  });

  it("uses the given fps (and defaults to 30)", () => {
    const at60 = buildTypingTimeline(WORDS, { ...TIMING, leadMs: 5 }, "hold", { fps: 60 });
    expect(at60.bands[0].startSec).toBeCloseTo((1000 / 60 / 1000) * at60.scale, 9);
    const noFps = buildTypingTimeline(WORDS, { ...TIMING, leadMs: 5 }, "hold");
    expect(noFps.bands[0].startSec).toBeCloseTo((1000 / 30 / 1000) * noFps.scale, 9);
  });

  it("leaves an already-long lead untouched", () => {
    const t = buildTypingTimeline(WORDS, TIMING, "hold", { fps: 30 });
    expect(t.bands[0].startSec).toBeCloseTo(0.4, 9);
  });
});

describe("buildTypingTimeline — determinism and validation", () => {
  it("same inputs produce an identical timeline", () => {
    const a = buildTypingTimeline(WORDS, TIMING, "hold", { pinnedDurationMs: 12000, fps: 30 });
    const b = buildTypingTimeline(WORDS, TIMING, "hold", { pinnedDurationMs: 12000, fps: 30 });
    expect(a).toEqual(b);
  });

  it.each([
    ["empty words", () => buildTypingTimeline([], TIMING, "hold"), "non-empty"],
    ["empty word", () => buildTypingTimeline([""], TIMING, "hold"), "non-empty string"],
    [
      "zero timing knob",
      () => buildTypingTimeline(WORDS, { ...TIMING, typeCharMs: 0 }, "hold"),
      "timing.typeCharMs",
    ],
    [
      "negative timing knob",
      () => buildTypingTimeline(WORDS, { ...TIMING, trailMs: -1 }, "hold"),
      "timing.trailMs",
    ],
    [
      "bad endBehavior",
      () =>
        buildTypingTimeline(WORDS, TIMING, "bounce" as unknown as "hold"),
      "endBehavior",
    ],
  ])("throws fail-fast on %s", (_name, run, message) => {
    expect(run).toThrow(message);
  });
});
