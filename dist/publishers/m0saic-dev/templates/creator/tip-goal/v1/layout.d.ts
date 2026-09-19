/**
 * Layout — placement presets → integer pixel rects for the widget band and
 * its label/bar split, plus the strictly-validated m0 escape hatch and the
 * per-field pixel overrides (the beat-hero layout discipline: minimums clamp
 * on tiny canvases; below hard floors the caller maps to a
 * TG_CANVAS_TOO_SMALL error mosaic; an explicitly authored layout that can't
 * be honored errors rather than silently rendering elsewhere).
 */
import type { TipGoalBarPlacement, TipGoalGeometryOverride, TipGoalLabelPlacement } from "./types";
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export declare function clamp(v: number, lo: number, hi: number): number;
export type TipGoalLook = {
    placement: TipGoalBarPlacement;
    widthFrac: number;
    heightFrac: number;
    marginFrac: number;
    labelPlacement: TipGoalLabelPlacement;
    labelWidthFrac: number;
    fontScale: number;
};
export type TipGoalGeometry = {
    /** The bar on the output canvas. */
    barRect: Rect;
    /** The counter zone on the output canvas; absent = no counter. */
    labelRect?: Rect;
    /** Auto-fit (or overridden) counter font size, px. */
    fontPx: number;
};
export type GeometryOutcome = {
    ok: true;
    geom: TipGoalGeometry;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
/**
 * Geometry from the canvas + look (+ the layoutM0 whole-band replacement and
 * per-field pixel overrides). `sampleText` is the widest string the counter
 * will show — the font auto-fit sizes against it.
 */
export declare function computeTipGoalGeometry(W: number, H: number, look: TipGoalLook, sampleText: string, rectOverride: Rect | undefined, override: TipGoalGeometryOverride | undefined): GeometryOutcome;
export type LayoutM0Outcome = {
    kind: "unset";
} | {
    kind: "rect";
    rect: Rect;
} | {
    kind: "error";
    code: string;
    message: string;
};
/**
 * Validate the `layoutM0` escape hatch: normalize (strip `#` comments and
 * blank lines; empty → unset), parse at the ctx canvas, require exactly ONE
 * rendered rect shaped like a widget band (wide: w >= 2h, h >= 20). Every
 * failure is a hard error.
 */
export declare function validateLayoutM0(raw: string | undefined, W: number, H: number): LayoutM0Outcome;
export type GeometryOverrideOutcome = {
    ok: true;
    value: TipGoalGeometryOverride;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
/** Parse the agent `geometry` prop. Unknown keys ignored (forward compat). */
export declare function validateGeometryOverride(raw: unknown): GeometryOverrideOutcome;
