import type { MosaicDocument } from "@m0saic/types";
import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings, resolveTemplateOutputHints } from "@m0saic/template-utils";

import { sweepLayout } from "./layout";
import { MAX_ZOOM } from "./walkthrough";
import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import { diffCaptures, parseCapture, summarize, type Capture, type CaptureRect } from "./capture";
import { SAMPLE_AFTER, SAMPLE_BEFORE } from "./sample-captures";
import {
  DIFF_PLATFORMS,
  DIFF_THEME_COLORS,
  VisualDiffV1,
  captionOf,
  diffBeats,
  diffStops,
  layoutVisualDiff,
  plannedDiffDurationMs,
  resolveDiffs,
  toPage,
  type DiffCopy,
  type VisualDiffProps,
} from "./visual-diff";

const ID = "@m0saic-dev/devtools/visual-diff/v1";

type Src = { editor?: { label?: string; binding?: { propKey?: string; index?: number } }; type?: string; ref?: string; effects?: { camera?: Record<string, unknown> }; layers?: Array<{ content?: { text?: string } }> };
type Doc = Omit<MosaicDocument, "children"> & { children?: Record<string, Doc>; sidecars?: Record<string, unknown>; size?: { width: number; height: number }; durationMs?: number };
const render = (props: VisualDiffProps = {}, w = 1920, h = 1080): Promise<Doc> =>
  VisualDiffV1.render({ ...VisualDiffV1.defaultProps, ...props }, targetCtx(w, h)).then(asDocument) as unknown as Promise<Doc>;
/** The board with nothing to visit: the two captures identical. */
const SAME: VisualDiffProps = { after: SAMPLE_BEFORE, notes: [] };
const sweep = (props: VisualDiffProps = {}) =>
  sweepLayout((p, ctx) => VisualDiffV1.render({ ...VisualDiffV1.defaultProps, ...SAME, ...p }, ctx).then(asDocument), ID, props, (w, h) => targetCtx(w, h));
const srcs = (doc: Doc) => doc.sources as unknown as Src[];
const labelsOf = (doc: Doc) => srcs(doc).map((s) => s.editor?.label);
const src = (doc: Doc, label: string) => srcs(doc).find((s) => s.editor?.label === label);
const textOf = (doc: Doc, label: string) => src(doc, label)?.layers?.[0]?.content?.text;

const rect = (x: number, y: number, w: number, h: number, path: string, extra: Partial<CaptureRect> = {}): CaptureRect => ({ x, y, w, h, k: "block", r: 0, d: path.split(">").length, label: path.split(">").pop()!, path, index: 0, ...extra });
const cap = (rects: CaptureRect[]): Capture => ({ viewport: { w: 1000, h: 800 }, rects: rects.map((r, index) => ({ ...r, index })), source: "test" });

describe(`${ID} - the diff`, () => {
  it("matches element to element by path and names what changed", () => {
    const before = cap([rect(0, 0, 1000, 100, "body>header"), rect(20, 120, 400, 200, "body>main>div[card]"), rect(40, 280, 80, 32, "body>main>div[card]>button"), rect(20, 340, 400, 60, "body>main>p")]);
    const after = cap([rect(0, 0, 1000, 100, "body>header"), rect(20, 120, 400, 208, "body>main>div[card]"), rect(40, 280, 80, 40, "body>main>div[card]>button"), rect(20, 348, 400, 60, "body>main>p"), rect(20, 420, 400, 30, "body>main>div[alert]")]);
    const diffs = diffCaptures(before, after, 2);
    const by = Object.fromEntries(diffs.map((d) => [d.path, d]));
    // The button grew (a cause); the card grew AROUND it (a consequence); the paragraph was pushed down (a consequence); the alert is new (a cause).
    expect(by["body>main>div[card]>button"]).toMatchObject({ kind: "resized", primary: true, dh: 8, summary: "80x32 -> 80x40 (+8 px tall)" });
    expect(by["body>main>div[card]"]).toMatchObject({ kind: "resized", primary: false });
    expect(by["body>main>p"]).toMatchObject({ kind: "moved", primary: false, dy: 8, summary: "moved 8 px down" });
    expect(by["body>main>div[alert]"]).toMatchObject({ kind: "added", primary: true, summary: "new: 400x30" });
    expect(diffs.map((d) => d.path)).toEqual(["body>main>div[card]", "body>main>div[card]>button", "body>main>p", "body>main>div[alert]"]);
    expect(captionOf(diffs)).toBe("2 visual differences - 2 elements shifted");
    // Removal: on the baseline only, in red territory; a move nothing explains is its own change.
    const gone = diffCaptures(after, before, 2);
    expect(gone.find((d) => d.path === "body>main>div[alert]")).toMatchObject({ kind: "removed", primary: true, summary: "removed: was 400x30" });
    const drift = diffCaptures(cap([rect(0, 0, 100, 100, "body>a")]), cap([rect(30, 0, 100, 100, "body>a")]), 2);
    expect(drift[0]).toMatchObject({ kind: "moved", primary: true, summary: "moved 30 px right" });
    // Inside the tolerance is not a difference.
    expect(diffCaptures(cap([rect(0, 0, 100, 100, "body>a")]), cap([rect(1, 1, 101, 100, "body>a")]), 2)).toEqual([]);
    expect(captionOf([])).toBe("No visual differences");
    expect(summarize({ kind: "resized", label: "x", path: "p", before: rect(0, 0, 10, 10, "p"), after: rect(0, 0, 12, 10, "p"), dx: 0, dy: 0, dw: 2, dh: 0, primary: true })).toBe("10x10 -> 12x10 (+2 px wide)");
  });

  it("finds the three edits in the example pages, and nothing else as a cause", () => {
    const { diffs } = resolveDiffs({});
    const causes = diffs.filter((d) => d.primary);
    expect(causes.map((d) => d.label)).toEqual(["usage-alert", "upgrade", "manage", "div.avatar"]);
    expect(causes.map((d) => d.kind)).toEqual(["added", "resized", "resized", "resized"]);
    expect(diffs.length - causes.length).toBeGreaterThan(20);
    expect(diffStops(diffs, 2).map((d) => d.label)).toEqual(["usage-alert", "upgrade"]);
  });

  it("parses a capture and refuses a malformed one by field", () => {
    const c = parseCapture(JSON.stringify(SAMPLE_BEFORE), "before");
    expect(c.viewport).toEqual({ w: 1280, h: 800 });
    expect(c.rects.length).toBe(SAMPLE_BEFORE.rects.length);
    expect(c.rects.every((r) => r.path && r.label)).toBe(true);
    // A text snippet that starts like a path is labelled as text.
    expect(parseCapture({ format: "m0saic-page-skeleton", version: 1, viewport: { w: 10, h: 10 }, rects: [{ x: 0, y: 0, w: 5, h: 5, k: "text", r: 0, d: 1, label: "/mo", path: "p" }] }, "x").rects[0].label).toBe("text /mo");
    expect(() => parseCapture("{", "before")).toThrow(/before is not valid JSON/);
    expect(() => parseCapture({ format: "other" }, "before")).toThrow(/before\.format/);
    expect(() => parseCapture({ format: "m0saic-page-skeleton", viewport: { w: 0, h: 10 }, rects: [] }, "after")).toThrow(/after\.viewport/);
    expect(() => parseCapture({ format: "m0saic-page-skeleton", viewport: { w: 10, h: 10 }, rects: [{ x: 0, y: 0, w: "wide", h: 5 }] }, "after")).toThrow(/after\.rects\[0\]\.w/);
  });
});

describe(`${ID} - the template`, () => {
  it("lays two windows side by side in landscape and stacked otherwise, each hugging its capture", () => {
    const { before, after, diffs } = resolveDiffs({});
    const copy: DiffCopy = { brandName: "N", hasLogo: false, title: "PR", baseLabel: "main", headLabel: "this PR", statusLabel: "ok", captionText: captionOf(diffs), before, after };
    const wide = layoutVisualDiff(copy, 1920, 1080);
    const square = layoutVisualDiff(copy, 1080, 1080);
    const tall = layoutVisualDiff(copy, 1080, 1920);
    expect(wide.stacked).toBe(false);
    expect(wide.before.frame.y).toBe(wide.after.frame.y);
    expect(wide.after.frame.x).toBeGreaterThan(wide.before.frame.x + wide.before.frame.w - 1);
    for (const L of [square, tall]) {
      expect(L.stacked).toBe(true);
      expect(L.after.frame.y).toBeGreaterThan(L.before.frame.y + L.before.frame.h - 1);
    }
    for (const L of [wide, square, tall]) {
      for (const win of [L.before, L.after]) {
        // The page area is the capture's aspect (within a pixel of rounding), fitted to the window.
        const ratio = (win.page.w / win.page.h) / (1280 / 800);
        expect(ratio).toBeGreaterThan(0.97);
        expect(ratio).toBeLessThan(1.03);
        const r = toPage(win, { x: 0, y: 0, w: 1280, h: 800 });
        expect(r.x).toBeGreaterThanOrEqual(win.page.x);
        expect(r.x + r.w).toBeLessThanOrEqual(win.page.x + win.page.w + 1);
      }
    }
  });

  it("outlines every area with a label, marks the causes in order, counts the rest, and binds the words", async () => {
    // With changes to visit, the board is the camera's child; its sources carry the wireframes and marks.
    const root = await render();
    const doc = root.children!.held.children!.board;
    const labels = labelsOf(doc);
    // Two windows, their chrome, the areas of each capture, the four numbered changes, their old boxes.
    expect(labels).toEqual(expect.arrayContaining(["window-before", "window-after", "window-before-label", "window-after-label", "page-before", "page-after", "area-before-0", "area-after-0", "change-0", "badge-0", "badge-3", "was-1", "caption"]));
    // Labels go on the areas with room for one (containers yield to their first child in a shared corner).
    expect(labels.filter((l) => l?.startsWith("label-after-")).length).toBeGreaterThanOrEqual(8);
    expect(labels.filter((l) => l?.startsWith("shift-")).length).toBeGreaterThan(20);
    expect(textOf(doc, "badge-0-text")).toBe("1");
    expect(textOf(doc, "caption")).toBe("4 visual differences - 31 elements shifted");
    // The words bind on the plain board (same builder, no camera).
    const plain = await render(SAME);
    const { byProp, rejected } = resolvePropBindings(plain, 1920, 1080, { propsSchema: VisualDiffV1.propsSchema });
    expect(rejected).toEqual([]);
    for (const key of ["brandName", "title", "statusLabel", "baseLabel", "headLabel", "accent"]) expect(byProp[key]?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("walks the changes: a camera over the supersampled board, a card per visited change, the clip as long as they need", async () => {
    const doc = await render();
    expect(Object.keys(doc.children ?? {})).toEqual(["held"]);
    const held = doc.children!.held;
    expect(held.size).toEqual({ width: 1920 * MAX_ZOOM, height: 1080 * MAX_ZOOM });
    expect((held.sources[0] as unknown as { playback?: unknown }).playback).toEqual({ loopMode: "freeze" });
    const top = srcs(doc)[0];
    expect(top).toMatchObject({ type: "mosaic", ref: "held" });
    expect(typeof top.effects?.camera?.zoom).toBe("string");
    expect(labelsOf(doc).filter((l) => /^note-\d$/.test(l ?? ""))).toEqual(["note-0", "note-1", "note-2", "note-3"]);
    expect(src(doc, "note-2")?.editor?.binding).toMatchObject({ propKey: "notes", index: 2 });
    expect(textOf(doc, "note-1-label")).toMatch(/^2\/4 - UPGRADE - 80x32 -> 80x40/);
    expect(textOf(doc, "note-3")).toMatch(/^Not intended/);
    expect(doc.durationMs).toBe(plannedDiffDurationMs(VisualDiffV1.defaultProps));
    expect(doc.durationMs).toBeGreaterThan(10_000);
    expect(VisualDiffV1.outputHints?.durationMs).toBe(doc.durationMs);
    // Fewer stops, shorter clip; no differences, no walk.
    expect(plannedDiffDurationMs({ ...VisualDiffV1.defaultProps, maxStops: 1 })).toBeLessThan(doc.durationMs!);
    const same = await render(SAME);
    expect(same.children).toBeUndefined();
    expect(same.durationMs).toBe(10_000);
    expect(textOf(same, "caption")).toBe("No visual differences");
    const beats = diffBeats(10, 4);
    expect(beats.cuts[0]).toBe(1.2);
    expect(beats.cuts[1]).toBeLessThanOrEqual(6);
  });

  it("writes each side as an m0c with every area labelled, and the diff as JSON", async () => {
    const doc = await render();
    const side = doc.sidecars?.before as { kind: string; ext: string; content: string };
    expect(side).toMatchObject({ kind: "text", ext: "m0c" });
    const file = JSON.parse(side.content) as { format: string; version: number; size: { width: number; height: number }; m0: string; labels: Record<string, { text: string }>; custom: { capture: { rects: unknown[] }; diff: Array<{ primary: boolean }> } };
    expect(file).toMatchObject({ format: "m0c", version: 1, size: { width: 1280, height: 800 } });
    expect(Object.keys(file.labels).length).toBe(SAMPLE_BEFORE.rects.length);
    expect(new Set(Object.values(file.labels).map((l) => l.text))).toEqual(new Set(SAMPLE_BEFORE.rects.map((r) => r.label)));
    expect(evaluateM0(file.m0, { width: 1280, height: 800 }).feasible).toBe(true);
    expect(file.custom.capture.rects).toHaveLength(SAMPLE_BEFORE.rects.length);
    expect(file.custom.diff.filter((d) => d.primary)).toHaveLength(4);
    const after = JSON.parse((doc.sidecars?.after as { content: string }).content) as { m0: string; labels: Record<string, unknown> };
    expect(Object.keys(after.labels).length).toBe(SAMPLE_AFTER.rects.length);
    expect(doc.sidecars?.diff).toMatchObject({ primary: 4, shifted: 31 });
    // The same sidecars ride the plain clip.
    expect(Object.keys((await render(SAME)).sidecars ?? {})).toEqual(["before", "after", "diff"]);
  });

  it("holds its layout contract at the seven canvases (the plain board), at every platform, light and dark, with a logo", async () => {
    await sweep();
    await sweep({ title: "PR #12345 - A very long pull request title that goes on and on past the width of the frame", statusLabel: "1,204 of 1,204 E2E tests passed across 14 pages in 3 browsers - 0 flaky", theme: "dark" });
    await sweep({ brandLogo: ["C:/brand/mark.png"], showLabels: false });
    const hints = (props: VisualDiffProps) => resolveTemplateOutputHints(VisualDiffV1, { ...VisualDiffV1.defaultProps, ...props });
    for (const [key, dims] of Object.entries(DIFF_PLATFORMS)) expect(hints({ platform: key })).toMatchObject(dims);
    expect(hints({ platform: "billboard" })).toMatchObject(DIFF_PLATFORMS.pr);
    await expect(render({ platform: "billboard" })).rejects.toThrow(/platform/);
    for (const dims of Object.values(DIFF_PLATFORMS)) {
      await sweepLayout((p, ctx) => VisualDiffV1.render({ ...VisualDiffV1.defaultProps, ...SAME, ...p }, ctx).then(asDocument), ID, {}, (w, h) => targetCtx(w, h), [[dims.width, dims.height]]);
    }
    expect((await render({ theme: "dark" })).backgroundColor).toBe(DIFF_THEME_COLORS.dark.background);
  }, 180_000);

  it("is deterministic, and the gate: a bad capture, a long note, a bad tolerance is refused", async () => {
    expect(await render()).toEqual(await render());
    await expect(render({ before: { format: "nope" } })).rejects.toThrow(/before\.format/);
    await expect(render({ after: "{" })).rejects.toThrow(/after is not valid JSON/);
    await expect(render({ notes: ["x".repeat(141)] })).rejects.toThrow(/notes\[0\] is 141 characters/);
    await expect(render({ tolerancePx: 99 })).rejects.toThrow(/tolerancePx/);
    await expect(render({ maxStops: 0 })).rejects.toThrow(/maxStops/);
    await expect(render({ title: "" })).rejects.toThrow(/title/);
    await expect(render({ durationSec: 3 })).rejects.toThrow(/durationSec/);
  });
});
