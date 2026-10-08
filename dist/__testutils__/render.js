"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultCtx = void 0;
exports.asDocument = asDocument;
exports.asPipeline = asPipeline;
exports.targetCtx = targetCtx;
function asDocument(renderable) {
    if (renderable.kind !== "mosaic_document") {
        throw new Error(`expected a mosaic_document, got "${renderable.kind}"`);
    }
    return renderable;
}
function asPipeline(renderable) {
    if (renderable.kind !== "mosaic_pipeline") {
        throw new Error(`expected a mosaic_pipeline, got "${renderable.kind}"`);
    }
    return renderable;
}
/**
 * The minimal honest ctx: `mode`, `target`, and `output` are what
 * `defineMosaicTemplate`'s wrapper itself reads on EVERY render (compaction
 * + output stamping), so a real host always supplies them — and so must
 * tests. `media` defaults empty. Anything else stays absent on purpose:
 * a template touching a ctx member it didn't declare a need for should
 * fail loudly here.
 */
function targetCtx(width, height, opts = {}) {
    const target = {
        width,
        height,
        fps: opts.fps ?? 30,
        durationMs: opts.durationMs ?? 2000,
    };
    return {
        mode: "render",
        target,
        output: { ...target, workspaceDir: "/tmp/starter-test" },
        media: opts.media ?? {},
    };
}
/** The default 16:9 test canvas for templates with no size-sensitive logic. */
exports.defaultCtx = targetCtx(1280, 720);
