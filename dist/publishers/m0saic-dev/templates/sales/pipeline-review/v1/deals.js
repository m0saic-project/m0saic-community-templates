"use strict";
/**
 * The numbers behind the pipeline review: read the deal rows (an array, or
 * the raw Salesforce CSV pasted as-is), validate them, and reduce them to
 * what the dashboard draws. Pure — no I/O. The quarter comes from
 * a prop, never the clock, so the same rows always render the same video.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.plural = exports.pct = exports.monthName = void 0;
exports.asciiPunct = asciiPunct;
exports.parseCsv = parseCsv;
exports.toMonth = toMonth;
exports.parseDeals = parseDeals;
exports.dealStatus = dealStatus;
exports.quarterWindow = quarterWindow;
exports.computeStats = computeStats;
exports.money = money;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// ── Parsing ──────────────────────────────────────────────────────────────
/**
 * Smart punctuation → ASCII. Exports and notes typed on a phone or a Mac
 * carry curly quotes and dashes; the svg font has no glyph for them (tofu).
 */
function asciiPunct(s) {
    return s
        .replace(/[‘’‚′]/g, "'")
        .replace(/[“”„″]/g, '"')
        .replace(/[–—−]/g, "-")
        .replace(/…/g, "...")
        .replace(/[   ]/g, " ")
        .replace(/[·•]/g, "-");
}
/** RFC-4180-ish: quoted fields, doubled quotes, CRLF or LF. Drops blank lines. */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c !== '"')
                field += c;
            else if (text[i + 1] === '"') {
                field += '"';
                i++;
            }
            else
                quoted = false;
        }
        else if (c === '"')
            quoted = true;
        else if (c === ",") {
            row.push(field);
            field = "";
        }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n")
                i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        }
        else
            field += c;
    }
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim() !== ""));
}
// Salesforce report headers vary by locale and report type — map the common
// spellings onto our keys (case- and space-insensitive).
const HEADER_KEYS = {
    opportunity: "opportunity", opportunityid: "opportunity", opportunityname: "opportunity",
    account: "account", accountname: "account",
    region: "region", territory: "region",
    owner: "owner", opportunityowner: "owner",
    stage: "stage",
    amount: "amount",
    closemonth: "closeMonth", closedate: "closeMonth",
};
/** "2026-07", "2026-07-15" or "7/15/2026" → "2026-07"; anything else → undefined. */
function toMonth(raw) {
    const s = raw.trim();
    const iso = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
    if (iso)
        return `${iso[1]}-${iso[2].padStart(2, "0")}`;
    const us = /^(\d{1,2})\/\d{1,2}\/(\d{4})$/.exec(s);
    if (us)
        return `${us[2]}-${us[1].padStart(2, "0")}`;
    return undefined;
}
function rowsFromCsv(text) {
    const [header, ...body] = parseCsv(text);
    if (!header)
        return [];
    const keys = header.map((h) => HEADER_KEYS[h.toLowerCase().replace(/[^a-z]/g, "")]);
    for (const need of ["account", "stage", "amount", "closeMonth"]) {
        if (!keys.includes(need))
            throw new Error(`deals: the CSV has no "${need}" column (header: ${header.join(", ")}).`);
    }
    return body.map((cells) => {
        const o = {};
        keys.forEach((k, i) => {
            if (!k)
                return;
            const v = (cells[i] ?? "").trim();
            if (k === "amount")
                o.amount = v === "" ? NaN : Number(v.replace(/[$,\s]/g, ""));
            else if (k === "closeMonth")
                o.closeMonth = toMonth(v) ?? v;
            else
                o[k] = v;
        });
        return o;
    });
}
/**
 * Deals from the prop. `indexed` is true when the prop held a real array —
 * only then can a rect bind to `deals[i].<field>` (a CSV string has no leaves).
 */
function parseDeals(raw) {
    let value = raw;
    let indexed = Array.isArray(raw);
    if (typeof raw === "string") {
        const s = raw.trim();
        value = s.startsWith("[") ? JSON.parse(s) : rowsFromCsv(s);
        indexed = false;
    }
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error("deals: needs at least one row (an array of deals, or the CSV export pasted as text).");
    }
    const rows = value.map((entry, i) => {
        const e = (entry ?? {});
        const str = (k) => (typeof e[k] === "string" ? asciiPunct(e[k]).trim() : "");
        const account = str("account");
        const stage = str("stage");
        const closeMonth = str("closeMonth");
        const amount = typeof e.amount === "string" ? Number(e.amount.replace(/[$,\s]/g, "")) : e.amount;
        if (!account)
            throw new Error(`deals[${i}].account must be a non-empty string.`);
        if (!stage)
            throw new Error(`deals[${i}].stage must be a non-empty string.`);
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
            throw new Error(`deals[${i}].amount must be a number >= 0, got ${JSON.stringify(e.amount)}.`);
        }
        if (!MONTH.test(closeMonth))
            throw new Error(`deals[${i}].closeMonth must be YYYY-MM, got ${JSON.stringify(e.closeMonth)}.`);
        return {
            ...(str("opportunity") ? { opportunity: str("opportunity") } : {}),
            account,
            region: str("region") || "Unassigned",
            owner: str("owner") || "Unassigned",
            stage,
            amount,
            closeMonth,
        };
    });
    return { rows, indexed };
}
function dealStatus(stage) {
    const s = stage.toLowerCase().replace(/\s+/g, " ").trim();
    if (s === "closed won" || s === "won")
        return "won";
    if (s === "closed lost" || s === "lost")
        return "lost";
    return "open";
}
const addMonths = (ym, n) => {
    const [y, m] = ym.split("-").map(Number);
    const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};
const monthName = (ym) => MONTH_NAMES[Number(ym.slice(5, 7)) - 1];
exports.monthName = monthName;
function quarterWindow(start) {
    if (!MONTH.test(start))
        throw new Error(`quarterStart must be YYYY-MM, got ${JSON.stringify(start)}.`);
    const months = [start, addMonths(start, 1), addMonths(start, 2)];
    const firstMonth = Number(start.slice(5, 7));
    const endYear = months[2].slice(0, 4);
    const span = `${(0, exports.monthName)(months[0])}-${(0, exports.monthName)(months[2])} ${endYear}`;
    const label = (firstMonth - 1) % 3 === 0 ? `Q${(firstMonth - 1) / 3 + 1} ${endYear}` : span;
    return { months, label, span };
}
const sum = (ds) => ds.reduce((a, d) => a + d.row.amount, 0);
const byAmountDesc = (a, b) => b.row.amount - a.row.amount || a.index - b.index;
function computeStats(rows, quarterStart) {
    const quarter = quarterWindow(quarterStart);
    const [q0, , q2] = quarter.months;
    const inQuarter = (m) => m >= q0 && m <= q2;
    const all = rows.map((row, index) => ({ index, row }));
    const st = (d) => dealStatus(d.row.stage);
    const won = all.filter((d) => st(d) === "won" && inQuarter(d.row.closeMonth));
    const lost = all.filter((d) => st(d) === "lost" && inQuarter(d.row.closeMonth));
    const open = all.filter((d) => st(d) === "open");
    const slipped = open.filter((d) => d.row.closeMonth <= q2).sort(byAmountDesc);
    const wonTotal = sum(won);
    const closedTotal = wonTotal + sum(lost);
    const closedCount = won.length + lost.length;
    const regions = [...new Set(all.map((d) => d.row.region ?? "Unassigned"))];
    const byRegion = regions
        .map((region) => {
        const total = sum(won.filter((d) => d.row.region === region));
        return { region, total, share: wonTotal > 0 ? total / wonTotal : 0 };
    })
        .sort((a, b) => b.total - a.total || a.region.localeCompare(b.region));
    const owners = [...new Set(won.map((d) => d.row.owner ?? "Unassigned"))]
        .map((owner) => ({ owner, total: sum(won.filter((d) => d.row.owner === owner)) }))
        .sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner));
    return {
        quarter,
        dealCount: rows.length,
        won: { total: wonTotal, count: won.length },
        lost: { total: sum(lost), count: lost.length },
        winRate: closedCount > 0 ? { count: won.length / closedCount, value: closedTotal > 0 ? wonTotal / closedTotal : 0 } : null,
        slipped,
        slippedTotal: sum(slipped),
        open: {
            total: sum(open),
            count: open.length,
            negotiationTotal: sum(open.filter((d) => /negotiat/i.test(d.row.stage))),
        },
        byMonth: quarter.months.map((month) => ({ month, total: sum(won.filter((d) => d.row.closeMonth === month)) })),
        byRegion,
        topRep: owners[0] ? { ...owners[0], share: wonTotal > 0 ? owners[0].total / wonTotal : 0 } : null,
        biggestOpen: [...open].sort(byAmountDesc)[0] ?? null,
    };
}
// ── Formatting (ASCII only — the svg font has no glyph for "·" or "—") ───
/** $950, $407K, $1.2M */
function money(n) {
    const a = Math.abs(n);
    if (a >= 999_500)
        return `$${(n / 1e6).toFixed(a >= 9_950_000 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (a >= 1000)
        return `$${Math.round(n / 1000)}K`;
    return `$${Math.round(n)}`;
}
const pct = (x) => `${Math.round(x * 100)}%`;
exports.pct = pct;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
exports.plural = plural;
