import type { MosaicEngineContext } from "@m0saic/types";
import { type DpiFloorClassification, type ResolvedDieline } from "@m0saic/template-utils";
import type { DvdPanelId } from "./dieline";
import type { DvdWrapArtifact, DvdWrapV1Props } from "./props";
import type { EffectiveDvdVariant } from "./variants";
export type DvdDiagnostic = {
    severity: "error" | "warn";
    code: string;
    message: string;
};
export type DvdAssetDpiRecord = {
    prop: string;
    path: string;
    px?: [number, number];
    placedMm: [number, number];
    effectiveDpi?: number;
    classification: DpiFloorClassification | "unprobed";
};
export type DvdPackagingSidecar = {
    templateId: "@m0saic-dev/print/dvd-wrap/v1";
    schemaVersion: 1;
    artifact: DvdWrapArtifact;
    variant: {
        territory: string;
        skuLabel: string;
        catalogNumber: string;
    };
    dieline: {
        caseType: string;
        spineMm: number;
        trimMm: [number, number];
        bleedMm: number;
        dpi: number;
        pxSize: [number, number];
        panelPx: Record<string, {
            x: number;
            y: number;
            width: number;
            height: number;
        }>;
    };
    barcode: {
        symbology: string;
        payload: string;
        checkDigitValid: boolean;
        moduleWidthPx: number;
        achievedMagnificationPct: number;
    };
    elements: Array<{
        id: string;
        panel: string;
        present: boolean;
        placeholder: boolean;
    }>;
    text: Array<{
        id: string;
        characters: number;
        overflowRisk: boolean;
    }>;
    assets: DvdAssetDpiRecord[];
    layout: unknown[];
    colorSpace: "sRGB";
    notes: string[];
    postProcess: null;
    errors: DvdDiagnostic[];
    warnings: DvdDiagnostic[];
};
export type DvdValidationResult = {
    diagnostics: DvdDiagnostic[];
    normalizedBarcode: string;
    checkDigitValid: boolean;
    ratingBadgeArt?: string;
    distributorLogoArt?: string;
    assetDpi: DvdAssetDpiRecord[];
};
export declare function validateDvdVariant(props: DvdWrapV1Props, variant: EffectiveDvdVariant, ctx: MosaicEngineContext): DvdValidationResult;
export declare function buildPackagingSidecar(args: {
    artifact: DvdWrapArtifact;
    props: DvdWrapV1Props;
    variant: EffectiveDvdVariant;
    dieline: ResolvedDieline<DvdPanelId>;
    validation: DvdValidationResult;
    moduleWidthPx: number;
    achievedMagnificationPct: number;
    layout?: unknown[];
}): DvdPackagingSidecar;
