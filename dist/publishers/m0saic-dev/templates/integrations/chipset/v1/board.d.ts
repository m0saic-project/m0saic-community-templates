import type { Pt, Rect } from "./layout";
export type BoardArt = {
    /** Stroked open polylines (leads). */
    lines: Pt[][];
    /** Stroked closed outlines (IC packages). */
    outlines: Rect[];
    /** Filled pads at lead ends. */
    pads: {
        x: number;
        y: number;
        r: number;
    }[];
    /** Filled small rects (IC pins). */
    blocks: Rect[];
};
/**
 * Board art for a chip at `chip`, kept above `floorAt(x)` (the horizon) and
 * out of `avoid`. `seed` picks lengths, bends and package placement.
 */
export declare function boardArt(W: number, u: number, chip: Rect, floorAt: (x: number) => number, avoid: Rect[], seed: number): BoardArt;
export declare function bbox(pts: Pt[]): Rect;
