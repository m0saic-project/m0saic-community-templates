"use strict";
/**
 * A page's layout as data, and the difference between two of them.
 *
 * The capture is the schema `@m0saic/web/page-skeleton` reads (format
 * "m0saic-page-skeleton", version 1: a viewport and rects with a kind, a
 * corner radius and a depth) plus what `tools/capture-html.mjs` adds per rect:
 * a `label` (what a person would call the area) and a `path` (where it sits
 * in the tree, siblings numbered). The path is what makes a DIFF possible:
 * two captures of the same page match element to element, and what moved,
 * grew, appeared or vanished is exact - not a pixel heuristic.
 *
 * Pure: captures in, differences out. The template draws them; the tests
 * assert them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPTURE_KINDS = exports.CAPTURE_FORMAT = void 0;
exports.parseCapture = parseCapture;
exports.summarize = summarize;
exports.diffCaptures = diffCaptures;
exports.CAPTURE_FORMAT = "m0saic-page-skeleton";
exports.CAPTURE_KINDS = ["block", "text", "image", "control", "divider"];
/** Parse a capture (an object or its JSON text). Throws with the field named. */
function parseCapture(value, name) {
    let v = value;
    if (typeof v === "string") {
        try {
            v = JSON.parse(v);
        }
        catch {
            throw new Error(`${name} is not valid JSON.`);
        }
    }
    if (!v || typeof v !== "object" || Array.isArray(v))
        throw new Error(`${name} must be a capture object (format "${exports.CAPTURE_FORMAT}").`);
    const c = v;
    if (c.format !== exports.CAPTURE_FORMAT)
        throw new Error(`${name}.format must be "${exports.CAPTURE_FORMAT}" (got ${JSON.stringify(c.format)}).`);
    const vp = c.viewport;
    const w = Number(vp?.w);
    const h = Number(vp?.h);
    if (!vp || !Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1)
        throw new Error(`${name}.viewport needs a positive w and h.`);
    if (!Array.isArray(c.rects))
        throw new Error(`${name}.rects must be an array.`);
    const rects = c.rects.map((raw, i) => {
        if (!raw || typeof raw !== "object")
            throw new Error(`${name}.rects[${i}] must be an object.`);
        const r = raw;
        const num = (key, min = 0) => {
            const n = Number(r[key]);
            if (!Number.isFinite(n) || n < min)
                throw new Error(`${name}.rects[${i}].${key} must be a number >= ${min}.`);
            return Math.round(n);
        };
        const k = typeof r.k === "string" && exports.CAPTURE_KINDS.includes(r.k) ? r.k : "block";
        const rawLabel = typeof r.label === "string" && r.label.trim() ? r.label.trim() : `${k} ${i + 1}`;
        // A label that starts like a path is a text snippet, not a file.
        const label = /^[/\\~]/.test(rawLabel) ? `text ${rawLabel}` : rawLabel;
        const path = typeof r.path === "string" && r.path.trim() ? r.path.trim() : `#${i}`;
        return { x: num("x", -1e6), y: num("y", -1e6), w: num("w", 1), h: num("h", 1), k, r: typeof r.r === "number" && Number.isFinite(r.r) ? Math.max(0, Math.round(r.r)) : 0, d: typeof r.d === "number" && Number.isFinite(r.d) ? Math.max(0, Math.round(r.d)) : 0, label, path, index: i };
    });
    const meta = c.meta;
    return { viewport: { w: Math.round(w), h: Math.round(h) }, rects, source: typeof meta?.source === "string" ? meta.source : "" };
}
const px = (n) => `${n > 0 ? "+" : ""}${n} px`;
/** The one line a card shows for a difference. */
function summarize(d) {
    if (d.kind === "added")
        return `new: ${d.after.w}x${d.after.h}`;
    if (d.kind === "removed")
        return `removed: was ${d.before.w}x${d.before.h}`;
    const b = d.before;
    const a = d.after;
    if (d.kind === "resized") {
        const parts = [];
        if (d.dw)
            parts.push(`${px(d.dw)} wide`);
        if (d.dh)
            parts.push(`${px(d.dh)} tall`);
        return `${b.w}x${b.h} -> ${a.w}x${a.h} (${parts.join(", ")})`;
    }
    const parts = [];
    if (d.dx)
        parts.push(`${Math.abs(d.dx)} px ${d.dx > 0 ? "right" : "left"}`);
    if (d.dy)
        parts.push(`${Math.abs(d.dy)} px ${d.dy > 0 ? "down" : "up"}`);
    return `moved ${parts.join(", ")}`;
}
/**
 * Match the two captures element to element (by path; by label and kind
 * when a capture carries no paths), then classify. Reading order throughout
 * (y, then x, on the PR side; a removed rect by its old place). A move is a
 * CONSEQUENCE when a primary change sits above it in the same column of the
 * page - the page re-flowed - so "1 visual difference" stays one.
 */
function diffCaptures(before, after, tolerancePx = 2) {
    const key = (r) => (r.path.startsWith("#") ? `${r.k}|${r.label}` : r.path);
    const byKey = new Map();
    for (const r of before.rects) {
        const k = key(r);
        byKey.set(k, [...(byKey.get(k) ?? []), r]);
    }
    const used = new Set();
    const out = [];
    const tol = Math.max(0, tolerancePx);
    for (const a of after.rects) {
        const candidates = (byKey.get(key(a)) ?? []).filter((b) => !used.has(b.index));
        if (candidates.length === 0) {
            out.push({ kind: "added", label: a.label, path: a.path, after: a, dx: 0, dy: 0, dw: a.w, dh: a.h });
            continue;
        }
        // Several share the key (no paths, repeated labels): take the nearest.
        const b = candidates.reduce((best, c) => (Math.hypot(c.x - a.x, c.y - a.y) < Math.hypot(best.x - a.x, best.y - a.y) ? c : best));
        used.add(b.index);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dw = a.w - b.w;
        const dh = a.h - b.h;
        const resized = Math.abs(dw) > tol || Math.abs(dh) > tol;
        const moved = Math.abs(dx) > tol || Math.abs(dy) > tol;
        if (resized)
            out.push({ kind: "resized", label: a.label, path: a.path, before: b, after: a, dx, dy, dw, dh });
        else if (moved)
            out.push({ kind: "moved", label: a.label, path: a.path, before: b, after: a, dx, dy, dw: 0, dh: 0 });
    }
    for (const b of before.rects) {
        if (!used.has(b.index))
            out.push({ kind: "removed", label: b.label, path: b.path, before: b, dx: 0, dy: 0, dw: -b.w, dh: -b.h });
    }
    const place = (d) => d.after ?? d.before;
    out.sort((p, q) => place(p).y - place(q).y || place(p).x - place(q).x);
    const contains = (outer, inner) => inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;
    const overlapsX = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w;
    const changes = out.filter((d) => d.kind !== "moved");
    // A container that grew or shrank AROUND another change changed because of
    // it: the cause is the innermost change. (A card grows because its button
    // did; the row grows because the card did.)
    const causes = changes.filter((d) => d.kind !== "resized" || !changes.some((o) => o !== d && contains(place(d), place(o)) && (place(o).w < place(d).w || place(o).h < place(d).h)));
    return out.map((d) => {
        let primary = causes.includes(d);
        if (d.kind === "moved") {
            // Inside a change, it moved with it; below one in its column, the page re-flowed under it.
            const r = d.after;
            const explained = changes.some((p) => {
                const pr = place(p);
                return contains(pr, r) || (pr.y + pr.h <= r.y + tol && overlapsX(pr, r));
            });
            primary = !explained;
        }
        return { ...d, primary, summary: summarize({ ...d, primary }) };
    });
}
