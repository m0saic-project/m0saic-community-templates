/**
 * Real-geometry layout for the dual-subtitle renderer: every slot is a real
 * m0 cell (placeRects), never a full-canvas overlay positioned in-source.
 * Slot edges snap to a 4px grid so placeRects can GCD-collapse the string.
 *
 * - "stack": canvas == video; target slot above native slot in the lower
 *   frame, side margins, fixed positions (nothing shifts when native is
 *   omitted — the slots are the stable eye anchors).
 * - "bar": canvas extends BELOW the video by ~1/6 of its height; both slots
 *   live in the letterbox bar (zero art occlusion). The bar background is
 *   the document backgroundColor.
 */
export type DualSubLayoutKind = "stack" | "bar";
export type DualSubSizeProfile = "tv" | "desktop";
export type SlotId = "video" | "target" | "native" | "nativeBlur";
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type DualSubLayout = {
    m0: string;
    canvasW: number;
    canvasH: number;
    /** Slot ids in m0 F-slot (source array) order. */
    slotOrder: SlotId[];
    rects: Record<SlotId, Rect>;
    targetFontSize: number;
    /** Per-slot text vertical alignment (both lines hug the seam). */
    textVAlign: {
        target: "top" | "middle" | "bottom";
        native: "top" | "bottom";
    };
};
export declare function buildDualSubLayout(args: {
    layout: DualSubLayoutKind;
    videoW: number;
    videoH: number;
    sizeProfile: DualSubSizeProfile;
    /** Which subtitle slots exist. Hidden slots are not carved (real geometry only). */
    slots: {
        target: boolean;
        native: boolean;
        nativeBlur?: boolean;
    };
}): DualSubLayout;
