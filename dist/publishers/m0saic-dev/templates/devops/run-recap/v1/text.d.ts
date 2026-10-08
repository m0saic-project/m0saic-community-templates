/**
 * Measured text fitting for svg-rasterized copy, in the face it is drawn in.
 * Nothing in m0saic soft-wraps or shrinks text, so every block is wrapped
 * and sized here, against the same font file the rasterizer reads.
 */
export type Face = "regular" | "bold" | "italic";
export type TextFit = {
    lines: string[];
    px: number;
    face: Face;
    width: number;
    h: number;
};
/** Line height as a multiple of the font size (the rasterizer's default). */
export declare const LINE = 1.25;
/** The fit budget inside a cell: `cell * 0.94 - 2px` (the layout contract's rule). */
export declare const budget: (cellW: number) => number;
/** A rect sized FROM its fitted text, carrying the slack the budget promises. */
export declare const blockH: (lines: number, px: number) => number;
/** The font file of a face, or undefined for the bundled default (regular). */
export declare function facePath(face: Face): string | undefined;
export declare function widthOf(text: string, px: number, face: Face): number;
/** Greedy word-wrap in the face that will be drawn. Never breaks a word. */
export declare function wrapLines(text: string, px: number, maxW: number, face: Face): string[];
/** Same line count, shortest longest line: no one-word last line. Cannot undo a fit. */
export declare function balanceLines(text: string, px: number, maxW: number, face: Face, lines: string[]): string[];
/** Cut to fit with a trailing "..." - the last resort, after shrinking. */
export declare function ellipsize(text: string, px: number, maxW: number, face: Face, force?: boolean): string;
/**
 * Fit copy into `maxW` x `maxH`: the largest size (maxPx down to minPx) whose
 * wrapped block fits the width, the line cap and the height, then rebalanced.
 * At the floor it drops lines and ellipsizes - a degrade, never an overflow.
 * `maxW` is the usable width (apply {@link budget} to a cell yourself).
 */
export declare function fitText(text: string, maxW: number, maxH: number, maxPx: number, minPx: number, maxLines: number, face: Face): TextFit;
/**
 * Copy that arrived from a CRM row or a generator: fold typographic
 * punctuation to ASCII, drop what the bundled font cannot draw (emoji, other
 * scripts), collapse whitespace.
 */
export declare function cleanCopy(value: string): string;
