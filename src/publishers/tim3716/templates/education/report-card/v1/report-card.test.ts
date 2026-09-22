import type { MosaicEngineContext } from "@m0saic/types";
import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings } from "@m0saic/template-utils";

import { ReportCardV1 } from "./report-card";

const makeCtx = (w: number, h: number) =>
  ({
    target: { width: w, height: h, fps: 30, durationMs: 2000 },
    output: {},
  }) as unknown as MosaicEngineContext;

/* eslint-disable @typescript-eslint/no-explicit-any */
const render = (
  props: Parameters<typeof ReportCardV1.render>[0] = {},
  w = 1280,
  h = 720,
): Promise<any> => ReportCardV1.render({ ...ReportCardV1.defaultProps, ...props }, makeCtx(w, h)) as Promise<any>;

describe("@tim3716/education/report-card/v1", () => {
  it("binds every name and grade to the rect that shows it", async () => {
    const doc = await render();
    const { byProp, rejected } = resolvePropBindings(doc, 1280, 720, { propsSchema: ReportCardV1.propsSchema });
    expect(rejected).toEqual([]);
    expect(byProp.title).toHaveLength(1);
    expect(byProp.studentName).toHaveLength(1);
    expect(byProp.termLabel).toHaveLength(1);
    for (let n = 1; n <= 5; n += 1) {
      expect(byProp[`subject${n}`]).toHaveLength(1);
      expect(byProp[`grade${n}`]).toHaveLength(1);
    }
  });

  it("clears its safe minimum at its own hint", async () => {
    const ev = evaluateM0(String((await render()).m0), { width: 1280, height: 720 });
    expect(ev.feasible && ev.meetsPrecision).toBe(true);
  });

  it("is deterministic regardless of the grades", async () => {
    expect(await render()).toEqual(await render());
    expect(await render({ grade1: 60, grade2: 60, grade3: 60, grade4: 60, grade5: 60 })).toEqual(
      await render({ grade1: 60, grade2: 60, grade3: 60, grade4: 60, grade5: 60 }),
    );
  });

  it("rejects a bad color and an out-of-range grade", async () => {
    await expect(render({ pageColor: "red" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ accent: "red" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ grade1: 101 })).rejects.toThrow(/grade1/);
    await expect(render({ grade1: -1 })).rejects.toThrow(/grade1/);
  });

  it("rejects non-ASCII copy", async () => {
    await expect(render({ subject1: "Math→" })).rejects.toThrow(/ASCII/);
  });
});
