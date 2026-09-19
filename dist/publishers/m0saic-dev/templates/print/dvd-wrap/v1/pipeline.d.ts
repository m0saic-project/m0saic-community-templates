import type { MosaicDocumentPipeline, MosaicEngineContext } from "@m0saic/types";
import { type ResolvedDieline } from "@m0saic/template-utils";
import type { DvdPanelId } from "./dieline";
import type { DvdWrapArtifact, DvdWrapV1Props, DvdWrapVariant } from "./props";
export declare function resolveDvdArtifacts(value: DvdWrapV1Props["artifacts"]): DvdWrapArtifact[];
export declare function buildDvdStepNames(variants: Array<DvdWrapVariant | undefined>, artifacts: DvdWrapArtifact[], baseTerritory: string): string[][];
export declare function renderDvdWrapPipeline(props: DvdWrapV1Props, ctx: MosaicEngineContext, dieline: ResolvedDieline<DvdPanelId>): MosaicDocumentPipeline;
