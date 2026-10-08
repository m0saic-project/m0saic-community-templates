"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChipsetV1 = void 0;
const types_1 = require("@m0saic/types");
const dsl_stdlib_1 = require("@m0saic/dsl-stdlib");
const template_utils_1 = require("@m0saic/template-utils");
const board_1 = require("./board");
const layout_1 = require("./layout");
const text_1 = require("./text");
const ID = "@m0saic-dev/integrations/chipset/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const MAX_PARTNERS = 16;
const DEFAULTS = {
    hub: "m0saic",
    hubIcon: "m0saic",
    partners: ["ffmpeg", "GitHub", "npm", "Claude", "YouTube", "ElevenLabs", "Node.js", "Electron", "SVG", "macOS", "Windows"],
    accent: "#4be3c6",
    seed: 7,
};
const C = {
    bg: "#060a24",
    horizon: "#0d1133",
    /** Board decoration by distance from the chip: near, mid, far. */
    deco: ["#1d2762", "#161e4d", "#10163b"],
    wire: "#1f2759",
    pill: "#14173b",
    pillEdge: "#262a58",
    pillInk: "#8b90b7",
    chip: "#15173b",
    chipInk: "#c9cce0",
    litInk: "#f2f6ff",
};
/** Beat times at the 12 s design length (scaled down for shorter clips). */
const DESIGN_SEC = 12;
const BEATS = { chipAt: 0.15, chipDur: 0.8, firstPulse: 1.4, lastLand: 9.0, maxStagger: 0.9, pillDur: 0.35 };
const propsSchema = (0, template_utils_1.definePropsSchema)({
    hub: {
        type: "string",
        required: false,
        description: "The chip's label: your product or company.",
        meta: { control: { placeholder: DEFAULTS.hub }, ui: { label: "Hub", order: 1, primary: true } },
    },
    partners: {
        type: "string[]",
        required: false,
        description: `The partners, one pill each (1–${MAX_PARTNERS}). Wide canvases get one or two rows under the chip, tall ones two columns; every trace re-routes.`,
        meta: { constraints: { minItems: 1, maxItems: MAX_PARTNERS }, ui: { label: "Partners", order: 2, primary: true } },
    },
    hubIcon: {
        type: "string",
        required: false,
        description: 'The mark above the hub label: "m0saic" (the M), "none", or an SVG path d drawn in a 24×24 box (a Simple Icons path pastes straight in).',
        meta: { control: { placeholder: "m0saic" }, ui: { label: "Hub icon", order: 3 } },
    },
    accent: {
        type: "string",
        required: false,
        description: "Glow colour as #rrggbb: packets, lit traces, lit pills.",
        meta: {
            constraints: { isColor: true },
            control: { colorPicker: true, defaultColor: DEFAULTS.accent },
            ui: { label: "Accent", order: 4 },
        },
    },
    seed: {
        type: "number",
        required: false,
        description: "Seed for the board decoration and the order the partners light up in.",
        meta: { constraints: { min: 0, max: 9999 }, ui: { label: "Seed", order: 5 } },
    },
});
const n1 = (v) => String(Math.round(v * 10) / 10);
const polyD = (pts, o) => pts.map((p, i) => `${i ? "L" : "M"}${n1(p.x - o.x)} ${n1(p.y - o.y)}`).join(" ");
const closedD = (r, o) => `M${n1(r.x - o.x)} ${n1(r.y - o.y)}H${n1(r.x + r.w - o.x)}V${n1(r.y + r.h - o.y)}H${n1(r.x - o.x)}Z`;
const circleD = (x, y, r, o) => {
    const [a, b, c] = [n1(x - r - o.x), n1(y - o.y), n1(x + r - o.x)];
    return `M${a} ${b}A${n1(r)} ${n1(r)} 0 1 0 ${c} ${b}A${n1(r)} ${n1(r)} 0 1 0 ${a} ${b}Z`;
};
/** A stadium (pill) outline: radius = half the height. */
const pillD = (r, o) => {
    const R = r.h / 2;
    const [x0, x1, y0, y1] = [r.x - o.x, r.x + r.w - o.x, r.y - o.y, r.y + r.h - o.y];
    return `M${n1(x0 + R)} ${n1(y0)}H${n1(x1 - R)}A${n1(R)} ${n1(R)} 0 0 1 ${n1(x1 - R)} ${n1(y1)}H${n1(x0 + R)}A${n1(R)} ${n1(R)} 0 0 1 ${n1(x0 + R)} ${n1(y0)}Z`;
};
const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const r3 = (n) => Number(n.toFixed(3));
/** Integer rect covering `r`, clipped to `clip`. */
function outward(r, clip) {
    const x0 = Math.max(clip.x, Math.floor(r.x));
    const y0 = Math.max(clip.y, Math.floor(r.y));
    const x1 = Math.min(clip.x + clip.w, Math.ceil(r.x + r.w));
    const y1 = Math.min(clip.y + clip.h, Math.ceil(r.y + r.h));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}
/**
 * A colour tile masked by a shape authored in CANVAS px: the cell is the
 * shape's box (clipped to `clip`), the path is rebased onto the cell, and the
 * mask bounds equal the cell — scale 1:1, never distorted.
 */
function maskPiece(clip, box, importance, color, shape, label, overlay) {
    const rect = outward(box, clip);
    const o = { x: rect.x, y: rect.y };
    const strokes = shape.strokes?.(o);
    const source = {
        ...(0, template_utils_1.makeColorTile)(color, {
            mask: {
                kind: "inline-mask",
                localPath: shape.fill?.(o) ?? "",
                bounds: { x: 0, y: 0, width: rect.w, height: rect.h },
                ...(strokes && strokes.length ? { strokes } : {}),
                ...(shape.feather ? { featherPx: r3(shape.feather) } : {}),
            },
            ...(overlay ? { overlay } : {}),
        }),
        editor: { owner: "template", label },
    };
    return { rect, importance, source };
}
/** A 5-smooth box around `r` that stays on the canvas: a child's own splits
 *  divide its size, so a rough side (418 = 2·11·19) would force a rough split. */
function smoothBox(r, W, H) {
    const axis = (p, len, max) => {
        let s = (0, template_utils_1.ceilToSmooth)(Math.ceil(len));
        if (s > max)
            s = (0, template_utils_1.floorToSmooth)(max);
        const q = Math.max(0, Math.min(Math.floor(p), max - s));
        return [q, s];
    };
    const [x, w] = axis(r.x, r.w, W);
    const [y, h] = axis(r.y, r.h, H);
    return { x, y, w, h };
}
exports.ChipsetV1 = (0, template_utils_1.defineMosaicTemplate)({
    id: (0, types_1.asTemplateId)(ID),
    label: "03 · Chipset",
    version: 1,
    description: "Your product as the chip on a circuit board, wired to every partner: a glowing packet runs down each trace in turn and lights the partner's pill. Edit the partner list and the pills re-flow and the traces re-route, one or two rows on a wide canvas, two columns on a phone.",
    capabilities: { tier: "core" },
    tags: ["integrations", "partners", "hero", "circuit", "marketing"],
    outputHints: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 12000,
        format: { kind: "video", container: "mp4" },
        note: "Wide canvases put the partners in one or two rows under the chip; tall canvases (1080x1920) switch to two columns. 12 s lights every partner by ~9 s and holds.",
    },
    propsSchema,
    defaultProps: {
        hub: DEFAULTS.hub,
        hubIcon: DEFAULTS.hubIcon,
        partners: DEFAULTS.partners,
        accent: DEFAULTS.accent,
        seed: DEFAULTS.seed,
    },
    async render(props, ctx) {
        // ── Props: the schema documents, render() gates ────────────────────
        const hub = props.hub ?? DEFAULTS.hub;
        if (typeof hub !== "string")
            throw new Error(`${ID}: hub must be a string.`);
        const rawPartners = props.partners ?? DEFAULTS.partners;
        if (!Array.isArray(rawPartners) || rawPartners.some((p) => typeof p !== "string")) {
            throw new Error(`${ID}: partners must be a list of strings.`);
        }
        // Keep each partner's ORIGINAL index: a pill binds to its own list slot.
        const partners = rawPartners.map((label, index) => ({ label: label.trim(), index })).filter((p) => p.label.length > 0);
        if (partners.length === 0)
            throw new Error(`${ID}: partners needs at least one name.`);
        if (partners.length > MAX_PARTNERS)
            throw new Error(`${ID}: at most ${MAX_PARTNERS} partners (got ${partners.length}).`);
        const accent = props.accent ?? DEFAULTS.accent;
        if (!HEX.test(accent))
            throw new Error(`${ID}: accent ${JSON.stringify(accent)} must be #rrggbb.`);
        const icon = (props.hubIcon ?? DEFAULTS.hubIcon).trim();
        if (icon !== "m0saic" && icon !== "none" && icon !== "" && !PATH_D.test(icon)) {
            throw new Error(`${ID}: hubIcon must be "m0saic", "none", or SVG path data (M/L/C/Z… commands).`);
        }
        const seed = props.seed ?? DEFAULTS.seed;
        if (!Number.isFinite(seed))
            throw new Error(`${ID}: seed must be a number.`);
        const { width: W, height: H } = ctx.target;
        const fps = ctx.target.fps || 30;
        const durationMs = ctx.target.durationMs;
        const canvas = { x: 0, y: 0, w: W, h: H };
        // ── Geometry ────────────────────────────────────────────────────────
        const boldFont = (0, template_utils_1.resolveFontFile)({ weight: "bold" })?.path;
        const measure = (s, px) => (0, template_utils_1.measureText)(s, { fontSize: px, ...(boldFont ? { fontPath: boldFont } : {}) }).width;
        const L = (0, layout_1.layoutChipset)(W, H, partners.map((p) => p.label), measure);
        const u = L.u;
        const S = L.chip.w;
        const chipC = { x: L.chip.x + S / 2, y: L.chip.y + S / 2 };
        const hz = L.horizon;
        const horizonAt = (x) => hz.cy - hz.ry * Math.sqrt(Math.max(0, 1 - ((x - hz.cx) / hz.rx) ** 2));
        const lit = (0, template_utils_1.mixHex)(accent, "#ffffff", 0.45);
        const at = (c, a) => `${c}@${a}`;
        // ── Motion: one clock, scaled to the clip ──────────────────────────
        const T = Math.max(0.1, (durationMs ?? DESIGN_SEC * 1000) / 1000);
        const k = Math.min(1, T / DESIGN_SEC);
        const animate = T >= 2.5;
        const N = partners.length;
        const rnd = (0, template_utils_1.mulberry32)((seed | 0) + 1);
        const order = partners.map((_, i) => i);
        for (let i = N - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        const stagger = N > 1 ? Math.min(BEATS.maxStagger, (BEATS.lastLand - BEATS.firstPulse - 1.0) / (N - 1)) : 0;
        const lengths = L.wires.map(layout_1.polylineLength);
        const pulse = new Array(N);
        order.forEach((i, rank) => {
            const travel = Math.min(1.3, Math.max(0.75, lengths[i] / (700 * u)));
            pulse[i] = { start: r3((BEATS.firstPulse + rank * stagger) * k), travel: r3(travel * k) };
        });
        const fade = (atSec, durSec) => animate ? (0, template_utils_1.entrance)({ kind: "fade", atSec: r3(atSec), durationMs: Math.max(1, Math.round(durSec * 1000)) }) : undefined;
        // Structure, and why. At the root every animated overlay op costs a
        // full-canvas pass per frame; inside a nested child it costs the child's
        // own (smaller) area. So everything that moves lives in a child. But a
        // child under an opaque mp4 comes back as OPAQUE video (the engine keeps
        // alpha only for alpha deliverables), so each child is cut out at the
        // root by a static mask on its mosaic source: the wire strokes for the
        // wiring, the pill outlines for a row of pills, the chip's own rounding.
        // The soft light is the one full-canvas child: opaque by design, it IS
        // the background, rendered at quarter resolution because it is all blur.
        const root = [];
        const children = {};
        const toDoc = (origin, width, height, pieces, label, bg) => {
            const local = pieces.map((p) => ({
                rect: { x: p.rect.x - origin.x, y: p.rect.y - origin.y, w: p.rect.w, h: p.rect.h, importance: p.importance },
                source: p.source,
            }));
            const placed = (0, template_utils_1.placeInsetPieces)({ rootW: width, rootH: height, pieces: local });
            return {
                kind: "mosaic_document",
                version: 1,
                assets: {},
                m0: (0, dsl_stdlib_1.toM0String)(placed.m0, `${ID}#${label}`),
                sources: placed.sources,
                size: { width, height },
                backgroundColor: bg,
                fps,
                ...(durationMs ? { durationMs } : {}),
                editor: { label },
            };
        };
        const mount = (name, box, doc, importance, extra = {}) => {
            children[name] = doc;
            root.push({ rect: box, importance, source: { type: "mosaic", ref: name, ...extra, editor: { owner: "template", label: name } } });
        };
        const origin = (box) => ({ x: box.x, y: box.y });
        const cutout = (box, shape) => {
            const o = origin(box);
            const strokes = shape.strokes?.(o);
            return {
                kind: "inline-mask",
                localPath: shape.fill?.(o) ?? "",
                bounds: { x: 0, y: 0, width: box.w, height: box.h },
                ...(strokes && strokes.length ? { strokes } : {}),
                ...(shape.feather ? { featherPx: r3(shape.feather) } : {}),
            };
        };
        // ── Light (child, QUARTER resolution, opaque = the background): glows,
        // horizon, rim glow. Blurry by design, so it rasterizes and blurs at 1/16
        // the pixels and the engine scales it up (cover) onto the canvas. Colours
        // are PRE-MIXED over the background: an opaque child ignores `@alpha`.
        const sw = (0, template_utils_1.floorToSmooth)(Math.max(32, Math.round(W / 4)));
        const sh = (0, template_utils_1.floorToSmooth)(Math.max(32, Math.round((sw * H) / W)));
        const kS = Math.max(W / sw, H / sh); // child px → canvas px
        const offS = { x: (sw * kS - W) / 2, y: (sh * kS - H) / 2 };
        const sp = (p) => ({ x: (p.x + offS.x) / kS, y: (p.y + offS.y) / kS });
        const sl = (v) => v / kS;
        const sBox = (r) => ({ ...sp({ x: r.x, y: r.y }), w: sl(r.w), h: sl(r.h) });
        const sCanvas = { x: 0, y: 0, w: sw, h: sh };
        const cS = sp(chipC);
        const arcIn = (map, scale) => (x0, x1, o) => {
            const a = map({ x: x0, y: horizonAt(x0) });
            const b = map({ x: x1, y: horizonAt(x1) });
            return `M${n1(a.x - o.x)} ${n1(a.y - o.y)}A${n1(hz.rx * scale)} ${n1(hz.ry * scale)} 0 0 1 ${n1(b.x - o.x)} ${n1(b.y - o.y)}`;
        };
        const sArc = arcIn(sp, 1 / kS);
        const light = [
            maskPiece(sCanvas, sBox(grow({ ...chipC, w: 0, h: 0 }, 2 * S)), 0, (0, template_utils_1.mixHex)(C.bg, accent, 0.16), {
                fill: (o) => circleD(cS.x, cS.y, sl(1.25 * S), o), feather: sl(0.3 * S),
            }, "glow"),
            maskPiece(sCanvas, sBox({ x: 0, y: hz.apexY - 2, w: W, h: H - hz.apexY + 2 }), 1, C.horizon, {
                fill: (o) => `${sArc(0, W, o)}L${n1(sw - o.x)} ${n1(sh - o.y)}L${n1(-o.x)} ${n1(sh - o.y)}Z`,
            }, "horizon"),
            maskPiece(sCanvas, sBox({ x: 0, y: hz.apexY - 40 * u, w: W, h: hz.edgeY - hz.apexY + 80 * u }), 2, (0, template_utils_1.mixHex)(C.bg, accent, 0.4), {
                strokes: (o) => [{ d: sArc(0, W, o), width: r3(sl(5 * u)) }], feather: sl(7 * u),
            }, "rim-glow"),
            maskPiece(sCanvas, sBox({ x: chipC.x - 0.34 * W, y: hz.apexY - 30 * u, w: 0.68 * W, h: horizonAt(chipC.x - 0.3 * W) - hz.apexY + 60 * u }), 3, (0, template_utils_1.mixHex)(C.bg, accent, 0.55), {
                strokes: (o) => [{ d: sArc(chipC.x - 0.3 * W, chipC.x + 0.3 * W, o), width: r3(sl(3 * u)) }], feather: sl(6 * u),
            }, "rim-shine"),
            // The chip's halo: comes up with the chip.
            maskPiece(sCanvas, sBox(grow(L.chip, 0.3 * S)), 4, (0, template_utils_1.mixHex)(C.bg, accent, 0.5), {
                fill: (o) => closedD(sBox(grow(L.chip, 0.01 * S)), o), feather: sl(0.075 * S),
            }, "chip-glow", fade(BEATS.chipAt * k, BEATS.chipDur * k)),
        ];
        mount("light", canvas, toDoc({ x: 0, y: 0 }, sw, sh, light, "light", C.bg), 0, { placement: { fit: "cover" } });
        // ── Board (root, static): seeded PCB decoration, fading with distance
        // from the chip in three tiers (the reference's vignette, without a
        // full-canvas blur).
        const pillBoxes = L.pills.map((p) => grow(p, 12 * u));
        const art = (0, board_1.boardArt)(W, u, L.chip, (x) => horizonAt(x) - 6 * u, pillBoxes, seed);
        const reach = Math.hypot(Math.max(chipC.x, W - chipC.x), chipC.y);
        const tierOf = (p) => Math.min(2, Math.floor((3 * Math.hypot(p.x - chipC.x, p.y - chipC.y)) / reach));
        const mid = (pts) => pts[Math.floor(pts.length / 2)];
        for (let tier = 0; tier < 3; tier++) {
            const lines = art.lines.filter((l) => tierOf(mid(l)) === tier);
            const outlines = art.outlines.filter((r) => tierOf({ x: r.x + r.w / 2, y: r.y + r.h / 2 }) === tier);
            const pads = art.pads.filter((p) => tierOf(p) === tier);
            const blocks = art.blocks.filter((b) => tierOf({ x: b.x, y: b.y }) === tier);
            const pts = [...lines.flat(), ...pads, ...[...outlines, ...blocks].flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }])];
            if (pts.length === 0)
                continue;
            root.push(maskPiece(canvas, grow((0, board_1.bbox)(pts), 6 * u), 1, C.deco[tier], {
                fill: (o) => [...pads.map((p) => circleD(p.x, p.y, p.r, o)), ...blocks.map((b) => closedD(b, o))].join(""),
                strokes: (o) => [
                    ...lines.map((l) => ({ d: polyD(l, o), width: r3(1.5 * u) })),
                    ...outlines.map((r) => ({ d: closedD(r, o), width: r3(1.5 * u) })),
                ],
            }, `board-${tier}`));
        }
        // The rim's crisp edge stays full resolution (root, static).
        const rimArc = arcIn((p) => p, 1);
        root.push(maskPiece(canvas, { x: 0, y: hz.apexY - 8 * u, w: W, h: hz.edgeY - hz.apexY + 16 * u }, 2, at(lit, 0.5), {
            strokes: (o) => [{ d: rimArc(0, W, o), width: r3(1.5 * u) }],
        }, "rim"));
        // ── Wiring (children, cut out by the wire strokes): the child is the
        // dim trace colour; each lit copy fades in over it as its packet runs,
        // and the packet itself is a bright bead travelling INSIDE the trace.
        // Groups of ≤ 8 wires keep each child's overlay chain short.
        const band = 3.4 * u;
        const byPort = L.wires.map((w, i) => ({ w, i })).sort((a, b) => a.w[0].x - b.w[0].x);
        const G = Math.ceil(byPort.length / 8);
        for (let g = 0; g < G; g++) {
            const part = byPort.slice(Math.round((g * byPort.length) / G), Math.round(((g + 1) * byPort.length) / G));
            const box = smoothBox(grow((0, board_1.bbox)(part.flatMap((e) => e.w)), 24 * u), W, H);
            const pieces = [];
            for (const { w, i } of part) {
                const p = pulse[i];
                pieces.push(maskPiece(box, grow((0, board_1.bbox)(w), 6 * u), 0, lit, {
                    strokes: (o) => [{ d: polyD(w, o), width: r3(band + 2 * u) }],
                }, `trace-${partners[i].index}-lit`, fade(p.start + 0.2 * p.travel, 0.8 * p.travel + 0.25 * k)));
                if (!animate)
                    continue;
                const P = Math.max(8, 2 * Math.round(24 * u));
                const len = lengths[i] || 1;
                let acc = 0;
                const keys = w.map((pt, j) => {
                    if (j > 0)
                        acc += Math.hypot(pt.x - w[j - 1].x, pt.y - w[j - 1].y);
                    return { t: r3(p.start + (acc / len) * p.travel), x: pt.x - w[0].x, y: pt.y - w[0].y };
                });
                const end = r3(p.start + p.travel);
                pieces.push(maskPiece(box, { x: Math.round(w[0].x - P / 2), y: Math.round(w[0].y - P / 2), w: P, h: P }, 1, "#ffffff", {
                    fill: (o) => circleD(w[0].x, w[0].y, 10 * u, o), feather: 3 * u,
                }, `packet-${partners[i].index}`, {
                    xExpr: (0, template_utils_1.keyframeExpr)(keys.map((q) => ({ t: q.t, v: q.x })), { ease: "linear", precision: 2 }),
                    yExpr: (0, template_utils_1.keyframeExpr)(keys.map((q) => ({ t: q.t, v: q.y })), { ease: "linear", precision: 2 }),
                    enable: `between(t,${p.start},${end})`,
                    window: { startSec: p.start, endSec: end },
                }));
            }
            mount(`wiring-${g}`, box, toDoc(origin(box), box.w, box.h, pieces, `wiring-${g}`, C.wire), 3, {
                mask: cutout(box, { strokes: (o) => part.map(({ w }) => ({ d: polyD(w, o), width: r3(band) })), feather: 0.6 * u }),
            });
        }
        // ── Pills (children, one per row / column, cut out by the pill
        // outlines): dim pill + label, then the lit pill fading in on landing.
        const edge = (px, r) => r3(px / Math.min(r.w, r.h));
        const groups = new Map();
        L.pills.forEach((r, i) => {
            const who = partners[i];
            const land = pulse[i].start + pulse[i].travel - 0.04 * k;
            const litFade = fade(land, BEATS.pillDur * k);
            const g = L.mode === "brick" ? L.rows[i] : i % 2;
            const pieces = [];
            const pill = (fill, stroke, px, label, overlay) => ({
                ...(0, template_utils_1.makeColorTile)(fill, {
                    effects: { rounding: { cornerStyle: "pill" }, stroke: { width: edge(px, r), color: stroke, alpha: 1 } },
                    ...(overlay ? { overlay } : {}),
                }),
                editor: { owner: "template", label },
            });
            const tr = { x: r.x + Math.round(L.padX * 0.6), y: r.y + Math.round(r.h * 0.12), w: r.w - 2 * Math.round(L.padX * 0.6), h: r.h - 2 * Math.round(r.h * 0.12) };
            const fit = (0, text_1.fitCopy)(who.label, tr.w, tr.h, { maxPx: L.fontPx, maxLines: 1, bold: true });
            const label = (0, text_1.textCell)({ fit, color: C.pillInk, hAlign: "center", bold: true, label: `partner-${who.index}` });
            pieces.push({ rect: r, importance: 0, source: pill(C.pill, C.pillEdge, 1.5 * u, `pill-${who.index}`) }, { rect: tr, importance: 1, source: (0, template_utils_1.bindPropPath)(label, "partners", [who.index], "string", { onClear: "remove-element" }) }, { rect: r, importance: 2, source: pill((0, template_utils_1.mixHex)(C.pill, accent, 0.14), (0, template_utils_1.mixHex)(accent, "#ffffff", 0.1), 2.2 * u, `pill-${who.index}-lit`, litFade) }, { rect: tr, importance: 3, source: (0, text_1.textCell)({ fit, color: C.litInk, hAlign: "center", bold: true, label: `partner-${who.index}-lit`, overlay: litFade }) });
            groups.set(g, [...(groups.get(g) ?? []), { pieces, rect: r }]);
        });
        // ≤ 6 pills (24 sources) per child: a row of 8 stacks an overlay chain
        // past the depth where the engine starts dropping masks.
        for (const [g, row] of groups) {
            const chunks = Math.ceil(row.length / 6);
            for (let c = 0; c < chunks; c++) {
                const part = row.slice(Math.round((c * row.length) / chunks), Math.round(((c + 1) * row.length) / chunks));
                const name = `pills-${g}-${c}`;
                const box = smoothBox(grow((0, board_1.bbox)(part.flatMap(({ rect: r }) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }])), 2), W, H);
                mount(name, box, toDoc(origin(box), box.w, box.h, part.flatMap((e) => e.pieces), name, C.horizon), 4, {
                    mask: cutout(box, { fill: (o) => part.map(({ rect: r }) => pillD(grow(r, 1), o)).join("") }),
                });
            }
        }
        // ── Chip (child, rounded + stroked at the root): mark and label, rising in.
        const chip = [];
        const hasIcon = icon !== "none" && icon !== "";
        if (hasIcon) {
            const side = Math.round(0.34 * S);
            const ib = { x: Math.round(chipC.x - side / 2), y: Math.round(L.chip.y + 0.17 * S), w: side, h: side };
            const glyph = icon === "m0saic" ? template_utils_1.HEADER_M_GLYPH : { path: icon, bounds: { x: 0, y: 0, width: 24, height: 24 } };
            chip.push({
                rect: ib,
                importance: 0,
                source: {
                    ...(0, template_utils_1.makeColorTile)(accent, { mask: { kind: "inline-mask", localPath: glyph.path, bounds: { x: 0, y: 0, width: glyph.bounds.width, height: glyph.bounds.height } } }),
                    editor: { owner: "template", label: "hub-icon" },
                },
            });
        }
        const nb = hasIcon
            ? { x: L.chip.x + Math.round(0.08 * S), y: L.chip.y + Math.round(0.6 * S), w: Math.round(0.84 * S), h: Math.round(0.24 * S) }
            : { x: L.chip.x + Math.round(0.08 * S), y: L.chip.y + Math.round(0.3 * S), w: Math.round(0.84 * S), h: Math.round(0.4 * S) };
        const nameFit = (0, text_1.fitCopy)(hub || " ", nb.w, nb.h, { maxPx: (hasIcon ? 0.16 : 0.22) * S, maxLines: 1, bold: true });
        chip.push({ rect: nb, importance: 1, source: (0, template_utils_1.bindProp)((0, text_1.textCell)({ fit: nameFit, color: C.chipInk, hAlign: "center", bold: true, label: "hub" }), "hub") });
        const chipIn = animate
            ? (() => {
                const e = (0, template_utils_1.entrance)({ kind: "fade", atSec: BEATS.chipAt * k, durationMs: Math.round(BEATS.chipDur * k * 1000) });
                const dy = Math.max(1, Math.round(18 * u));
                return { ...e, yExpr: `(1-(${e.alpha}))*${dy}` };
            })()
            : undefined;
        mount("chip", L.chip, toDoc(origin(L.chip), S, S, chip, "chip", C.chip), 5, {
            effects: {
                rounding: { cornerStyle: "rounded", borderRadius: 0.05 },
                stroke: { width: edge(2.4 * u, L.chip), color: (0, template_utils_1.mixHex)(accent, "#ffffff", 0.25), alpha: 0.8 },
            },
            ...(chipIn ? { overlay: chipIn } : {}),
        });
        const placed = (0, template_utils_1.placeInsetPieces)({ rootW: W, rootH: H, pieces: root.map((p) => ({ rect: { ...p.rect, importance: p.importance }, source: p.source })) });
        return {
            kind: "mosaic_document",
            version: 1,
            m0: (0, dsl_stdlib_1.toM0String)(placed.m0, ID),
            assets: {},
            backgroundColor: C.bg,
            sources: placed.sources,
            fps,
            ...(durationMs ? { durationMs } : {}),
            children,
        };
    },
});
exports.default = exports.ChipsetV1;
