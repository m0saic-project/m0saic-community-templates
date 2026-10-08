"use strict";
/**
 * Pure geometry for the chipset card: where the chip sits, where every
 * partner pill lands, and the wire from the chip to each pill. No sources,
 * no time: numbers in, rects and polylines out, so the relayout rules are
 * unit-testable on their own.
 *
 * Two arrangements, picked by aspect:
 *
 *   - "brick" (landscape, square): the reference look. Pills in one or two
 *     centred rows under the chip. Every wire leaves the chip's bottom edge,
 *     fans out as a nested bus (the leftmost port turns first, the next one
 *     turns one level lower, so no two wires ever cross) and drops into its
 *     pill's top edge. A second-row pill is reached through a gap in the first
 *     row, jogging sideways in the channel between the rows when its gap is
 *     not directly above it.
 *   - "bus" (portrait): pills in two columns under the chip, one wire per pill
 *     running straight down the middle and turning into the pill's inner end.
 *     The outermost wire serves the top row, so the turns nest the same way.
 *
 * All wires are octilinear (vertical, horizontal, 45°), like a PCB.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.polylineLength = polylineLength;
exports.layoutChipset = layoutChipset;
const template_utils_1 = require("@m0saic/template-utils");
const round = Math.round;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
/** Drop consecutive duplicate points (degenerate chamfers collapse to nothing). */
function dedupe(pts) {
    const out = [];
    for (const p of pts) {
        const q = out[out.length - 1];
        if (!q || Math.abs(q.x - p.x) > 0.01 || Math.abs(q.y - p.y) > 0.01)
            out.push(p);
    }
    return out;
}
function polylineLength(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++)
        n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
}
function layoutChipset(W, H, labels, measure) {
    if (labels.length === 0)
        throw new Error("layoutChipset: at least one partner.");
    return H > W * 1.15 ? busLayout(W, H, labels, measure) : brickLayout(W, H, labels, measure);
}
function horizonFor(W, H, apexY) {
    const drop = 0.115 * Math.min(W, H);
    const rx = 0.9 * W;
    const k = W / 2 / rx;
    const ry = drop / (1 - Math.sqrt(1 - k * k));
    return { cx: W / 2, cy: apexY + ry, rx, ry, apexY, edgeY: apexY + drop };
}
// ── brick ────────────────────────────────────────────────────────────────
function brickLayout(W, H, labels, measure) {
    const N = labels.length;
    const u = Math.min(W, H) / 1080;
    const D = { ph: 80, font: 30, padX: 30, gapX: 22, gapY: 32, minW: 150, portGap: 22, stub: 26, c1: 8, c2: 30, drop: 22 };
    // Pills sized to their text, then the row(s) scaled to fit the canvas.
    const maxRowW = W - 2 * Math.max(60 * u, 0.07 * W);
    const w0 = labels.map((l) => Math.min(0.45 * maxRowW, Math.max(D.minW * u, measure(l, D.font * u) + 2 * D.padX * u)));
    const oneRowW = sum(w0) + D.gapX * u * (N - 1);
    const twoRows = N > 1 && oneRowW > maxRowW;
    const n0 = twoRows ? Math.ceil(N / 2) : N;
    const rowOf = (i) => (i < n0 ? 0 : 1);
    const rowW = (r) => {
        const ws = w0.filter((_, i) => rowOf(i) === r);
        return ws.length ? sum(ws) + D.gapX * u * (ws.length - 1) : 0;
    };
    const s = Math.max(0.3, Math.min(1, maxRowW / Math.max(rowW(0), rowW(1))));
    const ph = round(D.ph * u * s);
    const gapX = Math.max(8, round(D.gapX * u * s));
    const gapY = round(D.gapY * u * Math.max(s, 0.75));
    const fontPx = D.font * u * s;
    const padX = D.padX * u * s;
    const widths = w0.map((w) => round(w * s));
    const rowsN = twoRows ? 2 : 1;
    const bottom = round(H - 0.075 * H);
    const rowTop = (r) => bottom - rowsN * ph - (rowsN - 1) * gapY + r * (ph + gapY);
    const pills = new Array(N);
    for (let r = 0; r < rowsN; r++) {
        const idx = labels.map((_, i) => i).filter((i) => rowOf(i) === r);
        const total = sum(idx.map((i) => widths[i])) + gapX * (idx.length - 1);
        let x = round((W - total) / 2);
        for (const i of idx) {
            pills[i] = { x, y: rowTop(r), w: widths[i], h: ph };
            x += widths[i] + gapX;
        }
    }
    const row0 = labels.map((_, i) => i).filter((i) => rowOf(i) === 0);
    const row1 = labels.map((_, i) => i).filter((i) => rowOf(i) === 1);
    // Where each wire crosses the first row's top edge: a row-0 pill's centre,
    // or, for a row-1 pill, the gap (or open side) of row 0 it passes through.
    const drop = new Array(N);
    for (const i of row0)
        drop[i] = round(pills[i].x + pills[i].w / 2);
    const m = ph / 2; // keep wires on the flat part of a pill's top edge
    const corridors = [];
    const first = pills[row0[0]];
    const last = pills[row0[row0.length - 1]];
    corridors.push({ x: round(first.x - gapX), outside: true });
    for (let k = 0; k + 1 < row0.length; k++) {
        const a = pills[row0[k]];
        const b = pills[row0[k + 1]];
        corridors.push({ x: round((a.x + a.w + b.x) / 2), outside: false });
    }
    corridors.push({ x: round(last.x + last.w + gapX), outside: true });
    const target = new Array(N);
    if (row1.length) {
        const cost = (i, c) => {
            const p = pills[i];
            const lo = p.x + m;
            const hi = p.x + p.w - m;
            const off = c.x < lo ? lo - c.x : c.x > hi ? c.x - hi : 0;
            return off * 1000 + Math.abs(c.x - (p.x + p.w / 2)) + (c.outside ? 500 : 0);
        };
        const assign = matchInOrder(row1, corridors, cost);
        row1.forEach((i, k) => {
            drop[i] = corridors[assign[k]].x;
            const p = pills[i];
            target[i] = round(Math.min(p.x + p.w - m, Math.max(p.x + m, drop[i])));
        });
    }
    // Chip above the fan-out zone, ports along its bottom edge in drop order.
    // 5-smooth: the chip is its own nested child, and a child's splits divide its size.
    const S = (0, template_utils_1.floorToSmooth)(round(Math.min(0.28 * H, 0.24 * W)));
    const span = Math.min(0.72 * S, (N - 1) * D.portGap * u);
    const ls = N > 1 ? span / (N - 1) : 0;
    const order = labels.map((_, i) => i).sort((a, b) => drop[a] - drop[b] || rowOf(a) - rowOf(b));
    const cx = round(W / 2);
    const ports = order.map((_, k) => cx - span / 2 + k * ls);
    const left = order.filter((i, k) => drop[i] - ports[k] < -0.5).length;
    const right = order.filter((i, k) => drop[i] - ports[k] > 0.5).length;
    const levels = Math.max(left, right);
    const row0Top = rowTop(0);
    const need = D.stub * u + Math.max(0, levels - 1) * ls + D.c2 * u + D.drop * u;
    const chipBottom = round(Math.max(0.1 * H + S, Math.min(0.37 * H + S / 2, row0Top - need)));
    const chip = { x: round(cx - S / 2), y: chipBottom - S, w: S, h: S };
    const hide = 4 * u; // wire ends tuck under the chip and the pill
    const wires = new Array(N);
    order.forEach((i, k) => {
        const p = ports[k];
        const d = drop[i];
        const dx = d - p;
        const sg = Math.sign(dx);
        const pts = [{ x: p, y: chipBottom - hide }];
        if (Math.abs(dx) > 0.5) {
            const level = dx < 0 ? k : N - 1 - k;
            const yl = chipBottom + D.stub * u + level * ls;
            // Outer turns of a nested bend get longer chamfers so the bus keeps
            // its spacing through the 45° (derivation in the header of this file).
            let c1 = Math.min(D.c1 * u + level * ls * (2 - Math.SQRT2), Math.abs(dx) / 2);
            let c2 = Math.max(0, Math.min(D.c2 * u, Math.abs(dx) - c1, row0Top - yl - D.drop * u));
            if (c1 + c2 > Math.abs(dx))
                c1 = c2 = Math.abs(dx) / 2;
            pts.push({ x: p, y: yl - c1 }, { x: p + sg * c1, y: yl }, { x: d - sg * c2, y: yl }, { x: d, y: yl + c2 });
        }
        if (rowOf(i) === 0) {
            pts.push({ x: d, y: row0Top + hide });
        }
        else {
            const t = target[i];
            const yj = row0Top + ph + 4 * u;
            const cj = Math.min((gapY - 8 * u) / 2, Math.abs(t - d) / 2);
            if (Math.abs(t - d) > 0.5) {
                const sj = Math.sign(t - d);
                pts.push({ x: d, y: yj }, { x: d + sj * cj, y: yj + cj }, { x: t - sj * cj, y: yj + cj }, { x: t, y: yj + 2 * cj });
            }
            pts.push({ x: t, y: pills[i].y + hide });
        }
        wires[i] = dedupe(pts);
    });
    return {
        mode: "brick",
        u,
        chip,
        pillH: ph,
        fontPx,
        padX,
        pills,
        wires,
        rows: labels.map((_, i) => rowOf(i)),
        horizon: horizonFor(W, H, chip.y + 0.86 * S),
    };
}
/**
 * Order-preserving assignment of `items` (sorted by x) to distinct `slots`
 * (sorted by x) at minimum total cost. Order-preserving is what keeps the
 * wires planar: two row-1 wires never swap sides in the channel.
 */
function matchInOrder(items, slots, cost) {
    const n = items.length;
    const m = slots.length;
    if (n > m)
        throw new Error("matchInOrder: more items than slots.");
    const INF = Number.POSITIVE_INFINITY;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
    for (let j = 0; j <= m; j++)
        dp[0][j] = 0;
    for (let a = 1; a <= n; a++) {
        for (let j = a; j <= m; j++) {
            dp[a][j] = Math.min(dp[a][j - 1], dp[a - 1][j - 1] + cost(items[a - 1], slots[j - 1]));
        }
    }
    const out = new Array(n);
    let j = m;
    for (let a = n; a >= 1; a--) {
        while (dp[a][j] === dp[a][j - 1])
            j--;
        out[a - 1] = j - 1;
        j--;
    }
    return out;
}
// ── bus ──────────────────────────────────────────────────────────────────
function busLayout(W, H, labels, measure) {
    const N = labels.length;
    const u = Math.min(W, H) / 1080;
    const D = { ph: 84, font: 32, padX: 32, minW: 170, ls: 16, gap: 48, c: 24 };
    const S = (0, template_utils_1.floorToSmooth)(round(Math.min(0.36 * W, 0.22 * H)));
    const cx = round(W / 2);
    const chip = { x: round(cx - S / 2), y: round(0.2 * H - S / 2), w: S, h: S };
    const chipBottom = chip.y + S;
    // Left column = even partners, right column = odd: reading order is row by row.
    const nL = Math.ceil(N / 2);
    const nR = Math.floor(N / 2);
    const rowsN = nL;
    const side = (i) => (i % 2 === 0 ? -1 : 1);
    const rowOf = (i) => Math.floor(i / 2);
    // Bus lines under the chip: the OUTERMOST line serves the top row.
    const ls = Math.min(D.ls * u, (0.8 * S) / (2 * Math.max(1, nL)));
    const busHalf = ls / 2 + (Math.max(nL, nR) - 1) * ls;
    const lineX = (i) => {
        const n = side(i) < 0 ? nL : nR;
        const fromInner = n - 1 - rowOf(i);
        return cx + side(i) * (ls / 2 + fromInner * ls);
    };
    const inner = busHalf + D.gap * u; // pill inner end, measured from centre
    const marginX = Math.max(40 * u, 0.05 * W);
    const availW = W / 2 - inner - marginX;
    const w0 = labels.map((l) => Math.max(D.minW * u, measure(l, D.font * u) + 2 * D.padX * u));
    const s = Math.max(0.3, Math.min(1, availW / Math.max(...w0)));
    let ph = round(D.ph * u * Math.max(s, 0.8));
    const areaTop = chipBottom + 0.1 * H;
    const areaBottom = H - 0.06 * H;
    let pitch = Math.min(ph * 1.7, (areaBottom - areaTop - ph) / Math.max(1, rowsN - 1));
    if (rowsN > 1 && pitch < ph * 1.3) {
        ph = round((areaBottom - areaTop) / (rowsN * 1.3));
        pitch = ph * 1.3;
    }
    const blockH = (rowsN - 1) * pitch + ph;
    const top = areaTop + (areaBottom - areaTop - blockH) * 0.35;
    const fontPx = D.font * u * Math.min(s, ph / (D.ph * u));
    const padX = D.padX * u * s;
    const pills = labels.map((_, i) => {
        const w = round(w0[i] * s);
        const y = round(top + rowOf(i) * pitch);
        const x = side(i) < 0 ? round(cx - inner - w) : round(cx + inner);
        return { x, y, w, h: ph };
    });
    const hide = 4 * u;
    const wires = labels.map((_, i) => {
        const X = lineX(i);
        const p = pills[i];
        const yc = p.y + p.h / 2;
        const edge = side(i) < 0 ? p.x + p.w : p.x;
        const c = Math.min(D.c * u, Math.abs(X - edge) / 2);
        return dedupe([
            { x: X, y: chipBottom - hide },
            { x: X, y: yc - c },
            { x: X + side(i) * c, y: yc },
            { x: edge + side(i) * hide, y: yc },
        ]);
    });
    return {
        mode: "bus",
        u,
        chip,
        pillH: ph,
        fontPx,
        padX,
        pills,
        wires,
        rows: labels.map((_, i) => rowOf(i)),
        horizon: horizonFor(W, H, chip.y + 0.86 * S),
    };
}
