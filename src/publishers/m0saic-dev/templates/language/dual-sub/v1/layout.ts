import { placeRects, type PlaceRectsRect } from "@m0saic/dsl-stdlib";

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

export type Rect = { x: number; y: number; w: number; h: number };

export type DualSubLayout = {
  m0: string;
  canvasW: number;
  canvasH: number;
  /** Slot ids in m0 F-slot (source array) order. */
  slotOrder: SlotId[];
  rects: Record<SlotId, Rect>;
  targetFontSize: number;
  /** Per-slot text vertical alignment (both lines hug the seam). */
  textVAlign: { target: "top" | "middle" | "bottom"; native: "top" | "bottom" };
};

const SNAP = 4;
const snap = (v: number) => Math.max(SNAP, Math.round(v / SNAP) * SNAP);

export function buildDualSubLayout(args: {
  layout: DualSubLayoutKind;
  videoW: number;
  videoH: number;
  sizeProfile: DualSubSizeProfile;
  /** Which subtitle slots exist. Hidden slots are not carved (real geometry only). */
  slots: { target: boolean; native: boolean; nativeBlur?: boolean };
}): DualSubLayout {
  const { layout, videoW, videoH, sizeProfile, slots } = args;
  const W = Math.round(videoW);
  const H = Math.round(videoH);

  // Broadcast-ish sizing: ~4.2% of video height on TV, tighter on desktop.
  const targetFontSize = Math.max(14, Math.round(H * (sizeProfile === "tv" ? 0.042 : 0.034)));
  const targetLineH = Math.round(targetFontSize * 1.3);
  const nativeLineH = Math.round(targetFontSize * 0.75 * 1.3);

  const sideMargin = snap(W * 0.1);
  const slotW = W - 2 * sideMargin;
  const targetH = snap(2 * targetLineH + targetFontSize * 0.25);
  const nativeH = snap(2 * nativeLineH + targetFontSize * 0.2);

  // ONE bottom-anchored band, everything pulled toward the bottom (founder
  // review): both texts bottom-aligned in their rects, a small fixed gap
  // between the rects, and a tight safe margin. A 1-line native cue hugs the
  // screen bottom; the target sits a fixed height above it (stable slots).
  const gap = slots.native ? snap(H * 0.006) : 0;
  const bandH = slots.native ? targetH + gap + nativeH : targetH;

  let canvasH = H;
  let bandY: number;
  const videoRect: Rect = { x: 0, y: 0, w: W, h: H };

  if (layout === "bar") {
    const pad = snap(H * 0.012);
    const barH = snap(pad + bandH + pad);
    canvasH = H + barH;
    bandY = H + pad;
  } else {
    const safeBottom = snap(H * 0.022);
    bandY = H - safeBottom - bandH;
  }

  const nativeRect: Rect = { x: sideMargin, y: bandY + targetH + gap, w: slotW, h: nativeH };
  const rects: Record<SlotId, Rect> = {
    video: videoRect,
    target: { x: sideMargin, y: bandY, w: slotW, h: targetH },
    native: nativeRect,
    // Blur-to-unblur reveal: a twin slot exactly over the native rect that
    // carries the blurred pre-reveal phase of each delayed cue.
    nativeBlur: nativeRect,
  };

  // Paint order: video below, subtitle slots above. Slots share importance —
  // they never overlap (disjoint Y bands), so they pack onto one layer.
  const order: SlotId[] = ["video"];
  if (slots.target) order.push("target");
  if (slots.native && slots.nativeBlur) order.push("nativeBlur");
  if (slots.native) order.push("native");

  const textVAlign = {
    // Everything pulls toward the screen bottom: both texts hug their rect
    // bottoms, so a 1-line native cue sits as low as possible.
    target: "bottom" as const,
    native: "bottom" as const,
  };

  if (order.length === 1) {
    // Raw pass-through (cold-turkey): the video is the whole canvas.
    return { m0: "F", canvasW: W, canvasH, slotOrder: order, rects, targetFontSize, textVAlign };
  }

  const placeInput: PlaceRectsRect[] = order.map((id) => ({
    ...rects[id],
    // Distinct importance per slot: nativeBlur overlaps native exactly, so
    // the packer must split them across layers in a DETERMINISTIC order
    // (blur below the sharp line).
    importance: id === "video" ? 0 : id === "target" ? 1 : id === "nativeBlur" ? 2 : 3,
  }));

  const placed = placeRects({ rootW: W, rootH: canvasH, rects: placeInput });

  const slotOrder: SlotId[] = [];
  for (const layer of placed.layers) {
    const sorted = [...layer.rectIndices].sort(
      (a, b) => placeInput[a].y - placeInput[b].y || placeInput[a].x - placeInput[b].x,
    );
    for (const idx of sorted) slotOrder.push(order[idx]);
  }

  return {
    m0: String(placed.m0),
    canvasW: W,
    canvasH,
    slotOrder,
    rects,
    targetFontSize,
    textVAlign,
  };
}
