import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings } from "@m0saic/template-utils";

import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import { computeStats, money, parseCsv, parseDeals, quarterWindow } from "./deals";
import { PipelineReviewV1 } from "./pipeline-review";
import { Q3_2026_DEALS } from "./q3-2026-deals";
import { MAX_ZOOM, NOTE_CARD, frameOn, noteStops, plannedDurationMs, screenBox } from "./walkthrough";

const render = (
  props: Parameters<typeof PipelineReviewV1.render>[0] = {},
  w = 1920,
  h = 1080,
) => PipelineReviewV1.render({ ...PipelineReviewV1.defaultProps, ...props }, targetCtx(w, h, { durationMs: 18000 })).then(asDocument);

// The head of the real export, as Salesforce writes it (Won column included).
const CSV_HEAD = [
  "Opportunity,Account,Region,Owner,Stage,Amount,CloseMonth,Won",
  "OPP-1001,Northwind Traders,West,Ada Okafor,Closed Won,48000,2026-07,TRUE",
  "OPP-1002,Contoso Ltd,East,Ben Marsh,Closed Won,36000,2026-07,TRUE",
  "OPP-1003,Fabrikam Inc,Central,Chloe Nair,Closed Lost,22000,2026-07,FALSE",
].join("\r\n");

describe("@m0saic-dev/sales/pipeline-review/v1 — the numbers", () => {
  const stats = computeStats(Q3_2026_DEALS, "2026-07");

  it("reduces the Q3 export to the hand-checked totals", () => {
    expect(stats.won).toEqual({ total: 407000, count: 9 });
    expect(stats.lost).toEqual({ total: 77000, count: 3 });
    expect(stats.winRate?.count).toBeCloseTo(0.75);
    expect(stats.winRate?.value).toBeCloseTo(407 / 484);
    expect(stats.open).toEqual({ total: 371000, count: 8, negotiationTotal: 209000 });
    expect(stats.byMonth.map((m) => m.total)).toEqual([145000, 99000, 163000]);
  });

  it("counts an open deal as slipped only when its close month is already past", () => {
    expect(stats.slipped.map((d) => d.row.account)).toEqual([
      "Woodgrove Bank", "Wide World Importers", "Margie's Travel", "Lucerne Publishing",
    ]);
    expect(stats.slippedTotal).toBe(177000);
    // Read as Q4 (at its close), every open deal is due by Dec — all 8 slipped.
    expect(computeStats(Q3_2026_DEALS, "2026-10").slipped).toHaveLength(8);
  });

  it("names who and what carried the quarter", () => {
    expect(stats.byRegion.map((r) => [r.region, r.total])).toEqual([
      ["West", 224000], ["East", 94000], ["South", 60000], ["Central", 29000],
    ]);
    expect(stats.topRep).toMatchObject({ owner: "Ada Okafor", total: 181000 });
    expect(stats.biggestOpen?.row.account).toBe("Blue Yonder Airlines");
  });

  it("formats money and quarters in ASCII the svg font can draw", () => {
    expect([950, 407000, 1_200_000, 2_000_000].map(money)).toEqual(["$950", "$407K", "$1.2M", "$2M"]);
    expect(quarterWindow("2026-07")).toMatchObject({ label: "Q3 2026", span: "Jul-Sep 2026" });
    expect(quarterWindow("2026-11")).toMatchObject({ label: "Nov-Jan 2027", months: ["2026-11", "2026-12", "2027-01"] });
  });
});

describe("@m0saic-dev/sales/pipeline-review/v1 — the deals prop", () => {
  it("reads the raw Salesforce CSV the same as rows", () => {
    const { rows, indexed } = parseDeals(CSV_HEAD);
    expect(indexed).toBe(false);
    expect(rows).toEqual(Q3_2026_DEALS.slice(0, 3));
  });

  it("handles quoted fields, money formatting and US dates", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n')).toEqual([["a", "b, c", 'say "hi"']]);
    const { rows } = parseDeals('Account Name,Stage,Amount,Close Date\n"City Power, Light",Proposal,"$47,000",10/15/2026');
    expect(rows[0]).toMatchObject({ account: "City Power, Light", amount: 47000, closeMonth: "2026-10", region: "Unassigned" });
  });

  it("rejects a row it cannot place, naming the row", async () => {
    await expect(render({ deals: [{ account: "X", stage: "Proposal", amount: 10, closeMonth: "Sept" }] }))
      .rejects.toThrow(/deals\[0\]\.closeMonth/);
    await expect(render({ deals: "Account,Stage\nX,Proposal" })).rejects.toThrow(/no "amount" column/);
  });
});

describe("@m0saic-dev/sales/pipeline-review/v1 — the walkthrough", () => {
  const W = 1920;
  const H = 1080;

  it("frames each headline whole on screen, clear of its note card", () => {
    const kpiTile = { x: 81, y: 216, w: 422, h: 216 };
    const slippedPanel = { x: 1155, y: 475, w: 684, h: 410 };
    const callout = { x: 1155, y: 918, w: 684, h: 113 }; // too low to lift: the card moves up
    const sides = [kpiTile, slippedPanel, callout].map((r) => {
      const f = frameOn(r, W, H);
      const s = screenBox(r, f, W, H);
      const card = { y0: NOTE_CARD[f.card].y * H, y1: (NOTE_CARD[f.card].y + NOTE_CARD[f.card].h) * H };
      expect(f.zoom).toBeGreaterThan(1);
      expect(f.zoom).toBeLessThanOrEqual(MAX_ZOOM);
      expect(s.x0).toBeGreaterThanOrEqual(-0.5);
      expect(s.x1).toBeLessThanOrEqual(W + 0.5);
      expect(s.y0).toBeGreaterThanOrEqual(-0.5);
      expect(s.y1).toBeLessThanOrEqual(H + 0.5);
      expect(s.y1 <= card.y0 || s.y0 >= card.y1).toBe(true);
      return f.card;
    });
    expect(sides).toEqual(["bottom", "bottom", "top"]);
  });

  it("stops only on notes that are set, in reading order, ASCII-safe", () => {
    expect(noteStops({ topRep: "b", closedWon: "a", winRate: "  " }).map((s) => s.key)).toEqual(["closedWon", "topRep"]);
    expect(noteStops({ slipped: "Margie’s — re-date" })[0].note).toBe("Margie's - re-date");
    expect(noteStops(undefined)).toEqual([]);
  });

  it("asks for a clip as long as the notes need, and agrees with its static hints", () => {
    const defaults = PipelineReviewV1.defaultProps ?? {};
    expect(PipelineReviewV1.resolveOutputHints?.(defaults)).toEqual({ durationMs: PipelineReviewV1.outputHints?.durationMs });
    expect(plannedDurationMs(defaults.notes)).toBeGreaterThan(30000);
    expect(plannedDurationMs({})).toBe(18000);
    expect(PipelineReviewV1.resolveOutputHints?.({ ...defaults, animate: false })).toEqual({ durationMs: 18000 });
  });

  it("walks a supersampled dashboard with a camera; no notes renders the plain board", async () => {
    const doc = await render({}, 1920, 1080);
    const held = doc.children?.held as typeof doc;
    const board = held.children?.dashboard as typeof doc;
    expect(board.size).toEqual({ width: 3840, height: 2160 });
    // The camera sits ABOVE the freeze: the engine applies a source's effects
    // before its playback, so both on one source would freeze the camera too.
    const top = doc.sources[0] as { ref?: string; playback?: unknown; effects?: { camera?: Record<string, unknown> } };
    expect(top.ref).toBe("held");
    expect(top.playback).toBeUndefined();
    expect(typeof top.effects?.camera?.zoom).toBe("string");
    const inner = held.sources[0] as { effects?: unknown; playback?: { loopMode?: string } };
    expect(inner.playback?.loopMode).toBe("freeze");
    expect(inner.effects).toBeUndefined();
    expect(board.durationMs).toBeLessThan(held.durationMs ?? 0);
    const plain = await render({ notes: {} });
    expect(plain.children).toBeUndefined();
  });

  it("rejects a note too long for two lines", async () => {
    await expect(render({ notes: { topRep: "x".repeat(141) } })).rejects.toThrow(/notes\.topRep is 141 characters/);
  });
});

describe("@m0saic-dev/sales/pipeline-review/v1 — the render", () => {
  it("binds every rect that shows a prop — including each slipped deal's cells and every note", async () => {
    const doc = await render();
    const { byProp, rejected } = resolvePropBindings(doc, 1920, 1080, { propsSchema: PipelineReviewV1.propsSchema });
    expect(rejected).toEqual([]);
    for (const key of ["title", "subtitle", "target", "quarterStart"]) expect(byProp[key]).toHaveLength(1);
    expect(byProp.accent).toHaveLength(7); // 3 month bars + 4 region bars
    expect(byProp.deals).toHaveLength(16); // 4 slipped rows x account / stage / close / amount
    // Every headline label is a handle for its note; a set note is also its card.
    expect(byProp["notes.closedWon"]).toHaveLength(2);
    expect(byProp["notes.winRate"]).toHaveLength(1);
  });

  it("renders from pasted CSV text, with no leaf bindings to a string", async () => {
    const doc = await render({ deals: CSV_HEAD });
    const { byProp, rejected } = resolvePropBindings(doc, 1920, 1080, { propsSchema: PipelineReviewV1.propsSchema });
    expect(rejected).toEqual([]);
    expect(byProp.deals ?? []).toHaveLength(0);
  });

  it("clears its safe minimum at its own hint — the page and the supersampled board", async () => {
    const doc = await render();
    const ev = evaluateM0(String(doc.m0), { width: 1920, height: 1080 });
    expect(ev.feasible && ev.meetsPrecision).toBe(true);
    const board = (doc.children?.held as typeof doc).children?.dashboard as { m0: unknown };
    const evBoard = evaluateM0(String(board.m0), { width: 3840, height: 2160 });
    expect(evBoard.feasible && evBoard.meetsPrecision).toBe(true);
  });

  it("is deterministic and rejects a bad colour or quarter", async () => {
    expect(await render()).toEqual(await render());
    await expect(render({ accent: "blue" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ quarterStart: "Q3" })).rejects.toThrow(/quarterStart must be YYYY-MM/);
  });
});
