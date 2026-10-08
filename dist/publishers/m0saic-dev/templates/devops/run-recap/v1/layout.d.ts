import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import type { LayoutConstraint, RelationalConstraint } from "@m0saic/template-utils";
/**
 * The layout-contract convention for this repo: a template says what its
 * geometry promises, and the promise travels with the document.
 *
 * `withLayoutIntent` is `withLayoutContract` (the debug tripwire: checked
 * only when the template's `debugLayout` knob is on, by ruling - a render
 * with a clipped line beats no render) plus one stamp: the constraints go on
 * `doc.editor.layoutIntent` on EVERY render, so a test can sweep them at the
 * seven contract canvases with `sweepLayout` without re-deriving them.
 */
export type LayoutIntent = {
    constraints: LayoutConstraint[];
    relations?: RelationalConstraint[];
};
/** The 7-canvas set from the authoring contract. */
export declare const CONTRACT_CANVASES: ReadonlyArray<readonly [number, number]>;
/**
 * `textFits` calibrated to a MEASURED block. The contract's ruler estimates
 * `em-units x fontSize x charWidthEm` with a coarse 0.72 default, which flags
 * a line that was fitted against the real font at the full box width. Hand
 * it the measured ratio (+2%) instead: the check then compares the TRUE
 * width with the REALIZED box - the quantization crush it exists to catch.
 */
export declare function textFitsMeasured(label: string, text: string, fontSize: number, measuredWidthPx: number): LayoutConstraint;
/** Return this from `render()` in place of the bare document. */
export declare function withLayoutIntent(doc: MosaicDocument, ctx: MosaicEngineContext, opts: {
    templateId: string;
    debug?: boolean;
} & LayoutIntent): MosaicDocument;
/** The stamped intent of a rendered document, or null when the template declared none. */
export declare function layoutIntentOf(doc: MosaicDocument): LayoutIntent | null;
/**
 * Render at every contract canvas and assert the stamped intent holds - the
 * sweep a template's test runs for each props variant worth stressing (long
 * copy, emptied rows, a picture).
 */
export declare function sweepLayout<P extends object>(render: (props: P, ctx: MosaicEngineContext) => Promise<MosaicDocument> | MosaicDocument, templateId: string, props: P, makeCtx: (w: number, h: number) => MosaicEngineContext, canvases?: ReadonlyArray<readonly [number, number]>): Promise<void>;
