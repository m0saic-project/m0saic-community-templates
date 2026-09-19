import { DUAL_SUB_PRESETS, decideNativeCues, derivePolicy, mulberry32, resolveSupport } from "./policy";

describe("resolveSupport", () => {
  it("maps presets to dial values", () => {
    expect(resolveSupport("training-wheels")).toBe(90);
    expect(resolveSupport("cold-turkey")).toBe(0);
  });
  it("support override wins over preset and clamps", () => {
    expect(resolveSupport("training-wheels", 30)).toBe(30);
    expect(resolveSupport("solo", 250)).toBe(100);
  });
});

describe("derivePolicy", () => {
  it("full scaffold: everything on, no delay", () => {
    const p = derivePolicy(90);
    expect(p.nativeCoverage).toBe(1);
    expect(p.nativeDelayPct).toBe(0);
    expect(p.targetVisible).toBe(true);
  });
  it("try-first: full coverage, delayed", () => {
    const p = derivePolicy(DUAL_SUB_PRESETS["try-first"]);
    expect(p.nativeCoverage).toBe(1);
    expect(p.nativeDelayPct).toBeGreaterThan(0);
  });
  it("safety-net: sparse coverage", () => {
    const p = derivePolicy(20);
    expect(p.nativeCoverage).toBeCloseTo(0.15, 5);
  });
  it("cold-turkey: nothing renders", () => {
    const p = derivePolicy(0);
    expect(p.nativeCoverage).toBe(0);
    expect(p.targetVisible).toBe(false);
  });
  it("opacity floor never drops below legibility floor", () => {
    expect(derivePolicy(0).nativeOpacity).toBeGreaterThanOrEqual(0.65);
    expect(derivePolicy(100).nativeOpacity).toBeCloseTo(0.85, 5);
  });
});

describe("mulberry32", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("decideNativeCues", () => {
  const cues = Array.from({ length: 40 }, (_, i) => ({
    startMs: i * 3000,
    endMs: i * 3000 + 2000,
    text: `line ${i}`,
  }));

  it("same seed → identical decisions; different seed → different draw", () => {
    const policy = derivePolicy(40);
    const a = decideNativeCues(cues, policy, 7).map((d) => d.shown);
    const b = decideNativeCues(cues, policy, 7).map((d) => d.shown);
    const c = decideNativeCues(cues, policy, 8).map((d) => d.shown);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("coverage 1 shows everything; coverage 0 shows nothing", () => {
    expect(decideNativeCues(cues, derivePolicy(90), 7).every((d) => d.shown)).toBe(true);
    expect(decideNativeCues(cues, derivePolicy(0), 7).some((d) => d.shown)).toBe(false);
  });

  it("delay clamps to [min, max] and never reveals past 80% of the cue", () => {
    const policy = derivePolicy(40);
    const [d] = decideNativeCues([{ startMs: 1000, endMs: 1500, text: "x" }], policy, 7);
    expect(d.revealMs).toBeLessThanOrEqual(1000 + 500 * 0.8);
    const [long] = decideNativeCues([{ startMs: 0, endMs: 60000, text: "y" }], policy, 7);
    expect(long.revealMs - 0).toBeLessThanOrEqual(policy.nativeDelayMaxMs);
  });
});
