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
export declare const CAPTURE_FORMAT = "m0saic-page-skeleton";
export declare const CAPTURE_KINDS: readonly ["block", "text", "image", "control", "divider"];
export type CaptureKind = (typeof CAPTURE_KINDS)[number];
export type CaptureRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    k: CaptureKind;
    r: number;
    d: number;
    /** What a person calls the area (data-testid, aria-label, id, role, tag.class, a text snippet). */
    label: string;
    /** The element's place in the tree, siblings numbered - the diff's join key. */
    path: string;
    /** Index into the capture's rects (the binding handle). */
    index: number;
};
export type Capture = {
    viewport: {
        w: number;
        h: number;
    };
    rects: CaptureRect[];
    source: string;
};
/** Parse a capture (an object or its JSON text). Throws with the field named. */
export declare function parseCapture(value: unknown, name: string): Capture;
export type DiffKind = "resized" | "moved" | "added" | "removed";
export type Diff = {
    kind: DiffKind;
    label: string;
    path: string;
    /** The rect on `main` (absent when added). */
    before?: CaptureRect;
    /** The rect on the PR (absent when removed). */
    after?: CaptureRect;
    /** Pixel deltas, after minus before (moved / resized). */
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    /**
     * A change of its own (resized / added / removed, or a move nothing above
     * explains) - or a consequence: a move that follows a primary change earlier
     * in reading order (the page re-flowed under it).
     */
    primary: boolean;
    /** One line a card can show: "80x32 -> 80x40 (+8 px tall)". */
    summary: string;
};
/** The one line a card shows for a difference. */
export declare function summarize(d: Omit<Diff, "summary">): string;
/**
 * Match the two captures element to element (by path; by label and kind
 * when a capture carries no paths), then classify. Reading order throughout
 * (y, then x, on the PR side; a removed rect by its old place). A move is a
 * CONSEQUENCE when a primary change sits above it in the same column of the
 * page - the page re-flowed - so "1 visual difference" stays one.
 */
export declare function diffCaptures(before: Capture, after: Capture, tolerancePx?: number): Diff[];
