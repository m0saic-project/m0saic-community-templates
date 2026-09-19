import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import {
  checkLayout,
  withLayoutContract,
  type LayoutCheckResult,
  type LayoutConstraint,
} from "@m0saic/template-utils";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";

export function dvdLayoutConstraints(args: {
  artifact: DvdWrapArtifact;
  props: DvdWrapV1Props;
  canvasW: number;
  canvasH: number;
  backSafe?: { x: number; y: number; w: number; h: number };
}): LayoutConstraint[] {
  const constraints: LayoutConstraint[] = [];
  if (["wrap", "proof", "preview", "back"].includes(args.artifact)) {
    constraints.push({ label: "back synopsis" });
    if (args.backSafe) {
      constraints.push({
        label: "packaging barcode box",
        minWidthFrac: (args.backSafe.w / args.canvasW) * 0.3,
        minHeightFrac: (args.backSafe.h / args.canvasH) * 0.12,
        within: {
          xFrac: [args.backSafe.x / args.canvasW, (args.backSafe.x + args.backSafe.w) / args.canvasW],
          yFrac: [args.backSafe.y / args.canvasH, (args.backSafe.y + args.backSafe.h) / args.canvasH],
        },
      });
    } else {
      constraints.push({ label: "packaging barcode box" });
    }
  }
  if (["wrap", "proof", "preview", "front"].includes(args.artifact)) {
    constraints.push({ label: args.props.titleTreatmentArt ? "front title treatment" : "front title" });
  }
  if (["wrap", "proof", "preview", "spine"].includes(args.artifact)) {
    constraints.push({ label: "spine catalog number" });
  }
  return constraints;
}

export function checkDvdLayout(
  doc: MosaicDocument,
  constraints: LayoutConstraint[],
): LayoutCheckResult {
  const size = doc.size ?? { width: 1, height: 1 };
  return checkLayout(doc, {
    canvasW: size.width,
    canvasH: size.height,
    constraints,
    flatten: true,
  });
}

export function applyDvdLayoutContract(
  doc: MosaicDocument,
  ctx: MosaicEngineContext,
  constraints: LayoutConstraint[],
  debug: boolean,
): MosaicDocument {
  const size = doc.size ?? { width: ctx.target.width, height: ctx.target.height };
  const localCtx: MosaicEngineContext = {
    ...ctx,
    target: { ...ctx.target, width: size.width, height: size.height },
  };
  return withLayoutContract(doc, localCtx, {
    templateId: "@m0saic-dev/print/dvd-wrap/v1",
    constraints,
    flatten: true,
    debug,
  });
}
