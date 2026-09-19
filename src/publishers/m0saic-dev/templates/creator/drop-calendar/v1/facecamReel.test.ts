
import {
  MAX_FACECAM_CLIPS,
  mapFacecamWindow,
  normalizeTransition,
  normalizeTransitionMs,
  resolveFacecamReel,
} from "./facecamReel";

const reelOf = (raw: unknown, opts = {}) => {
  const out = resolveFacecamReel(raw, opts);
  if (!out.reel) throw new Error(`expected a reel, got warnings: ${out.warnings.join(" | ")}`);
  return out.reel;
};

describe("no reel (play the whole facecam)", () => {
  it("returns nothing for absent / empty clips, without warning", () => {
    for (const raw of [undefined, null, []]) {
      const out = resolveFacecamReel(raw);
      expect(out.reel).toBeUndefined();
      expect(out.warnings).toEqual([]);
    }
  });

  it("degrades (with a warning) on an unparsable payload", () => {
    const out = resolveFacecamReel("{not json");
    expect(out.reel).toBeUndefined();
    expect(out.warnings[0]).toContain("whole facecam");
  });

  it("degrades when every clip is unusable", () => {
    const out = resolveFacecamReel([{ startMs: 9000, endMs: 12000 }], {
      sourceDurationMs: 5000,
    });
    expect(out.reel).toBeUndefined();
    expect(out.warnings.some((w) => w.includes("clip #1"))).toBe(true);
    expect(out.warnings.some((w) => w.includes("No usable facecam clips"))).toBe(true);
  });
});

describe("one clip", () => {
  it("is a plain trim — no overlap, reel length = the clip", () => {
    const reel = reelOf([{ startMs: 4000, endMs: 10500, label: "intro" }]);
    expect(reel.clips).toEqual([
      {
        startMs: 4000,
        endMs: 10500,
        durationMs: 6500,
        outStartMs: 0,
        overlapMs: 0,
        label: "intro",
      },
    ]);
    expect(reel.totalMs).toBe(6500);
  });

  it("clamps to the probed source length", () => {
    const out = resolveFacecamReel([{ startMs: 1000, endMs: 99000 }], {
      sourceDurationMs: 8000,
    });
    expect(out.reel?.clips[0]).toMatchObject({ startMs: 1000, endMs: 8000, durationMs: 7000 });
  });
});

describe("multi-clip reel", () => {
  const three = [
    { startMs: 0, endMs: 5000 },
    { startMs: 20000, endMs: 23000 },
    { startMs: 40000, endMs: 42000 },
  ];

  it("overlaps each boundary and shortens the total (out = A + B − d)", () => {
    const reel = reelOf(three, { transitionSec: 0.4 });
    expect(reel.transition).toBe("fade");
    expect(reel.clips.map((c) => c.overlapMs)).toEqual([400, 400, 0]);
    expect(reel.clips.map((c) => c.outStartMs)).toEqual([0, 4600, 7200]);
    expect(reel.totalMs).toBe(5000 + 3000 + 2000 - 800);
  });

  it('"cut" joins with no overlap', () => {
    const reel = reelOf(three, { transitionStyle: "cut", transitionSec: 0.4 });
    expect(reel.clips.map((c) => c.overlapMs)).toEqual([0, 0, 0]);
    expect(reel.clips.map((c) => c.outStartMs)).toEqual([0, 5000, 8000]);
    expect(reel.totalMs).toBe(10000);
  });

  it("clamps an overlap to the shorter neighbor (the engine's rule)", () => {
    const reel = reelOf(
      [
        { startMs: 0, endMs: 5000 },
        { startMs: 10000, endMs: 10300 }, // 300ms — shorter than the transition
        { startMs: 20000, endMs: 25000 },
      ],
      { transitionSec: 1 },
    );
    expect(reel.clips.map((c) => c.overlapMs)).toEqual([300, 300, 0]);
    expect(reel.totalMs).toBe(5000 + 300 + 5000 - 600);
  });

  it("keeps the picked order and skips only the bad entries", () => {
    const out = resolveFacecamReel(
      [
        { startMs: 8000, endMs: 9000 }, // later footage first — user intent
        { startMs: 500, endMs: 400 }, // inverted
        { startMs: 1000, endMs: 2000 },
      ],
      { transitionStyle: "cut" },
    );
    expect(out.reel?.clips.map((c) => c.startMs)).toEqual([8000, 1000]);
    expect(out.warnings.some((w) => w.includes("clip #2"))).toBe(true);
  });

  it("caps the clip count", () => {
    const many = Array.from({ length: MAX_FACECAM_CLIPS + 3 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 500,
    }));
    const out = resolveFacecamReel(many, { transitionStyle: "cut" });
    expect(out.reel?.clips).toHaveLength(MAX_FACECAM_CLIPS);
    expect(out.warnings.some((w) => w.includes("capped"))).toBe(true);
  });

  it("reads the agent-surface shapes (JSON string, numeric-string ms)", () => {
    const reel = reelOf('[{"startMs":"1000","endMs":"3000"},{"startMs":5000,"endMs":6000}]', {
      transitionStyle: "cut",
    });
    expect(reel.clips.map((c) => c.durationMs)).toEqual([2000, 1000]);
  });
});

describe("transition normalization", () => {
  it("takes any engine xfade kernel, falls back to fade", () => {
    expect(normalizeTransition("wipeleft")).toBe("wipeleft");
    expect(normalizeTransition("cut")).toBe("cut");
    expect(normalizeTransition("custom")).toBe("fade"); // deliberately unsupported
    expect(normalizeTransition(undefined)).toBe("fade");
  });

  it("clamps the overlap length", () => {
    expect(normalizeTransitionMs(undefined)).toBe(400);
    expect(normalizeTransitionMs(0)).toBe(50);
    expect(normalizeTransitionMs(99)).toBe(3000);
    expect(normalizeTransitionMs(1.25)).toBe(1250);
  });
});

describe("cue mapping (source time → the cut timeline)", () => {
  const reel = reelOf(
    [
      { startMs: 10000, endMs: 15000 },
      { startMs: 60000, endMs: 64000 },
    ],
    { transitionSec: 0.5 },
  );

  it("carries a cue inside a clip onto its reel position", () => {
    expect(mapFacecamWindow(reel, 12000)).toEqual({ startMs: 2000 });
    // Clip 2 opens at 5000 − 500 (the overlap) = 4500.
    expect(mapFacecamWindow(reel, 61000)).toEqual({ startMs: 5500 });
  });

  it("maps a windowed cue and clamps an end past the cut", () => {
    expect(mapFacecamWindow(reel, 11000, 13000)).toEqual({ startMs: 1000, endMs: 3000 });
    expect(mapFacecamWindow(reel, 14000, 20000)).toEqual({ startMs: 4000, endMs: 5000 });
  });

  it("drops a cue that lands in footage the user cut out", () => {
    expect(mapFacecamWindow(reel, 30000)).toBeUndefined();
    expect(mapFacecamWindow(reel, 15000)).toBeUndefined(); // end is exclusive
  });
});
