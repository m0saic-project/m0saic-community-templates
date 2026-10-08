import { evaluateM0 } from "@m0saic/dsl-stdlib";
import type { MosaicDocument } from "@m0saic/types";
import { measureText, resolveFontFile, resolvePropBindings } from "@m0saic/template-utils";

import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import { ChipsetV1 } from "./chipset";
import type { ChipsetLayout, Pt, Rect } from "./layout";
import { layoutChipset } from "./layout";

const render = (props: Parameters<typeof ChipsetV1.render>[0] = {}, w = 1920, h = 1080, durationMs = 12000) =>
  ChipsetV1.render({ ...ChipsetV1.defaultProps, ...props }, targetCtx(w, h, { durationMs })).then(asDocument);

const bold = resolveFontFile({ weight: "bold" })?.path;
const measure = (s: string, px: number) => measureText(s, { fontSize: px, ...(bold ? { fontPath: bold } : {}) }).width;
const DEFAULT = ChipsetV1.defaultProps.partners as string[];
const SIXTEEN = ["okta", "Microsoft Entra ID", "Google Workspace", "SAML", "OneLogin", "ADFS", "BambooHR", "JumpCloud", "Ping Identity", "OpenID Connect", "Duo", "Rippling", "Workday", "CyberArk", "Keycloak", "Auth0"];
const CANVASES: [number, number][] = [[1920, 1080], [1080, 1920], [1080, 1080], [1280, 720]];

/** Every mosaic document in the tree, root first. */
const walk = (doc: MosaicDocument, name = "root"): [string, MosaicDocument][] => [
  [name, doc],
  ...Object.entries((doc.children ?? {}) as Record<string, MosaicDocument>).flatMap(([k, c]) => walk(c, k)),
];
const smooth = (n: number) => { for (const p of [2, 3, 5]) while (n % p === 0) n /= p; return n === 1; };

const segs = (w: Pt[]) => w.slice(1).map((p, i) => [w[i], p] as const);
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** Proper or touching intersection of two segments (1e-6 slack). */
function meet([a, b]: readonly [Pt, Pt], [c, d]: readonly [Pt, Pt]): boolean {
  const e = 1e-6;
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e))) return true;
  const on = (p: Pt, q: Pt, r: Pt) =>
    Math.abs(cross(p, q, r)) <= e && Math.min(p.x, q.x) - e <= r.x && r.x <= Math.max(p.x, q.x) + e && Math.min(p.y, q.y) - e <= r.y && r.y <= Math.max(p.y, q.y) + e;
  return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
}
const inside = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function expectSoundLayout(L: ChipsetLayout, W: number, H: number) {
  // Pills on the canvas and apart; the chip clear of them.
  for (const p of L.pills) expect(p.x >= 0 && p.y >= 0 && p.x + p.w <= W && p.y + p.h <= H).toBe(true);
  L.pills.forEach((a, i) => L.pills.forEach((b, j) => { if (i < j) expect(overlap(a, b)).toBe(false); }));
  for (const p of L.pills) expect(overlap(p, L.chip)).toBe(false);
  L.wires.forEach((w, i) => {
    // Starts under the chip, ends under its own pill.
    expect(inside(w[0], L.chip)).toBe(true);
    expect(inside(w[w.length - 1], L.pills[i])).toBe(true);
    // Octilinear: vertical, horizontal or 45°.
    for (const [a, b] of segs(w)) {
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      expect(dx < 1e-6 || dy < 1e-6 || Math.abs(dx - dy) < 1e-6).toBe(true);
    }
    // Never runs through another partner's pill.
    L.pills.forEach((p, j) => {
      if (j === i) return;
      for (const [a, b] of segs(w)) {
        const box = { x: Math.min(a.x, b.x) - 0.01, y: Math.min(a.y, b.y) - 0.01, w: Math.abs(b.x - a.x) + 0.02, h: Math.abs(b.y - a.y) + 0.02 };
        const straight = Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
        if (straight) expect({ wire: i, pill: j, hit: overlap(box, p) }).toEqual({ wire: i, pill: j, hit: false });
      }
    });
  });
  // Planar: no two wires meet anywhere.
  L.wires.forEach((a, i) => L.wires.forEach((b, j) => {
    if (i >= j) return;
    for (const s of segs(a)) for (const t of segs(b)) expect({ i, j, meet: meet(s, t) }).toEqual({ i, j, meet: false });
  }));
}

describe("@m0saic-dev/integrations/chipset/v1 — the layout", () => {
  it("lays the default out like the reference: 6 over 5 under the chip, wide", () => {
    const L = layoutChipset(1920, 1080, DEFAULT, measure);
    expect(L.mode).toBe("brick");
    expect(L.rows.filter((r) => r === 0)).toHaveLength(6);
    expect(L.rows.filter((r) => r === 1)).toHaveLength(5);
    expect(smooth(L.chip.w)).toBe(true);
  });

  it("switches to two columns on a phone, the outermost bus line serving the top row", () => {
    const L = layoutChipset(1080, 1920, DEFAULT, measure);
    expect(L.mode).toBe("bus");
    const left = L.wires.filter((_, i) => i % 2 === 0).map((w) => w[0].x);
    expect(left).toEqual([...left].sort((a, b) => a - b));
  });

  it.each(CANVASES.flatMap(([w, h]) => [1, 2, 3, 7, 11, 16].map((n) => [w, h, n] as const)))(
    "re-flows %ix%i with %i partners: on canvas, apart, octilinear, never crossing",
    (w, h, n) => {
      const names = n <= DEFAULT.length ? DEFAULT.slice(0, n) : SIXTEEN.slice(0, n);
      expectSoundLayout(layoutChipset(w, h, names, measure), w, h);
    },
  );
});

describe("@m0saic-dev/integrations/chipset/v1 — the render", () => {
  it.each(CANVASES)("stays on the 5-smooth lattice and meets precision at %ix%i, every child included", async (w, h) => {
    const doc = await render({ partners: SIXTEEN }, w, h);
    for (const [name, d] of walk(doc)) {
      const splits = [...String(d.m0).matchAll(/(\d+)[([{]/g)].map((m) => Number(m[1]));
      expect({ name, bad: splits.filter((x) => x > 12 && !smooth(x)) }).toEqual({ name, bad: [] });
      const size = (d as { size?: { width: number; height: number } }).size ?? { width: w, height: h };
      const ev = evaluateM0(String(d.m0), size);
      expect({ name, ok: ev.feasible && ev.meetsPrecision }).toEqual({ name, ok: true });
    }
  });

  it("keeps every node's overlay chain short, even at 16 partners", async () => {
    for (const [w, h] of CANVASES) {
      for (const [name, d] of walk(await render({ partners: SIXTEEN }, w, h))) {
        expect({ name, short: d.sources.length <= 24 }).toEqual({ name, short: true });
      }
    }
  });

  it("binds the hub label and every pill to its own list slot — Make edits them in place", async () => {
    const doc = await render({ partners: ["Stripe", "", "Slack"] });
    // resolvePropBindings walks the nested children itself.
    const { byProp, rejected } = resolvePropBindings(doc, 1920, 1080, { propsSchema: ChipsetV1.propsSchema });
    expect(rejected).toEqual([]);
    expect(byProp.hub).toHaveLength(1);
    expect(byProp.partners).toHaveLength(2);
    const slots: number[] = [];
    for (const [, d] of walk(doc)) {
      for (const s of d.sources) {
        const b = (s.editor as { binding?: { propKey: string; path?: number[] } } | undefined)?.binding;
        if (b?.propKey === "partners") slots.push(b.path?.[0] ?? -1);
      }
    }
    // The blank partner has no pill; the others keep their ORIGINAL indices.
    expect(slots.sort()).toEqual([0, 2]);
  });

  it("renders a still (no packets) when the clip is too short to animate", async () => {
    const labels = (d: MosaicDocument) => walk(d).flatMap(([, x]) => x.sources.map((s) => (s.editor as { label?: string } | undefined)?.label ?? ""));
    expect(labels(await render({}, 1920, 1080, 1000)).some((l) => l.startsWith("packet-"))).toBe(false);
    expect(labels(await render()).filter((l) => l.startsWith("packet-"))).toHaveLength(DEFAULT.length);
  });

  it("is deterministic and rejects bad input", async () => {
    expect(await render()).toEqual(await render());
    await expect(render({ accent: "teal" })).rejects.toThrow(/accent/);
    await expect(render({ partners: [" ", ""] })).rejects.toThrow(/at least one/);
    await expect(render({ partners: [...SIXTEEN, "one too many"] })).rejects.toThrow(/at most 16/);
    await expect(render({ hubIcon: "<svg onload=x>" })).rejects.toThrow(/hubIcon/);
  });
});
