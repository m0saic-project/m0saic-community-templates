/**
 * The numbers behind the pipeline review: read the deal rows (an array, or
 * the raw Salesforce CSV pasted as-is), validate them, and reduce them to
 * what the dashboard draws. Pure — no I/O. The quarter comes from
 * a prop, never the clock, so the same rows always render the same video.
 */
export type DealRow = {
    opportunity?: string;
    account: string;
    region?: string;
    owner?: string;
    stage: string;
    amount: number;
    /** Close month, YYYY-MM. */
    closeMonth: string;
};
export type DealStatus = "won" | "lost" | "open";
/** A row plus its ORIGINAL index into the prop (what binding paths address). */
export type IndexedDeal = {
    index: number;
    row: DealRow;
};
/**
 * Smart punctuation → ASCII. Exports and notes typed on a phone or a Mac
 * carry curly quotes and dashes; the svg font has no glyph for them (tofu).
 */
export declare function asciiPunct(s: string): string;
/** RFC-4180-ish: quoted fields, doubled quotes, CRLF or LF. Drops blank lines. */
export declare function parseCsv(text: string): string[][];
/** "2026-07", "2026-07-15" or "7/15/2026" → "2026-07"; anything else → undefined. */
export declare function toMonth(raw: string): string | undefined;
/**
 * Deals from the prop. `indexed` is true when the prop held a real array —
 * only then can a rect bind to `deals[i].<field>` (a CSV string has no leaves).
 */
export declare function parseDeals(raw: unknown): {
    rows: DealRow[];
    indexed: boolean;
};
export declare function dealStatus(stage: string): DealStatus;
export type QuarterWindow = {
    months: [string, string, string];
    /** "Q3 2026" for a calendar-aligned start, else "Jul-Sep 2026". */
    label: string;
    /** "Jul-Sep 2026". */
    span: string;
};
export declare const monthName: (ym: string) => string;
export declare function quarterWindow(start: string): QuarterWindow;
export type PipelineStats = {
    quarter: QuarterWindow;
    dealCount: number;
    won: {
        total: number;
        count: number;
    };
    lost: {
        total: number;
        count: number;
    };
    /** Won / closed, by count and by value; null when nothing closed. */
    winRate: {
        count: number;
        value: number;
    } | null;
    /** Open deals whose close month is already past the quarter end, largest first. */
    slipped: IndexedDeal[];
    slippedTotal: number;
    open: {
        total: number;
        count: number;
        negotiationTotal: number;
    };
    byMonth: Array<{
        month: string;
        total: number;
    }>;
    /** Every region in the export (so a $0 region still shows), largest first. */
    byRegion: Array<{
        region: string;
        total: number;
        share: number;
    }>;
    topRep: {
        owner: string;
        total: number;
        share: number;
    } | null;
    biggestOpen: IndexedDeal | null;
};
export declare function computeStats(rows: DealRow[], quarterStart: string): PipelineStats;
/** $950, $407K, $1.2M */
export declare function money(n: number): string;
export declare const pct: (x: number) => string;
export declare const plural: (n: number, one: string, many?: string) => string;
