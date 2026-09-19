import type {
  MosaicDocument,
  MosaicEngineContext,
  MosaicRenderableFile,
  MosaicTemplateOutputs,
  MosaicTemplateUpstreamData,
  MosaicTemplateUpstreamVariables,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import {
  defineMosaicTemplate,
  makeErrorMosaic,
} from "@m0saic/template-utils";
import { dvdFitDpiToTarget, resolveDvdDieline } from "./dieline";
import { renderDvdWrapCover } from "./dvd-wrap-cover";
import { renderDvdWrapTutorial } from "./dvd-wrap-tutorial";
import { renderDvdWrapPipeline } from "./pipeline";
import {
  DVD_WRAP_DEFAULT_PROPS,
  dvdWrapPropsSchema,
  type DvdWrapV1Props,
} from "./props";
import type { DvdPackagingSidecar } from "./validation";

export const DVD_WRAP_V1_ID = asTemplateId("@m0saic-dev/print/dvd-wrap/v1");

// Device hint = the default wrap's REAL canvas, derived from the dieline so
// it tracks the lattice snap (raw mm math says 3307×2244; the snap moves it
// a few px to divisor-rich dims). A hardcoded hint that disagrees with the
// rendered doc's `size` makes Make treat the doc as "step declares its own
// canvas" from the very first open. Pure + deterministic at module init.
const DEFAULT_WRAP_CANVAS = resolveDvdDieline({
  caseType: "standard",
  discCount: 1,
  bleedMm: 3,
  dpi: 300,
}).canvas;

type DvdWrapSidecars = { packaging: DvdPackagingSidecar };

function globalError(message: string, ctx: MosaicEngineContext): MosaicDocument {
  return {
    ...makeErrorMosaic(message, {
      title: "DVD Wrap",
      errorCode: "DVD_WRAP_INVALID",
      width: ctx.target.width,
      height: ctx.target.height,
    }),
    size: { width: ctx.target.width, height: ctx.target.height },
    fps: 30,
    durationMs: 1000,
    format: { kind: "image", container: "png", pixelFormat: "rgba" },
  };
}

export const DvdWrapV1 = defineMosaicTemplate<
  DvdWrapV1Props,
  MosaicTemplateOutputs,
  MosaicTemplateUpstreamVariables,
  MosaicTemplateUpstreamData,
  DvdWrapSidecars
>({
  id: DVD_WRAP_V1_ID,
  label: "DVD Wrap",
  version: 1,
  role: "renderable",
  description: "Build dieline-exact DVD wrap masters and fan out territory variants with barcodes, production metadata, validation records, panel renders, and proofs.",
  capabilities: { tier: "core" },
  tags: ["utility", "print", "packaging", "dvd", "batch", "barcode", "designers", "print-design", "dieline"],
  propsSchema: dvdWrapPropsSchema,
  // The canvas is the print spec: a standard keep-case wrap at 300 DPI with 3 mm
  // bleed is 3307×2244 px by the mm math, and the dieline snap moves it ≤3 px to
  // divisor-rich 3304×2244 so the panel emitters get a lattice at all. No 5-smooth
  // width exists within print tolerance (nearest is 3240 — 5.7 mm off, a different
  // wrap), so the rough canvas is declared physical: the counts it explains are
  // charged to it, and everything the template lays out INSIDE the panels is still
  // held to the lattice. Same posture as brand/business-card.
  lattice: { canvas: "physical" },
  sidecarsSchema: {
    packaging: {
      type: "object",
      required: true,
      description: "Per-SKU production record: dieline, barcode, DPI, element, layout, and validation facts.",
    },
  },
  outputHints: {
    width: DEFAULT_WRAP_CANVAS.width,
    height: DEFAULT_WRAP_CANVAS.height,
    fps: 30,
    durationMs: 1000,
    note: "Standard keep-case wrap at 300 DPI with 3mm bleed. RGB PNG master; CMYK/PDF-X conversion is downstream.",
    format: { kind: "image", container: "png", pixelFormat: "rgba" },
  },
  defaultProps: DVD_WRAP_DEFAULT_PROPS,

  async render(props: DvdWrapV1Props, ctx: MosaicEngineContext): Promise<MosaicRenderableFile> {
    try {
      if (!props.title?.trim()) throw new Error("title is required");
      const dpi = props.dpi ?? 300;
      if (!Number.isFinite(dpi) || dpi < 72 || dpi > 600) throw new Error("dpi must be between 72 and 600");
      const discCount = props.discCount ?? 1;
      const dielineArgs = {
        caseType: props.caseType ?? "standard",
        discCount,
        ...(props.spineWidthMm != null ? { spineWidthMm: props.spineWidthMm } : {}),
        bleedMm: props.bleedMm ?? 3,
      };
      // User override wins (Make device dims / CLI -w -h): a requested canvas
      // that differs from the natural print canvas scales the render via the
      // effective dpi (aspect preserved). Requests at/near the natural canvas
      // (the outputHints default) keep the exact print master.
      const effectiveDpi = dvdFitDpiToTarget({
        ...dielineArgs,
        dpi,
        target: ctx.target ?? null,
      });
      const dieline = resolveDvdDieline({ ...dielineArgs, dpi: effectiveDpi });
      return renderDvdWrapPipeline(props, ctx, dieline);
    } catch (cause) {
      return globalError(cause instanceof Error ? cause.message : String(cause), ctx);
    }
  },

  renderCover(_props: DvdWrapV1Props, ctx: MosaicEngineContext): MosaicDocument {
    return renderDvdWrapCover(ctx);
  },

  renderTutorial(_props: DvdWrapV1Props, ctx: MosaicEngineContext) {
    return renderDvdWrapTutorial(ctx);
  },
});

