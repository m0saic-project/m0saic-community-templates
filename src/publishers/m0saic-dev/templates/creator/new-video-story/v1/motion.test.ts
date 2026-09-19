import {
  arrowMotion,
  bobTerm,
  dropIn,
  easeOutBackExpr,
  popIn,
  riseIn,
  slideInX,
  ARROW_RISE_SEC,
  BOB_PERIOD_SEC,
  POP_SEC,
  SETTLED_AT_SEC,
  STORY_TIMELINE,
} from "./motion";

/**
 * Evaluate an overlay expression at time `t` the way ffmpeg (and the app
 * preview's evaluator) would: the only names these exprs use are min / max
 * / pow / cos / gte / PI / t, all of which map 1:1 onto JS.
 */
function ev(expr: string, t: number): number {
  const fn = new Function(
    "t",
    "min",
    "max",
    "pow",
    "cos",
    "gte",
    "PI",
    `return (${expr});`,
  ) as (t: number, ...helpers: unknown[]) => number;
  return fn(
    t,
    Math.min,
    Math.max,
    Math.pow,
    Math.cos,
    (a: number, b: number) => (a >= b ? 1 : 0),
    Math.PI,
  );
}

function onlyKnownNames(expr: string): boolean {
  const names = expr.match(/[A-Za-z_]+/g) ?? [];
  return names.every((n) => ["min", "max", "pow", "cos", "gte", "PI", "t"].includes(n));
}

describe("timeline", () => {
  it("runs in order and settles before the poster time", () => {
    const T = STORY_TIMELINE;
    expect(T.mediaAt).toBe(0);
    expect(T.headlineTopAt).toBeLessThan(T.headlineMainAt);
    expect(T.headlineMainAt).toBeLessThan(T.badgeAt);
    expect(T.badgeAt).toBeLessThan(T.ctaAt);
    expect(T.ctaAt).toBeLessThan(T.arrowsAt[0]);
    expect(T.arrowsAt[0]).toBeLessThan(T.arrowsAt[1]);
    expect(T.arrowsAt[1]).toBeLessThan(T.arrowsAt[2]);
    expect(T.arrowsAt[2]).toBeLessThan(T.pillAt);
    expect(T.bobAt).toBeCloseTo(T.arrowsAt[2] + ARROW_RISE_SEC, 5);
    // Poster: after the pill settles, on a bob rest point.
    expect(SETTLED_AT_SEC).toBeGreaterThanOrEqual(T.pillAt + POP_SEC);
    expect(SETTLED_AT_SEC).toBeLessThan(3);
    expect(((SETTLED_AT_SEC - T.bobAt) / BOB_PERIOD_SEC) % 1).toBeCloseTo(0, 6);
  });
});

describe("easeOutBackExpr", () => {
  it("0 at the start, overshoots past 1, settles at exactly 1", () => {
    const e = easeOutBackExpr(1, 0.5);
    expect(ev(e, 0)).toBeCloseTo(0, 6);
    expect(ev(e, 1)).toBeCloseTo(0, 6);
    const mid = ev(e, 1.35);
    expect(mid).toBeGreaterThan(1);
    expect(ev(e, 1.5)).toBeCloseTo(1, 6);
    expect(ev(e, 9)).toBeCloseTo(1, 6);
    expect(onlyKnownNames(e)).toBe(true);
  });
});

describe("entrances (pixel literals, absolute time)", () => {
  it("slideInX: off by the full distance before start, at rest after", () => {
    const m = slideInX(0.25, 0.5, -799);
    expect(m.enable).toBe("gte(t,0.25)");
    expect(m.startAtSec).toBe(0.25);
    expect(m.window).toEqual({ startSec: 0.25 });
    expect(ev(m.xExpr!, 0)).toBeCloseTo(-799, 6);
    expect(ev(m.xExpr!, 0.25)).toBeCloseTo(-799, 6);
    const half = ev(m.xExpr!, 0.5);
    expect(half).toBeGreaterThan(-799);
    expect(half).toBeLessThan(0);
    expect(ev(m.xExpr!, 0.75)).toBeCloseTo(0, 6);
    expect(ev(m.xExpr!, 5)).toBeCloseTo(0, 6);
    expect(m.alpha).toBeUndefined();
    expect(onlyKnownNames(m.xExpr!)).toBe(true);
  });

  it("dropIn: starts above by the distance, dips below rest on the bounce, settles at 0", () => {
    const m = dropIn(0.55, 0.55, -300);
    expect(ev(m.yExpr!, 0.55)).toBeCloseTo(-300, 6);
    const samples = [0.7, 0.8, 0.9, 0.95, 1.0, 1.05].map((t) => ev(m.yExpr!, t));
    expect(Math.max(...samples)).toBeGreaterThan(0); // the overshoot
    expect(ev(m.yExpr!, 1.1)).toBeCloseTo(0, 6);
    expect(m.enable).toBe("gte(t,0.55)");
  });

  it("riseIn: alpha 0→1 while drifting up from driftPx", () => {
    const m = riseIn(0.85, 0.45, 30);
    expect(ev(m.alpha!, 0.85)).toBeCloseTo(0, 6);
    expect(ev(m.yExpr!, 0.85)).toBeCloseTo(30, 6);
    expect(ev(m.alpha!, 1.3)).toBeCloseTo(1, 6);
    expect(ev(m.yExpr!, 1.3)).toBeCloseTo(0, 6);
    const a = ev(m.alpha!, 1.0);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
    expect(m.enable).toBeUndefined();
    expect(m.window).toEqual({ startSec: 0.85 });
  });

  it("popIn: a fast fade with an overshooting rise from below", () => {
    const m = popIn(1.65, 0.5, 71);
    expect(ev(m.alpha!, 1.65)).toBeCloseTo(0, 6);
    // The fade is done well before the motion settles.
    expect(ev(m.alpha!, 1.65 + 0.5 * 0.45)).toBeCloseTo(1, 6);
    expect(ev(m.yExpr!, 1.65)).toBeCloseTo(71, 6);
    const samples = [1.9, 1.95, 2.0, 2.05, 2.1].map((t) => ev(m.yExpr!, t));
    expect(Math.min(...samples)).toBeLessThan(0); // rises past rest, then settles
    expect(ev(m.yExpr!, 2.15)).toBeCloseTo(0, 6);
  });
});

describe("arrow bob", () => {
  it("bobTerm: 0 before and at the start, peaks at half a period, back to 0 at a period", () => {
    const b = bobTerm(1.75, 23);
    expect(ev(b, 0)).toBe(0);
    expect(ev(b, 1.75)).toBeCloseTo(0, 6);
    expect(ev(b, 1.75 + BOB_PERIOD_SEC / 2)).toBeCloseTo(23, 6);
    expect(ev(b, 1.75 + BOB_PERIOD_SEC)).toBeCloseTo(0, 6);
    expect(ev(b, 1.75 + 7 * BOB_PERIOD_SEC + BOB_PERIOD_SEC / 2)).toBeCloseTo(23, 6);
    expect(onlyKnownNames(b)).toBe(true);
  });

  it("arrowMotion: the rise then the bob, continuous at the hand-off", () => {
    const m = arrowMotion(1.15, 35, 1.75, 23);
    expect(ev(m.alpha!, 1.15)).toBeCloseTo(0, 6);
    expect(ev(m.yExpr!, 1.15)).toBeCloseTo(35, 6);
    // Arrived and still (rise done at 1.45, bob not yet started).
    expect(ev(m.yExpr!, 1.6)).toBeCloseTo(0, 6);
    expect(ev(m.yExpr!, 1.75)).toBeCloseTo(0, 6);
    // Bobbing: always downward (≥ 0), never past the amplitude.
    for (let t = 1.75; t < 8; t += 0.05) {
      const y = ev(m.yExpr!, t);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(23 + 1e-9);
    }
    expect(m.window).toEqual({ startSec: 1.15 });
  });
});
