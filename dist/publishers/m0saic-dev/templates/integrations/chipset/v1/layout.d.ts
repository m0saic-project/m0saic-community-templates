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
export type Pt = {
    x: number;
    y: number;
};
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** Width in px of `text` at `fontPx`, in the pill's (bold) face. */
export type MeasureFn = (text: string, fontPx: number) => number;
export type ChipsetLayout = {
    mode: "brick" | "bus";
    /** min(W, H) / 1080: the design unit every stroke width and gap scales by. */
    u: number;
    chip: Rect;
    /** Pill height and label size after fitting the row(s) to the canvas. */
    pillH: number;
    fontPx: number;
    padX: number;
    /** Index-aligned with the partners. */
    pills: Rect[];
    /** Index-aligned with the partners: chip bottom (under the chip) → pill edge (under the pill). */
    wires: Pt[][];
    /** Row of each pill (brick: 0 top; bus: row in its column). */
    rows: number[];
    /** The planet horizon: an ellipse whose apex sits just under the chip's middle. */
    horizon: {
        cx: number;
        cy: number;
        rx: number;
        ry: number;
        apexY: number;
        edgeY: number;
    };
};
export declare function polylineLength(pts: Pt[]): number;
export declare function layoutChipset(W: number, H: number, labels: string[], measure: MeasureFn): ChipsetLayout;
