import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings, resolveTemplateOutputHints } from "@m0saic/template-utils";

import { sweepLayout } from "./layout";
import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import {
  RECAP_PLATFORMS,
  RECAP_THEME_COLORS,
  RUN_RECAP_SHOWN_STEPS,
  RunRecapV1,
  durationText,
  layoutRunRecap,
  recapBeats,
  shownSteps,
  stepMeta,
  type RecapCopy,
  type RecapStep,
  type RunRecapProps,
} from "./run-recap";

const ID = "@m0saic-dev/devops/run-recap/v1";

const render = (props: RunRecapProps = {}, w = 1920, h = 1080) =>
  RunRecapV1.render({ ...RunRecapV1.defaultProps, ...props }, targetCtx(w, h)).then(asDocument);

const sweep = (props: RunRecapProps = {}) =>
  sweepLayout((p, ctx) => RunRecapV1.render({ ...RunRecapV1.defaultProps, ...p }, ctx).then(asDocument), ID, props, (w, h) => targetCtx(w, h));

const step = (name: string, i: number, extra: Partial<RecapStep> = {}): RecapStep => ({ name, kind: "run", status: "passed", durationSec: 10, retries: 0, index: i, ...extra });

const COPY: RecapCopy = {
  brandName: "Acme Engineering",
  hasLogo: false,
  kicker: "Run report",
  workflowName: "implement-issue",
  status: "succeeded",
  triggerLabel: "Ticket ACME-482 - Fix null pointer in checkout",
  startedLabel: "Tue 7 Oct, 09:08",
  durationLabel: "6m 12s",
  steps: [step("Triage", 0, { kind: "agent", durationSec: 42 }), step("Fix issue", 1, { kind: "agent", durationSec: 190, retries: 1 }), step("npm test", 2, { durationSec: 62 })],
  outcomeTitle: "PR #482 is ready for review",
  summary: "Null-checked the cart total and added a regression test.",
  stats: [{ label: "files changed", value: "4" }, { label: "tests", value: "212 passed" }],
  costLabel: "3 agent steps - $0.77",
  outcomeUrl: "git.example/acme/shop/pull/482",
};

const labelsOf = (doc: Awaited<ReturnType<typeof render>>) => doc.sources.map((s) => (s as { editor?: { label?: string } }).editor?.label);

describe(ID, () => {
  it("binds the run's fields, each step's name and duration, and each stat's leaves", async () => {
    const doc = await render();
    const { byProp, rejected } = resolvePropBindings(doc, 1920, 1080, { propsSchema: RunRecapV1.propsSchema });
    expect(rejected).toEqual([]);
    for (const key of ["brandName", "workflowName", "triggerLabel", "outcomeTitle", "summary", "costLabel", "outcomeUrl", "accent"]) {
      expect(byProp[key]?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    // Five steps, two leaves each; four stats, two leaves each; the wordmark is the logo's drop target.
    expect(byProp.steps).toHaveLength(10);
    expect(byProp.stats).toHaveLength(8);
    expect(byProp.brandLogo).toHaveLength(1);
  });

  it("holds its layout contract at the seven canvases: defaults, a failed run with long names, two steps, twelve steps, a logo", async () => {
    await sweep();
    await sweep({
      status: "failed",
      workflowName: "nightly-dependency-upgrade-and-regression-suite",
      triggerLabel: "Scheduled - every weekday at 02:00 UTC, after the release train has closed",
      steps: [
        { name: "Resolve the dependency graph and plan the upgrade order", kind: "agent", durationSec: 1310 },
        { name: "pnpm install --frozen-lockfile", kind: "run", durationSec: 250 },
        { name: "Full regression suite", kind: "run", status: "failed", durationSec: 3725, retries: 2 },
      ],
      outcomeTitle: "Regression suite failed twice on the payments package - needs a human",
      summary: "Two retries of the suite failed on the same integration test. The agent left a diagnosis on the ticket and did not open a pull request; the lockfile change is on a branch.",
      stats: [{ label: "packages bumped", value: "37" }, { label: "tests", value: "4,118 of 4,120" }, { label: "retries", value: "2" }, { label: "agent cost", value: "$3.41" }],
    });
    await sweep({ steps: [{ name: "Answer", kind: "agent", durationSec: 9 }, { name: "Reply", kind: "tool", durationSec: 1 }], stats: [], summary: "", costLabel: "", outcomeUrl: "", kicker: "", triggerLabel: "", startedLabel: "", durationLabel: "" });
    await sweep({ steps: Array.from({ length: 12 }, (_, i) => ({ name: `Step ${i + 1}`, kind: (["agent", "run", "tool"] as const)[i % 3], durationSec: 5 * (i + 1) })) });
    await sweep({ brandLogo: ["C:/brand/mark.png"], theme: "light" });
  }, 120_000);

  it("re-flows: a row of cards in landscape and square, a list in portrait", () => {
    const wide = layoutRunRecap(COPY, 1920, 1080);
    const square = layoutRunRecap(COPY, 1080, 1080);
    const tall = layoutRunRecap(COPY, 1080, 1920);
    expect(wide.stacked).toBe(false);
    expect(square.stacked).toBe(false);
    expect(tall.stacked).toBe(true);
    // Row: same y, increasing x, a rail behind. List: same x, increasing y, no rail.
    expect(new Set(wide.cards.map((c) => c.rect.y)).size).toBe(1);
    expect(wide.cards[1].rect.x).toBeGreaterThan(wide.cards[0].rect.x);
    expect(wide.rail).not.toBeNull();
    expect(new Set(tall.cards.map((c) => c.rect.x)).size).toBe(1);
    expect(tall.cards[1].rect.y).toBeGreaterThan(tall.cards[0].rect.y);
    expect(tall.rail).toBeNull();
    // The outcome sits under the steps everywhere; the pill hugs its url.
    for (const L of [wide, square, tall]) {
      const stepsBottom = Math.max(...L.cards.map((c) => c.rect.y + c.rect.h));
      expect(L.outcome.rect.y).toBeGreaterThan(stepsBottom);
      expect(L.pill!.w).toBeLessThan(L.W * 0.5 + 1);
      expect(L.tiles).toHaveLength(2);
    }
  });

  it("collapses past six cards into '+N more', carrying a failure forward", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => step(`s${i}`, i, { status: i === 10 ? "failed" : "passed" }));
    const shown = shownSteps(twelve);
    expect(shown).toHaveLength(RUN_RECAP_SHOWN_STEPS);
    expect(shown[RUN_RECAP_SHOWN_STEPS - 1]).toMatchObject({ name: "+7 more", status: "failed", index: -1 });
    expect(shownSteps(twelve.slice(0, 6))).toHaveLength(6);
    // The meta line: kind, duration, retries.
    expect(durationText(42)).toBe("42s");
    expect(durationText(190)).toBe("3m 10s");
    expect(durationText(3725)).toBe("1h 02m");
    expect(stepMeta(step("x", 0, { kind: "agent", durationSec: 190, retries: 1 }))).toBe("AGENT - 3m 10s - retried x1");
    expect(stepMeta(step("x", 0, { durationSec: null, status: "skipped" }))).toBe("RUN - skipped");
  });

  it("times the outcome to follow the last card, not a fixed share", () => {
    const five = recapBeats(14, 5);
    const two = recapBeats(14, 2);
    expect(five.cuts[0]).toBe(1.4);
    expect(two.cuts[1]).toBeLessThan(five.cuts[1]);
    expect(five.cuts[1]).toBeLessThanOrEqual(7);
    // Even twelve-step runs on the shortest clip leave the outcome time to land.
    const packed = recapBeats(8, 6);
    expect(packed.cuts[1]).toBeLessThanOrEqual(4);
  });

  it("colours the badge by status, starts from a dark or light theme, and takes a logo", async () => {
    const ok = await render();
    const failed = await render({ status: "failed" });
    const pill = (doc: Awaited<ReturnType<typeof render>>) => doc.sources.find((s) => (s as { editor?: { label?: string } }).editor?.label === "status-pill") as { color?: string } | undefined;
    expect(pill(ok)?.color).toBe("#22a06b");
    expect(pill(failed)?.color).toBe("#e5484d");
    expect(ok.backgroundColor).toBe(RECAP_THEME_COLORS.dark.background);
    expect((await render({ theme: "light" })).backgroundColor).toBe(RECAP_THEME_COLORS.light.background);
    expect((await render({ theme: "light", background: "#ffffff" })).backgroundColor).toBe("#ffffff");
    const mp4 = await render({ brandLogo: ["C:/brand/mark-loop.mp4"] });
    expect(labelsOf(mp4)).toContain("logo");
    expect(labelsOf(mp4)).not.toContain("wordmark");
    expect(mp4.assets["brand-logo" as keyof typeof mp4.assets]).toMatchObject({ kind: "file", mediaType: "video" });
  });

  it("lets the platform knob pick the canvas a host seeds, without ever throwing from the hint", async () => {
    const hints = (props: RunRecapProps) => resolveTemplateOutputHints(RunRecapV1, { ...RunRecapV1.defaultProps, ...props });
    expect(hints({})).toMatchObject({ width: 1920, height: 1080, durationMs: 14_000 });
    for (const [key, dims] of Object.entries(RECAP_PLATFORMS)) {
      expect(hints({ platform: key })).toMatchObject(dims);
    }
    expect(hints({ platform: "Mobile" })).toMatchObject(RECAP_PLATFORMS.mobile);
    expect(hints({ platform: "fax" })).toMatchObject({ width: 1920, height: 1080 });
    await expect(render({ platform: "fax" })).rejects.toThrow(/platform/);
    expect(RunRecapV1.outputHints).toMatchObject(RECAP_PLATFORMS.chat);
    for (const dims of Object.values(RECAP_PLATFORMS)) {
      await sweepLayout((p, ctx) => RunRecapV1.render({ ...RunRecapV1.defaultProps, ...p }, ctx).then(asDocument), ID, {}, (w, h) => targetCtx(w, h), [[dims.width, dims.height]]);
    }
  }, 60_000);

  it("clears its safe minimum at its own hint, is deterministic, and accepts steps as a JSON string", async () => {
    const doc = await render();
    const ev = evaluateM0(String(doc.m0), { width: 1920, height: 1080 });
    expect(ev.feasible && ev.meetsPrecision).toBe(true);
    expect(doc.durationMs).toBe(14_000);
    expect(await render()).toEqual(await render());
    const asString = await render({ steps: JSON.stringify([{ name: "Only step", kind: "tool" }]) as unknown as RunRecapProps["steps"] });
    expect(labelsOf(asString)).toContain("step-0-name");
    expect(labelsOf(asString)).not.toContain("step-1-name");
  });

  it("is the gate: a bad status, kind, duration, an empty step name, too many steps or a bad colour is refused", async () => {
    await expect(render({ status: "done" })).rejects.toThrow(/status/);
    await expect(render({ steps: [{ name: "x", kind: "cron" }] })).rejects.toThrow(/steps\[0\]\.kind/);
    await expect(render({ steps: [{ name: "x", durationSec: -1 }] })).rejects.toThrow(/durationSec/);
    await expect(render({ steps: [{ name: "" }] })).rejects.toThrow(/steps\[0\]\.name/);
    await expect(render({ steps: [] })).rejects.toThrow(/1 to 12/);
    await expect(render({ steps: Array.from({ length: 13 }, (_, i) => ({ name: `s${i}` })) })).rejects.toThrow(/1 to 12/);
    await expect(render({ stats: [{ label: "", value: "3" }] })).rejects.toThrow(/stats\[0\]/);
    await expect(render({ accent: "blue" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ workflowName: "" })).rejects.toThrow(/workflowName/);
    await expect(render({ durationSec: 5 })).rejects.toThrow(/durationSec/);
  });
});
