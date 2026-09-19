import type { MosaicEngineContext } from "@m0saic/types";

import { TipGoalV1 } from "./tip-goal";
import type { TipGoalV1Props } from "./types";

const makeCtx = (target?: Partial<{ width: number; height: number; fps: number; durationMs: number }>) =>
  ({
    target: { width: 1920, height: 1080, fps: 30, durationMs: 15000, ...target },
    output: {},
  }) as unknown as MosaicEngineContext;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function render(props: TipGoalV1Props, ctx = makeCtx()): Promise<any> {
  return (await TipGoalV1.render(props, ctx)) as any;
}

function errorCode(doc: any): string | undefined {
  return doc?.sources?.[0]?.engine?.renderError?.code;
}

describe("zero-props render (the demo contract)", () => {
  it("succeeds with the full document tree", async () => {
    const doc = await render({ ...TipGoalV1.defaultProps });
    expect(doc.kind).toBe("mosaic_document");
    expect(errorCode(doc)).toBeUndefined();

    // Parent: solid demo background + counter text + one pill-clipped bar ref.
    expect(doc.sources).toHaveLength(3);
    expect(doc.sources[0].type).toBe("lavfi");
    expect(doc.sources[1].type).toBe("text");
    expect(doc.sources[2]).toMatchObject({ type: "mosaic", ref: "tg_bar" });
    expect(doc.sources[2].effects.rounding.cornerStyle).toBe("pill");
    expect(doc.durationMs).toBe(15000);
    expect(doc.size).toEqual({ width: 1920, height: 1080 });
    expect(doc.backgroundColor).toBeUndefined();

    // Counter: one per-frame expr layer with the eif count-up, right-aligned
    // so the number hugs the bar.
    const text = doc.sources[1];
    expect(text.renderMode).toEqual({ kind: "video" });
    expect(text.layers[0].content.kind).toBe("expr");
    expect(text.layers[0].content.eval).toBe("frame");
    expect(text.layers[0].content.expr).toContain("%{eif\\:(");
    expect(text.layers[0].style.fontSize).toBeGreaterThan(10);
    expect(text.layers[0].placement.hAlign).toBe("right");

    // Bar child: track + sliding pill fill + gated tip flash.
    const bar = doc.children.tg_bar;
    expect(bar.m0).toBe("1{1{1}}"); // canonical form of F{F{F}}
    expect(bar.sources).toHaveLength(3);
    expect(bar.sources[0].type).toBe("lavfi"); // track
    const fill = bar.sources[1];
    expect(fill.overlay.xExpr.startsWith("-(w*(1-(")).toBe(true);
    expect(fill.effects.rounding.cornerStyle).toBe("pill");
    const flash = bar.sources[2];
    expect(flash.overlay.enable).toMatch(/between\(t,/);
    expect(flash.overlay.window.endSec).toBeGreaterThan(flash.overlay.window.startSec);
  });

  it("renders the standalone demo even with literally empty props", async () => {
    const doc = await render({});
    expect(doc.kind).toBe("mosaic_document");
    expect(errorCode(doc)).toBeUndefined();
  });
});

describe("background & base media", () => {
  it("alpha-0 background → transparent slot base, no doc backgroundColor", async () => {
    const doc = await render({ backgroundColor: "black@0" });
    expect(doc.sources[0].visual?.opacity).toBe(0);
    expect(doc.backgroundColor).toBeUndefined();
  });

  it("a file sourceId becomes the cover-fit base with a manifest entry", async () => {
    const doc = await render({ sourceId: "C:/videos/clip.mp4" });
    expect(doc.assets.tg_base).toMatchObject({ kind: "file", path: "C:/videos/clip.mp4" });
    expect(doc.sources[0]).toMatchObject({ type: "media", mediaType: "video" });
    expect(doc.sources[0].placement.fit).toBe("cover");
  });

  it("an http sourceId becomes a url asset", async () => {
    const doc = await render({ sourceId: "https://example.com/clip.mp4" });
    expect(doc.assets.tg_base.kind).toBe("url");
  });
});

describe("schedule modes", () => {
  it("tips rows drive the counter and one flash per tip", async () => {
    const doc = await render({
      tips: [
        { atSec: 3, amount: 24 },
        { atSec: 8, amount: 7 },
      ],
    });
    const flash = doc.children.tg_bar.sources[2];
    const betweens = String(flash.overlay.enable).match(/between\(t,/g) ?? [];
    expect(betweens).toHaveLength(2);
    // The fill's final hold is 31/100.
    const fill = doc.children.tg_bar.sources[1];
    expect(fill.overlay.xExpr).toContain("0.31000");
  });

  it("absolute schedule keys win over tips", async () => {
    const doc = await render({
      tips: [{ atSec: 1, amount: 5 }],
      schedule: [
        { atSec: 0, amount: 0 },
        { atSec: 10, amount: 100 },
      ],
    });
    const fill = doc.children.tg_bar.sources[1];
    expect(fill.overlay.xExpr).toContain("gte(t,10.00000)*(1.00000)");
  });

  it("tipFlash off drops the flash layer", async () => {
    const doc = await render({ bar: { tipFlash: false } });
    const bar = doc.children.tg_bar;
    expect(bar.m0).toBe("1{1}"); // canonical form of F{F}
    expect(bar.sources).toHaveLength(2);
  });

  it("showGoal appends the goal readout to the counter", async () => {
    const doc = await render({ showGoal: true });
    expect(doc.sources[1].layers[0].content.expr.endsWith(" / $100")).toBe(true);
  });
});

describe("reduceMotion", () => {
  it("parks the final amount: literal counter, constant fill, no flash", async () => {
    const doc = await render({
      reduceMotion: true,
      tips: [{ atSec: 3, amount: 42 }],
    });
    const text = doc.sources[1];
    expect(text.layers[0].content).toEqual({ kind: "literal", text: "$42" });
    const bar = doc.children.tg_bar;
    expect(bar.sources).toHaveLength(2); // no flash
    expect(bar.sources[1].overlay.xExpr).toBe("-(w*(1-(0.42000)))");
  });
});

describe("placement & label options", () => {
  it('label "none" drops the text source', async () => {
    const doc = await render({ label: { placement: "none" } });
    expect(doc.sources).toHaveLength(2);
    expect(doc.sources[1]).toMatchObject({ type: "mosaic", ref: "tg_bar" });
  });

  it("layoutM0 moves the widget band verbatim", async () => {
    const doc = await render({ layoutM0: "5[F,-,-,-,-]" });
    expect(errorCode(doc)).toBeUndefined();
    const bar = doc.children.tg_bar;
    expect(bar.size.height).toBe(216);
  });

  it("geometry rects place label and bar exactly", async () => {
    const doc = await render({
      geometry: {
        barRect: { x: 200, y: 900, w: 1600, h: 80 },
        labelRect: { x: 20, y: 900, w: 160, h: 80 },
        fontSizePx: 48,
      },
    });
    expect(errorCode(doc)).toBeUndefined();
    const bar = doc.children.tg_bar;
    expect(bar.size).toEqual({ width: 1600, height: 80 });
    expect(doc.sources[1].layers[0].style.fontSize).toBe(48);
  });

  it("rounding below 0.5 uses the rounded corner style", async () => {
    const doc = await render({ bar: { rounding: 0.2 } });
    expect(doc.sources[2].effects.rounding).toEqual({
      cornerStyle: "rounded",
      borderRadius: 0.2,
    });
  });

  it('label "right" flips the counter to hug the bar from the other side', async () => {
    const doc = await render({ label: { placement: "right" } });
    // Frame order puts the bar (left) before the label (right).
    const text = doc.sources.find((s: any) => s.type === "text");
    expect(text.layers[0].placement.hAlign).toBe("left");
  });
});

describe("Make-page contracts (tags + prop bindings)", () => {
  it("sources carry the layout-contract tags and edit bindings", async () => {
    const doc = await render({ ...TipGoalV1.defaultProps });

    // Base (demo): the demo color, editable in place. `sourceId` is a media
    // prop and media props are never bindable, so it carries no handle.
    expect(doc.sources[0].editor.binding).toEqual({ propKey: "backgroundColor" });

    // Counter: tagged + a stacked currency/color form.
    expect(doc.sources[1].editor.label).toBe("counter");
    expect(doc.sources[1].editor.bindings).toEqual([
      { propKey: "currency" },
      { propKey: "label.color" },
    ]);

    // Bar ref tagged; track/fill inside the child bind their colors.
    expect(doc.sources[2].editor.label).toBe("bar");
    const bar = doc.children.tg_bar;
    expect(bar.sources[0].editor).toMatchObject({
      label: "track",
      binding: { propKey: "bar.trackColor" },
    });
    expect(bar.sources[1].editor).toMatchObject({
      label: "fill",
      binding: { propKey: "bar.fillColor" },
    });
  });

  it("a media base carries no binding (media props are not bindable)", async () => {
    const doc = await render({ sourceId: "C:/videos/clip.mp4" });
    expect(doc.sources[0].editor?.binding).toBeUndefined();
    expect(doc.sources[0].editor?.bindings).toBeUndefined();
  });

  it("art replacement drops the color bindings but keeps the tags", async () => {
    const doc = await render({
      bar: { trackImage: "C:/art/track.png", fillImage: "C:/art/fill.png" },
    });
    const bar = doc.children.tg_bar;
    expect(bar.sources[0].editor.label).toBe("track");
    expect(bar.sources[0].editor.binding).toBeUndefined();
    expect(bar.sources[1].editor.label).toBe("fill");
    expect(bar.sources[1].editor.binding).toBeUndefined();
  });
});

describe("debugLayout (the upstream layout contract)", () => {
  it("off by default: no contract stamp on the document", async () => {
    const doc = await render({ ...TipGoalV1.defaultProps });
    expect(doc.editor?.layoutContract).toBeUndefined();
  });

  it("on: stamps a passing contract (expr counter → wireframe only)", async () => {
    const doc = await render({ debugLayout: true });
    expect(errorCode(doc)).toBeUndefined();
    expect(doc.editor.layoutContract.ok).toBe(true);
    expect(doc.editor.layoutContract.templateId).toBe("@m0saic-dev/creator/tip-goal/v1");
    expect(doc.editor.layoutContract.constraintCount).toBe(0);
  });

  it("on + reduceMotion: the literal counter's text-fit constraint runs and passes", async () => {
    const doc = await render({ debugLayout: true, reduceMotion: true });
    expect(errorCode(doc)).toBeUndefined();
    expect(doc.editor.layoutContract.ok).toBe(true);
    expect(doc.editor.layoutContract.constraintCount).toBe(1);
  });
});

describe("error paths (TG_* codes)", () => {
  const cases: Array<[string, TipGoalV1Props, string]> = [
    ["zero goal", { goalAmount: 0 }, "TG_GOAL"],
    ["tips not an array", { tips: "x" as never }, "TG_TIPS_PARSE"],
    ["tips all invalid", { tips: [{ atSec: "a", amount: null }] as never }, "TG_TIPS_PARSE"],
    ["schedule not an array", { schedule: "x" as never }, "TG_SCHEDULE_PARSE"],
    ["bad layoutM0", { layoutM0: "(((" }, "TG_M0_PARSE"],
    ["layoutM0 with two rects", { layoutM0: "2(1,1)" }, "TG_M0_COUNT"],
    ["layoutM0 wrong shape", { layoutM0: "1" }, "TG_M0_SHAPE"],
    ["geometry not an object", { geometry: [1] as never }, "TG_GEOMETRY_PARSE"],
    [
      "geometry bad rect",
      { geometry: { barRect: { x: 0, y: 0, w: -1, h: 5 } } },
      "TG_GEOMETRY",
    ],
  ];
  for (const [name, props, code] of cases) {
    it(`${name} → ${code}`, async () => {
      const doc = await render(props);
      expect(errorCode(doc)).toBe(code);
    });
  }

  it("a tiny canvas → TG_CANVAS_TOO_SMALL", async () => {
    const doc = await render({}, makeCtx({ width: 60, height: 40 }));
    expect(errorCode(doc)).toBe("TG_CANVAS_TOO_SMALL");
  });
});

describe("determinism", () => {
  it("same seed → byte-identical document; different seed → different", async () => {
    const props = (seed: number): TipGoalV1Props => ({ auto: { seed } });
    const a = await render(props(5));
    const b = await render(props(5));
    const c = await render(props(6));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("duration scales the auto schedule (window follows the clip)", async () => {
    const short = await render({}, makeCtx({ durationMs: 10000 }));
    const long = await render({}, makeCtx({ durationMs: 60000 }));
    const lastWindow = (doc: any) => doc.children.tg_bar.sources[2].overlay.window.endSec;
    expect(lastWindow(long)).toBeGreaterThan(lastWindow(short));
  });
});
