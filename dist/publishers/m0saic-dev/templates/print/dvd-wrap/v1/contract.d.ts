import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import { type LayoutCheckResult, type LayoutConstraint } from "@m0saic/template-utils";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";
export declare function dvdLayoutConstraints(args: {
    artifact: DvdWrapArtifact;
    props: DvdWrapV1Props;
    canvasW: number;
    canvasH: number;
    backSafe?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}): LayoutConstraint[];
export declare function checkDvdLayout(doc: MosaicDocument, constraints: LayoutConstraint[]): LayoutCheckResult;
export declare function applyDvdLayoutContract(doc: MosaicDocument, ctx: MosaicEngineContext, constraints: LayoutConstraint[], debug: boolean): MosaicDocument;
