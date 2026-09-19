import type { MosaicAssetManifest, MosaicColor, MosaicMediaSource, MosaicSource, MosaicTextSource } from "@m0saic/types";
import type { DvdPanelId } from "../dieline";
export type PxRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type PanelGeometry = {
    id: DvdPanelId;
    trim: PxRect;
    paint: PxRect;
    safe: PxRect;
    widthMm: number;
    heightMm: number;
    dpi: number;
};
export type PanelPiece = {
    rect: PxRect & {
        importance?: number;
    };
    source: MosaicSource;
};
export type DvdAssetRegistry = {
    manifest: MosaicAssetManifest;
    media(path: string, label: string, fit?: "contain" | "cover"): MosaicMediaSource;
};
export declare function createDvdAssetRegistry(): DvdAssetRegistry;
export declare function pxPerMm(dpi: number): number;
export declare function insetRect(rect: PxRect, inset: number): PxRect;
export declare function sliceRect(rect: PxRect, xFrac: number, yFrac: number, wFrac: number, hFrac: number): PxRect;
export declare function textSource(args: {
    text: string;
    fontSize: number;
    color: MosaicColor;
    label: string;
    hAlign?: "left" | "center" | "right";
    backgroundColor?: MosaicColor;
}): MosaicTextSource;
export declare function textBlockPieces(args: {
    text: string;
    rect: PxRect;
    fontSize: number;
    color: MosaicColor;
    label: string;
    maxLines: number;
    hAlign?: "left" | "center" | "right";
    importance?: number;
}): PanelPiece[];
export declare function solidPiece(rect: PxRect, color: MosaicColor, label: string, importance?: number): PanelPiece;
export declare function mediaPiece(rect: PxRect, source: MosaicMediaSource, importance?: number): PanelPiece;
export declare function gridRects(rect: PxRect, count: number, gapPx: number): PxRect[];
export declare function cornerRect(bounds: PxRect, corner: "top-left" | "top-right" | "bottom-left" | "bottom-right", size: number, pad: number): PxRect;
