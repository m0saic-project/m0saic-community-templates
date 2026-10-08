import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import type { LayoutConstraint, RelationalConstraint } from "@m0saic/template-utils";
import { assertLayout, textEmUnits, withLayoutContract } from "@m0saic/template-utils";

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
export const CONTRACT_CANVASES: ReadonlyArray<readonly [number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1080, 1920],
  [1080, 1080],
  [3840, 2160],
  [640, 360],
  [480, 270],
];

/**
 * `textFits` calibrated to a MEASURED block. The contract's ruler estimates
 * `em-units x fontSize x charWidthEm` with a coarse 0.72 default, which flags
 * a line that was fitted against the real font at the full box width. Hand
 * it the measured ratio (+2%) instead: the check then compares the TRUE
 * width with the REALIZED box - the quantization crush it exists to catch.
 */
export function textFitsMeasured(label: string, text: string, fontSize: number, measuredWidthPx: number): LayoutConstraint {
  const longest = text.split("\n").reduce((m, l) => Math.max(m, textEmUnits(l)), 0);
  const em = longest > 0 && fontSize > 0 ? (measuredWidthPx / (longest * fontSize)) * 1.02 : 0.72;
  return { label, textFits: { charWidthEm: Math.max(0.05, Math.min(2, em)), padPx: 0 } };
}

/** Return this from `render()` in place of the bare document. */
export function withLayoutIntent(
  doc: MosaicDocument,
  ctx: MosaicEngineContext,
  opts: { templateId: string; debug?: boolean } & LayoutIntent,
): MosaicDocument {
  const intent: LayoutIntent = {
    constraints: opts.constraints,
    ...(opts.relations && opts.relations.length > 0 ? { relations: opts.relations } : {}),
  };
  const checked = withLayoutContract(doc, ctx, {
    templateId: opts.templateId,
    constraints: intent.constraints,
    relations: opts.relations,
    debug: opts.debug === true,
  });
  return { ...checked, editor: { ...(checked.editor ?? {}), layoutIntent: intent } as MosaicDocument["editor"] };
}

/** The stamped intent of a rendered document, or null when the template declared none. */
export function layoutIntentOf(doc: MosaicDocument): LayoutIntent | null {
  const v = (doc.editor as { layoutIntent?: unknown } | undefined)?.layoutIntent;
  if (!v || typeof v !== "object" || !Array.isArray((v as LayoutIntent).constraints)) return null;
  return v as LayoutIntent;
}

/**
 * Render at every contract canvas and assert the stamped intent holds - the
 * sweep a template's test runs for each props variant worth stressing (long
 * copy, emptied rows, a picture).
 */
export async function sweepLayout<P extends object>(
  render: (props: P, ctx: MosaicEngineContext) => Promise<MosaicDocument> | MosaicDocument,
  templateId: string,
  props: P,
  makeCtx: (w: number, h: number) => MosaicEngineContext,
  canvases: ReadonlyArray<readonly [number, number]> = CONTRACT_CANVASES,
): Promise<void> {
  for (const [w, h] of canvases) {
    const ctx = makeCtx(w, h);
    const doc = await render(props, ctx);
    const intent = layoutIntentOf(doc);
    if (!intent) throw new Error(`${templateId}: render at ${w}x${h} carries no layout intent (return withLayoutIntent(...) from render)`);
    assertLayout(doc, ctx, templateId, { constraints: intent.constraints, relations: intent.relations });
  }
}
