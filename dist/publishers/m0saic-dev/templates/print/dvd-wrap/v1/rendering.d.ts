import type { MosaicDocument, MosaicEngineContext } from "@m0saic/types";
import { type ResolvedDieline } from "@m0saic/template-utils";
import { type DvdPanelId } from "./dieline";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";
import type { EffectiveDvdVariant } from "./variants";
import { type DvdPackagingSidecar, type DvdValidationResult } from "./validation";
type ArtifactRenderResult = {
    doc: MosaicDocument;
    sidecar: DvdPackagingSidecar;
    layoutViolations: unknown[];
};
export declare function renderDvdArtifact(args: {
    artifact: DvdWrapArtifact;
    props: DvdWrapV1Props;
    variant: EffectiveDvdVariant;
    validation: DvdValidationResult;
    dieline: ResolvedDieline<DvdPanelId>;
    ctx: MosaicEngineContext;
}): ArtifactRenderResult;
export {};
