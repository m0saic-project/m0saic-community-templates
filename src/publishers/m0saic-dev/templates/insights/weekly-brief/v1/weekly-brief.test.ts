// The brief nests the official charts by id; registering the official pack
// (a devDependency, tests only — check-deps skips *.test.ts) is what makes the
// nested renders below resolve, as they do in every host.
import "@m0saic/templates";
import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings, resolveTemplateOutputHints } from "@m0saic/template-utils";

import { sweepLayout } from "./layout";
import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import {
  BRIEF_BAD,
  BRIEF_BAR_GRAPH_ID,
  BRIEF_GOOD,
  BRIEF_LINE_CHART_ID,
  BRIEF_MIN_CHART_H,
  BRIEF_MIN_CHART_W,
  BRIEF_PLATFORMS,
  BRIEF_THEME_COLORS,
  WeeklyBriefV1,
  briefBeats,
  formatDelta,
  formatValue,
  layoutWeeklyBrief,
  lineDomain,
  noteStops,
  plannedDurationMs,
  trendOfDelta,
  type BriefCopy,
  type BriefMetric,
  type BriefMetricInput,
  type WeeklyBriefProps,
} from "./weekly-brief";
import { MAX_ZOOM, dwellSec, frameOn, planWalk } from "./walkthrough";

const ID = "@m0saic-dev/insights/weekly-brief/v1";

/** The defaults carry one note (a stop); the plain board is the defaults without it. */
const PLAIN_METRICS = (WeeklyBriefV1.defaultProps.metrics as BriefMetricInput[]).map(({ note: _note, ...m }) => m);
const plainProps = (props: WeeklyBriefProps): WeeklyBriefProps => ({ metrics: PLAIN_METRICS, ...props });

const render = (props: WeeklyBriefProps = {}, w = 1920, h = 1080) =>
  WeeklyBriefV1.render({ ...WeeklyBriefV1.defaultProps, ...plainProps(props) }, targetCtx(w, h)).then(asDocument);

const sweep = (props: WeeklyBriefProps = {}) =>
  sweepLayout((p, ctx) => WeeklyBriefV1.render({ ...WeeklyBriefV1.defaultProps, ...plainProps(p) }, ctx).then(asDocument), ID, props, (w, h) => targetCtx(w, h));

const metric = (label: string, i: number, extra: Partial<BriefMetric> = {}): BriefMetric => ({
  label,
  value: "1,000",
  delta: "+1.0%",
  trend: "up",
  upIsGood: true,
  series: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  chart: "line",
  caption: "A caption.",
  note: "",
  index: i,
  ...extra,
});

const COPY: BriefCopy = {
  brandName: "Harbor & Pine",
  hasLogo: false,
  title: "Weekly brief",
  periodLabel: "Week of 6 Oct 2026",
  greeting: "Good morning",
  recipientName: "Dana",
  headline: "Revenue is up 8% on last week.",
  metrics: [metric("Net revenue", 0), metric("Orders", 1, { chart: "bars" }), metric("New customers", 2), metric("Repeat rate", 3)],
  deltaLabel: "vs last week",
  highlights: ["One.", "Two."],
  footer: "4 questions, answered live.",
  ctaUrl: "brief.example/w41",
};

type Src = { editor?: { label?: string; binding?: { propKey?: string; path?: unknown[] } }; color?: string; type?: string; ref?: string; layers?: Array<{ style?: { fontColor?: string }; content?: { text?: string } }> };
type Doc = Awaited<ReturnType<typeof render>> & { children?: Record<string, { sources?: unknown[]; children?: Record<string, unknown> }> };
const srcs = (doc: Doc) => doc.sources as unknown as Src[];
const labelsOf = (doc: Doc) => srcs(doc).map((s) => s.editor?.label);
const src = (doc: Doc, label: string) => srcs(doc).find((s) => s.editor?.label === label);
const textOf = (doc: Doc, label: string) => src(doc, label)?.layers?.[0]?.content?.text;
const colorOf = (doc: Doc, label: string) => src(doc, label)?.layers?.[0]?.style?.fontColor;

describe(ID, () => {
  it("derives every number from the series, so the value, the delta and the chart cannot disagree", async () => {
    const doc = await render({
      metrics: [
        { label: "Revenue", format: "currency", series: [300000, 412000] },
        { label: "Orders", format: "number", series: [3030, 3184], chart: "bars" },
        { label: "Repeat rate", format: "percent", series: [39, 41] },
        { label: "Falling", format: "number", series: [131, 129] },
      ],
    });
    expect(textOf(doc, "metric-0-value")).toBe("$412K");
    expect(textOf(doc, "metric-0-delta")).toBe("+37.3%");
    expect(textOf(doc, "metric-1-value")).toBe("3,184");
    expect(textOf(doc, "metric-1-delta")).toBe("+5.1%");
    expect(textOf(doc, "metric-2-value")).toBe("41%");
    expect(textOf(doc, "metric-2-delta")).toBe("+2.0 pts");
    expect(textOf(doc, "metric-3-delta")).toBe("-1.5%");
    expect(colorOf(doc, "metric-3-delta")).toBe(BRIEF_BAD);
    // The handles edit the DATA: the value rect binds the last point, the delta the one before.
    expect(src(doc, "metric-0-value")?.editor?.binding).toMatchObject({ propKey: "metrics", path: [0, "series", 1] });
    expect(src(doc, "metric-0-delta")?.editor?.binding).toMatchObject({ propKey: "metrics", path: [0, "series", 0] });
    // A number typed beside the data is refused - it could contradict the chart.
    await expect(render({ metrics: [{ label: "A", series: [1, 2], value: "$9" }] })).rejects.toThrow(/come from the series/);
    await expect(render({ metrics: [{ label: "A", series: [1, 2], delta: "+1%" }] })).rejects.toThrow(/come from the series/);
    // A one-off number with no series still works, and binds its own text.
    const one = await render({ metrics: [{ label: "NPS", value: "62", delta: "+4" }] });
    expect(textOf(one, "metric-0-value")).toBe("62");
    expect(src(one, "metric-0-value")?.editor?.binding).toMatchObject({ propKey: "metrics", path: [0, "value"] });
    expect(labelsOf(one)).not.toContain("metric-0-chart");
  });

  it("formats like a stat tile", () => {
    expect(formatValue(412000, "currency")).toBe("$412K");
    expect(formatValue(4200000, "currency")).toBe("$4.2M");
    expect(formatValue(129, "currency")).toBe("$129");
    expect(formatValue(3184, "number")).toBe("3,184");
    expect(formatValue(12900, "number")).toBe("12.9K");
    expect(formatValue(41, "percent")).toBe("41%");
    expect(formatValue(41.26, "percent", 1)).toBe("41.3%");
    expect(formatDelta(412, 381, "currency")).toBe("+8.1%");
    expect(formatDelta(129, 131, "number")).toBe("-1.5%");
    expect(formatDelta(41, 39, "percent")).toBe("+2.0 pts");
    expect(formatDelta(5, 5, "number")).toBe("0.0%");
    expect(formatDelta(5, 0, "number")).toBe("");
    expect(trendOfDelta("+8.1%")).toBe("up");
    expect(trendOfDelta("-1.5%")).toBe("down");
    expect(trendOfDelta("0.0%")).toBe("flat");
    expect(lineDomain([34, 41])).toEqual({ minValue: 33.3, maxValue: 41.7 });
    expect(lineDomain([5, 5]).maxValue).toBeGreaterThan(5);
  });

  it("nests the shipped chart templates, one child per charted tile, timed to the tile", async () => {
    const doc = (await render()) as Doc;
    const refs = Object.keys(doc.children ?? {});
    expect(refs).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      const chart = src(doc, `metric-${i}-chart`);
      expect(chart).toMatchObject({ type: "mosaic", ref: `chart-${i}` });
      expect(doc.children?.[`chart-${i}`]?.sources?.length ?? 0).toBeGreaterThan(0);
    }
    // The line chart nests its chrome, which nests the grid - the whole vendored closure resolves.
    expect(doc.children?.["chart-0"]?.children).toHaveProperty("chrome");
    expect(BRIEF_LINE_CHART_ID).toBe("@m0saic/charts/line-chart/v2");
    expect(BRIEF_BAR_GRAPH_ID).toBe("@m0saic/charts/bar-graph/v3");
  });

  it("binds the brief's fields, each metric's four leaves plus its note handle, and each highlight", async () => {
    const doc = await render();
    const { byProp, rejected } = resolvePropBindings(doc, 1920, 1080, { propsSchema: WeeklyBriefV1.propsSchema });
    expect(rejected).toEqual([]);
    for (const key of ["brandName", "title", "periodLabel", "deltaLabel", "recipientName", "headline", "footer", "ctaUrl", "accent"]) {
      expect(byProp[key]?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    // label, value (series[last]), delta (series[last-1]), caption - and the card as the "add a note" handle.
    expect(byProp.metrics).toHaveLength(30);
    expect(byProp.highlights).toHaveLength(3);
    expect(byProp.brandLogo).toHaveLength(1);
    expect(src(doc, "metric-2-card")?.editor?.binding).toMatchObject({ propKey: "metrics", path: [2, "note"] });
  });

  it("walks the notes: a camera over a supersampled, frozen board, one card per stop, the clip as long as the notes need", async () => {
    // The defaults carry one note (on the fifth tile).
    const doc = (await WeeklyBriefV1.render({ ...WeeklyBriefV1.defaultProps }, targetCtx(1920, 1080)).then(asDocument)) as Doc;
    expect(Object.keys(doc.children ?? {})).toEqual(["held"]);
    const held = doc.children!.held as Doc & { size?: { width: number; height: number }; sources: Array<{ playback?: unknown }> };
    const board = held.children!.dashboard as Doc & { size?: { width: number; height: number }; durationMs?: number };
    expect(held.size).toEqual({ width: 1920 * MAX_ZOOM, height: 1080 * MAX_ZOOM });
    expect(board.size).toEqual({ width: 1920 * MAX_ZOOM, height: 1080 * MAX_ZOOM });
    // The board renders only its build; the held layer freezes it for the whole clip; the camera sits ABOVE the freeze.
    expect(board.durationMs).toBeLessThan(doc.durationMs!);
    expect(held.sources[0]).toMatchObject({ type: "mosaic", ref: "dashboard", playback: { loopMode: "freeze" } });
    const top = doc.sources[0] as { type?: string; ref?: string; effects?: { camera?: Record<string, unknown> } };
    expect(top).toMatchObject({ type: "mosaic", ref: "held" });
    expect(typeof top.effects?.camera?.zoom).toBe("string");
    // The charts live under the board, the note card on the frame, bound to the note it shows.
    expect(Object.keys(board.children ?? {})).toHaveLength(6);
    expect(labelsOf(doc)).toEqual(expect.arrayContaining(["progress", "note-0-card", "note-0-label", "note-0"]));
    expect(src(doc, "note-0")?.editor?.binding).toMatchObject({ propKey: "metrics", path: [4, "note"] });
    expect(textOf(doc, "note-0-label")).toMatch(/^AVERAGE ORDER\s+1\/1$/);
    // Length: the board's build plus the walk; the static hints agree at defaults.
    expect(doc.durationMs).toBe(plannedDurationMs(WeeklyBriefV1.defaultProps));
    expect(doc.durationMs).toBeGreaterThan(16_000);
    expect(WeeklyBriefV1.outputHints?.durationMs).toBe(doc.durationMs);
    expect(plannedDurationMs({ ...WeeklyBriefV1.defaultProps, metrics: PLAIN_METRICS })).toBe(16_000);
    expect(plannedDurationMs({ metrics: "not json" as unknown as BriefMetricInput[] })).toBe(16_000);
    // Three notes = three stops in tile order; the bottom-row tile puts its card on top only when it must.
    const three = (await render({ metrics: PLAIN_METRICS.map((m, i) => (i === 0 || i === 3 || i === 5 ? { ...m, note: `Note ${i}` } : m)) })) as Doc;
    expect(labelsOf(three).filter((l) => /^note-\d$/.test(l ?? ""))).toEqual(["note-0", "note-1", "note-2"]);
    expect(three.durationMs).toBe(plannedDurationMs({ ...WeeklyBriefV1.defaultProps, metrics: PLAIN_METRICS.map((m, i) => (i === 0 || i === 3 || i === 5 ? { ...m, note: `Note ${i}` } : m)) }));
    // No notes: the plain board, no held layer, the length knob.
    const plain = (await render()) as Doc;
    expect(plain.children).not.toHaveProperty("held");
    expect(plain.durationMs).toBe(16_000);
    await expect(render({ metrics: [{ ...PLAIN_METRICS[0], note: "x".repeat(141) }] })).rejects.toThrow(/note is 141 characters/);
  });

  it("plans the walk: stops in tile order with reading time, and frames each tile clear of its card", () => {
    const stops = noteStops([
      { ...metric("a", 0), note: "" },
      { ...metric("b", 1), note: "Short." },
      { ...metric("c", 2), note: "x".repeat(140) },
    ]);
    expect(stops.map((s) => s.index)).toEqual([1, 2]);
    const plan = planWalk(8, stops);
    expect(plan.stops[0].departSec).toBe(9);
    expect(plan.stops[0].arriveSec).toBeCloseTo(10.1);
    expect(plan.stops[0].leaveSec - plan.stops[0].arriveSec).toBe(dwellSec("Short."));
    expect(dwellSec("x".repeat(140))).toBe(8);
    expect(plan.stops[1].departSec).toBe(plan.stops[0].leaveSec);
    expect(plan.endSec).toBeGreaterThan(plan.pullBackSec);
    // A top-row tile frames with the card below it; a bottom-row tile that would sit under the card gets it on top.
    const top = frameOn({ x: 200, y: 400, w: 1200, h: 400 }, 3840, 2160);
    expect(top.card).toBe("bottom");
    expect(top.zoom).toBe(MAX_ZOOM);
    const low = frameOn({ x: 200, y: 1700, w: 1200, h: 400 }, 3840, 2160);
    expect(low.card).toBe("top");
  });

  it("holds its layout contract at the seven canvases: defaults, one metric, long copy, no charts, a logo on dark", async () => {
    await sweep();
    await sweep({ metrics: [{ label: "Net revenue", format: "currency", series: [1.1e6, 1.2e6] }], highlights: [], footer: "", ctaUrl: "", recipientName: "", title: "", periodLabel: "", deltaLabel: "" });
    await sweep({
      recipientName: "Maximiliana Featherstonehaugh-Worthington",
      headline: "A very long sentence from the agent about the week that keeps going past any reasonable width to make sure the headline wraps and shrinks rather than overflowing the frame or colliding with the tiles below it.",
      metrics: Array.from({ length: 6 }, (_, i) => ({ label: `A long metric label number ${i + 1} that will not fit`, format: "currency", series: [5, 3, 8, 1, 9, 2, 7, 4, 6, 3, 8, 5, 2, 9, 1, 7, 4, 6, 3, 8, 5, 2, 9, 1234567.89], chart: i % 2 ? "bars" : "line", caption: "A long caption that explains in some detail how this number was retrieved and from where." })),
      highlights: ["A long highlight that wraps onto a second line because it has a great deal to say about the week that just happened in the business.", "Short.", "Another one."],
    });
    await sweep({ metrics: [{ label: "A", value: "1" }, { label: "B", value: "2", delta: "0%" }] });
    await sweep({ brandLogo: ["C:/brand/mark.png"], theme: "dark" });
  }, 180_000);

  it("lays tiles three across in landscape and two across in square and portrait, with the chart beside the value", () => {
    const wide = layoutWeeklyBrief(COPY, 1920, 1080);
    const square = layoutWeeklyBrief(COPY, 1080, 1080);
    const tall = layoutWeeklyBrief(COPY, 1080, 1920);
    expect(new Set(wide.tiles.slice(0, 3).map((t) => t.rect.y)).size).toBe(1);
    expect(wide.tiles[3].rect.y).toBeGreaterThan(wide.tiles[0].rect.y);
    expect(new Set(square.tiles.slice(0, 2).map((t) => t.rect.y)).size).toBe(1);
    expect(square.tiles[2].rect.y).toBeGreaterThan(square.tiles[0].rect.y);
    expect(tall.stacked).toBe(true);
    for (const L of [wide, square, tall]) {
      for (const t of L.tiles) {
        expect(t.chart).not.toBeNull();
        expect(t.chart!.x).toBeGreaterThan(t.value.rect.x + t.value.rect.w - 1);
        expect(t.chart!.y + t.chart!.h).toBeLessThanOrEqual(t.caption!.rect.y);
        expect(t.chart!.w).toBeGreaterThanOrEqual(BRIEF_MIN_CHART_W);
        expect(t.chart!.h).toBeGreaterThanOrEqual(BRIEF_MIN_CHART_H);
      }
      const gridBottom = Math.max(...L.tiles.map((t) => t.rect.y + t.rect.h));
      expect(L.highlights[0].text.rect.y).toBeGreaterThan(gridBottom);
      expect(L.pill!.y + L.pill!.h).toBeLessThanOrEqual(L.bar.y);
    }
  });

  it("colours a delta by direction x whether up is good, and says the period once", async () => {
    const doc = await render({
      metrics: [
        { label: "Up good", series: [1, 2] },
        { label: "Down bad", series: [2, 1] },
        { label: "Down good", series: [2, 1], upIsGood: false },
        { label: "Flat", series: [1, 1] },
      ],
    });
    expect(colorOf(doc, "metric-0-delta")).toBe(BRIEF_GOOD);
    expect(colorOf(doc, "metric-1-delta")).toBe(BRIEF_BAD);
    expect(colorOf(doc, "metric-2-delta")).toBe(BRIEF_GOOD);
    expect(colorOf(doc, "metric-3-delta")).not.toBe(BRIEF_GOOD);
    expect(colorOf(doc, "metric-3-delta")).not.toBe(BRIEF_BAD);
    expect(labelsOf(doc).filter((l) => l?.endsWith("-delta-label"))).toHaveLength(0);
    expect(textOf(doc, "kicker")).toContain("VS LAST WEEK");
  });

  it("times the highlights to follow the last tile, and lets the platform knob pick the canvas", async () => {
    const six = briefBeats(16, 6);
    const two = briefBeats(16, 2);
    expect(six.cuts[0]).toBe(1.6);
    expect(two.cuts[1]).toBeLessThan(six.cuts[1]);
    expect(six.cuts[1]).toBeLessThanOrEqual(8);
    const hints = (props: WeeklyBriefProps) => resolveTemplateOutputHints(WeeklyBriefV1, { ...WeeklyBriefV1.defaultProps, ...props });
    expect(hints({})).toMatchObject({ width: 1920, height: 1080, durationMs: plannedDurationMs(WeeklyBriefV1.defaultProps) });
    expect(hints({ metrics: PLAIN_METRICS })).toMatchObject({ durationMs: 16_000 });
    for (const [key, dims] of Object.entries(BRIEF_PLATFORMS)) expect(hints({ platform: key })).toMatchObject(dims);
    expect(hints({ platform: "billboard" })).toMatchObject(BRIEF_PLATFORMS.email);
    await expect(render({ platform: "billboard" })).rejects.toThrow(/platform/);
    expect(WeeklyBriefV1.outputHints).toMatchObject(BRIEF_PLATFORMS.email);
    for (const dims of Object.values(BRIEF_PLATFORMS)) {
      await sweepLayout((p, ctx) => WeeklyBriefV1.render({ ...WeeklyBriefV1.defaultProps, ...plainProps(p) }, ctx).then(asDocument), ID, {}, (w, h) => targetCtx(w, h), [[dims.width, dims.height]]);
    }
  }, 120_000);

  it("starts from a light or dark theme, takes a logo, clears its safe minimum, and is deterministic", async () => {
    const doc = await render();
    expect(doc.backgroundColor).toBe(BRIEF_THEME_COLORS.light.background);
    expect((await render({ theme: "dark" })).backgroundColor).toBe(BRIEF_THEME_COLORS.dark.background);
    const mp4 = await render({ brandLogo: ["C:/brand/mark-loop.mp4"] });
    expect(labelsOf(mp4)).toContain("logo");
    expect(mp4.assets["brand-logo" as keyof typeof mp4.assets]).toMatchObject({ kind: "file", mediaType: "video" });
    const ev = evaluateM0(String(doc.m0), { width: 1920, height: 1080 });
    expect(ev.feasible && ev.meetsPrecision).toBe(true);
    expect(doc.durationMs).toBe(16_000);
    expect(await render()).toEqual(await render());
    const asString = await render({ metrics: JSON.stringify([{ label: "Only", series: [1, 2] }]) as unknown as WeeklyBriefProps["metrics"] });
    expect(labelsOf(asString)).toContain("metric-0-chart");
  });

  it("is the gate: a bad format, chart, series, a missing label, too many metrics or highlights is refused", async () => {
    await expect(render({ metrics: [{ label: "A", series: [1], format: "euros" }] })).rejects.toThrow(/metrics\[0\]\.format/);
    await expect(render({ metrics: [{ label: "A", series: [1], chart: "pie" }] })).rejects.toThrow(/metrics\[0\]\.chart/);
    await expect(render({ metrics: [{ label: "A", series: [1, "x" as unknown as number] }] })).rejects.toThrow(/series\[1\]/);
    await expect(render({ metrics: [{ label: "A", series: [] }] })).rejects.toThrow(/1 to 24/);
    await expect(render({ metrics: [{ label: "", series: [1] }] })).rejects.toThrow(/metrics\[0\]\.label/);
    await expect(render({ metrics: [{ label: "A" }] })).rejects.toThrow(/needs a series/);
    await expect(render({ metrics: [] })).rejects.toThrow(/1 to 6/);
    await expect(render({ metrics: Array.from({ length: 7 }, (_, i) => ({ label: `m${i}`, series: [1] })) })).rejects.toThrow(/1 to 6/);
    await expect(render({ highlights: ["a", "b", "c", "d"] })).rejects.toThrow(/at most 3/);
    await expect(render({ headline: "" })).rejects.toThrow(/headline/);
    await expect(render({ accent: "blue" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ durationSec: 5 })).rejects.toThrow(/durationSec/);
  });
});
