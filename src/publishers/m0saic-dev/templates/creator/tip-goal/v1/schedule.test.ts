
import {
  buildCounterTextExpr,
  buildFillXExpr,
  buildTipFlashGate,
  evalAnchors,
  generateAutoTips,
  resolveSchedule,
  splitTotal,
  MAX_TIPS,
} from "./schedule";

const baseInput = {
  startAmount: 0,
  goalAmount: 100,
  riseSec: 0.6,
  riseEase: "easeOut" as const,
};

describe("auto generator", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = generateAutoTips({ seed: 7 }, 0, 100, 15, []);
    const b = generateAutoTips({ seed: 7 }, 0, 100, 15, []);
    const c = generateAutoTips({ seed: 8 }, 0, 100, 15, []);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("sums exactly to goal - start with integer tips >= 1", () => {
    const tips = generateAutoTips({ seed: 3, tipCount: 12 }, 10, 100, 15, []);
    expect(tips).toHaveLength(12);
    expect(tips.reduce((s, t) => s + t.amount, 0)).toBe(90);
    for (const t of tips) {
      expect(Number.isInteger(t.amount)).toBe(true);
      expect(t.amount).toBeGreaterThanOrEqual(1);
    }
  });

  it("stays inside [startDelay, finishFrac*duration], ascending", () => {
    const tips = generateAutoTips(
      { seed: 2, startDelaySec: 2, finishFrac: 0.8 },
      0,
      100,
      20,
      [],
    );
    for (let i = 0; i < tips.length; i++) {
      expect(tips[i].atSec).toBeGreaterThanOrEqual(2);
      expect(tips[i].atSec).toBeLessThanOrEqual(16 + 1e-9);
      if (i > 0) expect(tips[i].atSec).toBeGreaterThanOrEqual(tips[i - 1].atSec);
    }
    // The last tip lands the goal at the window end.
    expect(tips[tips.length - 1].atSec).toBeCloseTo(16, 3);
  });

  it("shrinks the tip count when the pot is smaller than the count", () => {
    const tips = generateAutoTips({ seed: 1, tipCount: 12 }, 0, 5, 15, []);
    expect(tips.length).toBeLessThanOrEqual(5);
    expect(tips.reduce((s, t) => s + t.amount, 0)).toBe(5);
  });

  it("start >= goal → no tips + a warning", () => {
    const warnings: string[] = [];
    const tips = generateAutoTips({}, 100, 100, 15, warnings);
    expect(tips).toEqual([]);
    expect(warnings.length).toBe(1);
  });
});

describe("splitTotal", () => {
  it("integer split conserves the total", () => {
    const out = splitTotal(100, [1, 2, 3, 4, 5]);
    expect(out.reduce((a, b) => a + b, 0)).toBe(100);
    for (const v of out) expect(v).toBeGreaterThanOrEqual(1);
  });

  it("fractional totals fold the residue into the last tip", () => {
    const out = splitTotal(10.5, [1, 1, 1]);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(10.5, 9);
  });
});

describe("tips → anchors", () => {
  it("holds, then rises over riseSec on each tip", () => {
    const out = resolveSchedule(
      { ...baseInput, tips: [{ atSec: 5, amount: 20 }, { atSec: 10, amount: 30 }] },
      15,
    );
    if (!out.ok) throw new Error(out.message);
    expect(out.mode).toBe("tips");
    expect(out.tipTimes).toEqual([5, 10]);
    expect(out.finalAmount).toBe(50);
    // Before the first tip: the start amount. Mid-rise: strictly between.
    expect(evalAnchors(out.anchors, 0)).toBe(0);
    expect(evalAnchors(out.anchors, 4.99)).toBe(0);
    const mid = evalAnchors(out.anchors, 5.3);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(20);
    expect(evalAnchors(out.anchors, 7)).toBe(20);
    expect(evalAnchors(out.anchors, 14)).toBe(50);
  });

  it("crowded tips shorten the rise instead of overlapping", () => {
    const out = resolveSchedule(
      { ...baseInput, tips: [{ atSec: 5, amount: 10 }, { atSec: 5.2, amount: 10 }] },
      15,
    );
    if (!out.ok) throw new Error(out.message);
    // Anchor times strictly non-decreasing.
    for (let i = 1; i < out.anchors.length; i++) {
      expect(out.anchors[i].t).toBeGreaterThanOrEqual(out.anchors[i - 1].t);
    }
  });

  it("refunds clamp the running total at 0", () => {
    const out = resolveSchedule(
      { ...baseInput, tips: [{ atSec: 2, amount: -50 }] },
      15,
    );
    if (!out.ok) throw new Error(out.message);
    expect(out.finalAmount).toBe(0);
  });

  it("over the tip budget → TG_TOO_DENSE", () => {
    const tips = Array.from({ length: MAX_TIPS + 1 }, (_, i) => ({
      atSec: i * 0.05,
      amount: 1,
    }));
    const out = resolveSchedule({ ...baseInput, tips }, 60);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("TG_TOO_DENSE");
  });
});

describe("schedule (absolute keys)", () => {
  it("wins over tips and flashes on rising keys only", () => {
    const out = resolveSchedule(
      {
        ...baseInput,
        tips: [{ atSec: 1, amount: 5 }],
        schedule: [
          { atSec: 0, amount: 0 },
          { atSec: 5, amount: 40 },
          { atSec: 8, amount: 40 },
          { atSec: 12, amount: 100 },
        ],
      },
      15,
    );
    if (!out.ok) throw new Error(out.message);
    expect(out.mode).toBe("schedule");
    // Rising segments leave keys 0 and 8 (5→40 rises from t=0's key… flash
    // cues are the PREVIOUS key time of each rise).
    expect(out.tipTimes).toEqual([0, 8]);
    expect(out.finalAmount).toBe(100);
  });

  it("an empty schedule array falls through to auto", () => {
    const out = resolveSchedule({ ...baseInput, schedule: [] }, 15);
    if (!out.ok) throw new Error(out.message);
    expect(out.mode).toBe("auto");
  });

  it("a non-array schedule → TG_SCHEDULE_PARSE", () => {
    const out = resolveSchedule({ ...baseInput, schedule: "x" }, 15);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("TG_SCHEDULE_PARSE");
  });
});

describe("expression builders", () => {
  const anchors = [
    { t: 0, v: 0 },
    { t: 5, v: 0, ease: "easeOut" as const },
    { t: 5.6, v: 120 },
  ];

  it("fill xExpr slides by the goal-clamped fraction", () => {
    const expr = buildFillXExpr(anchors, 100);
    expect(expr.startsWith("-(w*(1-(")).toBe(true);
    // 120/100 clamps to 1 → the final key emits 1.00000.
    expect(expr).toContain("1.00000");
    expect(expr).not.toContain("1.20000");
  });

  it("counter expr is drawtext-safe (escaped commas, eif wrapper)", () => {
    const expr = buildCounterTextExpr(anchors, "$", " / $100");
    expect(expr.startsWith("$%{eif\\:(")).toBe(true);
    expect(expr.endsWith("\\:d} / $100")).toBe(true);
    // Every comma inside the expansion is escaped.
    expect(expr).not.toMatch(/[^\\],/);
  });

  it("literal prefix/suffix control chars are escaped", () => {
    const expr = buildCounterTextExpr(anchors, "100%", "{x}");
    expect(expr).toContain("100\\%");
    expect(expr).toContain("\\{x\\}");
  });

  it("flash gate is a rebalanced between-union with a window", () => {
    const gate = buildTipFlashGate([2, 8.5]);
    if (!gate) throw new Error("expected a gate");
    expect(gate.enable).toContain("between(t,2.000,2.250)");
    expect(gate.enable).toContain("between(t,8.500,8.750)");
    expect(gate.window).toEqual({ startSec: 2, endSec: 8.75 });
    expect(buildTipFlashGate([])).toBeUndefined();
  });
});
