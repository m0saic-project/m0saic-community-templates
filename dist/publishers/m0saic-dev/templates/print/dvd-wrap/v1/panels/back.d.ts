import type { MosaicDocument, MosaicRenderableFile } from "@m0saic/types";
import type { DvdWrapV1Props } from "../props";
import type { EffectiveDvdVariant } from "../variants";
import type { DvdValidationResult } from "../validation";
import { type DvdAssetRegistry, type PanelGeometry, type PanelPiece } from "./common";
export type BarcodeBuild = {
    child: MosaicDocument;
    moduleWidthPx: number;
    achievedMagnificationPct: number;
};
export declare function buildPackagingBarcode(variant: EffectiveDvdVariant, normalizedBarcode: string, dpi: number): BarcodeBuild;
export declare function buildBackPanel(args: {
    props: DvdWrapV1Props;
    variant: EffectiveDvdVariant;
    validation: DvdValidationResult;
    geometry: PanelGeometry;
    assets: DvdAssetRegistry;
    children: Record<string, MosaicRenderableFile>;
}): {
    pieces: PanelPiece[];
    barcode: BarcodeBuild;
};
