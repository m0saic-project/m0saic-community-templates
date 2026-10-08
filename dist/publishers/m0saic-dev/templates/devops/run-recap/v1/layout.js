"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACT_CANVASES = void 0;
exports.textFitsMeasured = textFitsMeasured;
exports.withLayoutIntent = withLayoutIntent;
exports.layoutIntentOf = layoutIntentOf;
exports.sweepLayout = sweepLayout;
const template_utils_1 = require("@m0saic/template-utils");
/** The 7-canvas set from the authoring contract. */
exports.CONTRACT_CANVASES = [
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
function textFitsMeasured(label, text, fontSize, measuredWidthPx) {
    const longest = text.split("\n").reduce((m, l) => Math.max(m, (0, template_utils_1.textEmUnits)(l)), 0);
    const em = longest > 0 && fontSize > 0 ? (measuredWidthPx / (longest * fontSize)) * 1.02 : 0.72;
    return { label, textFits: { charWidthEm: Math.max(0.05, Math.min(2, em)), padPx: 0 } };
}
/** Return this from `render()` in place of the bare document. */
function withLayoutIntent(doc, ctx, opts) {
    const intent = {
        constraints: opts.constraints,
        ...(opts.relations && opts.relations.length > 0 ? { relations: opts.relations } : {}),
    };
    const checked = (0, template_utils_1.withLayoutContract)(doc, ctx, {
        templateId: opts.templateId,
        constraints: intent.constraints,
        relations: opts.relations,
        debug: opts.debug === true,
    });
    return { ...checked, editor: { ...(checked.editor ?? {}), layoutIntent: intent } };
}
/** The stamped intent of a rendered document, or null when the template declared none. */
function layoutIntentOf(doc) {
    const v = doc.editor?.layoutIntent;
    if (!v || typeof v !== "object" || !Array.isArray(v.constraints))
        return null;
    return v;
}
/**
 * Render at every contract canvas and assert the stamped intent holds - the
 * sweep a template's test runs for each props variant worth stressing (long
 * copy, emptied rows, a picture).
 */
async function sweepLayout(render, templateId, props, makeCtx, canvases = exports.CONTRACT_CANVASES) {
    for (const [w, h] of canvases) {
        const ctx = makeCtx(w, h);
        const doc = await render(props, ctx);
        const intent = layoutIntentOf(doc);
        if (!intent)
            throw new Error(`${templateId}: render at ${w}x${h} carries no layout intent (return withLayoutIntent(...) from render)`);
        (0, template_utils_1.assertLayout)(doc, ctx, templateId, { constraints: intent.constraints, relations: intent.relations });
    }
}
