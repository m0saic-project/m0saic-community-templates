import type { MosaicTemplateOutputs, MosaicTemplateUpstreamData, MosaicTemplateUpstreamVariables } from "@m0saic/types";
import { type DvdWrapV1Props } from "./props";
import type { DvdPackagingSidecar } from "./validation";
export declare const DVD_WRAP_V1_ID: import("@m0saic/types").TemplateId;
type DvdWrapSidecars = {
    packaging: DvdPackagingSidecar;
};
export declare const DvdWrapV1: import("@m0saic/types").MosaicTemplate<DvdWrapV1Props, MosaicTemplateOutputs, MosaicTemplateUpstreamVariables, MosaicTemplateUpstreamData, DvdWrapSidecars>;
export {};
