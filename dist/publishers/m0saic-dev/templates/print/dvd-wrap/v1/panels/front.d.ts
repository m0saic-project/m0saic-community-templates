import type { DvdWrapV1Props } from "../props";
import type { EffectiveDvdVariant } from "../variants";
import type { DvdValidationResult } from "../validation";
import { type DvdAssetRegistry, type PanelGeometry, type PanelPiece } from "./common";
export declare function buildFrontPanel(args: {
    props: DvdWrapV1Props;
    variant: EffectiveDvdVariant;
    validation: DvdValidationResult;
    geometry: PanelGeometry;
    assets: DvdAssetRegistry;
}): PanelPiece[];
