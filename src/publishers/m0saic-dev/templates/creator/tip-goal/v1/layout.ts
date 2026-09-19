/**
 * Layout — placement presets → integer pixel rects for the widget band and
 * its label/bar split, plus the strictly-validated m0 escape hatch and the
 * per-field pixel overrides (the beat-hero layout discipline: minimums clamp
 * on tiny canvases; below hard floors the caller maps to a
 * TG_CANVAS_TOO_SMALL error mosaic; an explicitly authored layout that can't
 * be honored errors rather than silently rendering elsewhere).
 */

import type { M0String } from "@m0saic/dsl";
import {
  parseM0StringComplete,
  parseM0StringToRenderFrames,
} from "@m0saic/dsl";
import { textEmUnits } from "@m0saic/template-utils";

import type {
  TipGoalBarPlacement,
  TipGoalGeometryOverride,
  TipGoalLabelPlacement,
} from "./types";

export type Rect = { x: number; y: number; w: number; h: number };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type TipGoalLook = {
  placement: TipGoalBarPlacement;
  widthFrac: number;
  heightFrac: number;
  marginFrac: number;
  labelPlacement: TipGoalLabelPlacement;
  labelWidthFrac: number;
  fontScale: number;
};

export type TipGoalGeometry = {
  /** The bar on the output canvas. */
  barRect: Rect;
  /** The counter zone on the output canvas; absent = no counter. */
  labelRect?: Rect;
  /** Auto-fit (or overridden) counter font size, px. */
  fontPx: number;
};

export type GeometryOutcome =
  | { ok: true; geom: TipGoalGeometry; warnings: string[] }
  | { ok: false; code: string; message: string };

/**
 * Geometry from the canvas + look (+ the layoutM0 whole-band replacement and
 * per-field pixel overrides). `sampleText` is the widest string the counter
 * will show — the font auto-fit sizes against it.
 */
export function computeTipGoalGeometry(
  W: number,
  H: number,
  look: TipGoalLook,
  sampleText: string,
  rectOverride: Rect | undefined,
  override: TipGoalGeometryOverride | undefined,
): GeometryOutcome {
  const warnings: string[] = [];

  // ── Widget band ──
  let widget: Rect;
  if (rectOverride) {
    widget = clampRect(rectOverride, W, H);
  } else {
    const wW = clamp(Math.round(look.widthFrac * W), 64, W);
    const wH = clamp(Math.round(look.heightFrac * H), 24, H);
    const margin = Math.round(look.marginFrac * H);
    const x = Math.round((W - wW) / 2);
    const y =
      look.placement === "top"
        ? margin
        : look.placement === "center"
          ? Math.round((H - wH) / 2)
          : H - wH - margin;
    widget = clampRect({ x, y, w: wW, h: wH }, W, H);
  }

  // ── Label / bar split inside the band ──
  let labelRect: Rect | undefined;
  let barRect: Rect;
  if (look.labelPlacement === "none") {
    barRect = widget;
  } else if (look.labelPlacement === "above") {
    const labelH = clamp(Math.round(widget.h * 0.5), 18, Math.max(18, widget.h - 16));
    const gap = Math.round(widget.h * 0.06);
    labelRect = { x: widget.x, y: widget.y, w: widget.w, h: labelH };
    barRect = {
      x: widget.x,
      y: widget.y + labelH + gap,
      w: widget.w,
      h: Math.max(1, widget.h - labelH - gap),
    };
  } else {
    const labelW = clamp(
      Math.round(look.labelWidthFrac * widget.w),
      40,
      Math.round(widget.w * 0.5),
    );
    const gap = Math.round(widget.w * 0.015);
    const barW = Math.max(1, widget.w - labelW - gap);
    if (look.labelPlacement === "right") {
      barRect = { x: widget.x, y: widget.y, w: barW, h: widget.h };
      labelRect = { x: widget.x + barW + gap, y: widget.y, w: labelW, h: widget.h };
    } else {
      labelRect = { x: widget.x, y: widget.y, w: labelW, h: widget.h };
      barRect = { x: widget.x + labelW + gap, y: widget.y, w: barW, h: widget.h };
    }
  }

  // ── Per-field pixel overrides ──
  if (override?.barRect) barRect = clampRect(override.barRect, W, H);
  if (override?.labelRect) labelRect = clampRect(override.labelRect, W, H);

  // ── Floors ──
  if (barRect.w < 48 || barRect.h < 10) {
    return {
      ok: false,
      code: "TG_CANVAS_TOO_SMALL",
      message:
        `The bar (${barRect.w}x${barRect.h}px) is below the 48x10px floor — ` +
        `grow the canvas, the widget fractions, or the Geometry rects.`,
    };
  }
  if (labelRect && (labelRect.w < 24 || labelRect.h < 14)) {
    warnings.push(
      `The counter zone (${labelRect.w}x${labelRect.h}px) is below the 24x14px floor — counter hidden.`,
    );
    labelRect = undefined;
  }

  // ── Counter font auto-fit ──
  let fontPx = 0;
  if (labelRect) {
    const units = Math.max(1, textEmUnits(sampleText));
    const heightCap =
      look.labelPlacement === "above" ? labelRect.h * 0.78 : labelRect.h * 0.62;
    const widthCap = (labelRect.w * 0.94) / (units * 0.62);
    fontPx = Math.round(clamp(Math.min(heightCap, widthCap) * look.fontScale, 10, 480));
  }
  if (override?.fontSizePx !== undefined && Number.isFinite(override.fontSizePx)) {
    fontPx = Math.round(clamp(override.fontSizePx, 8, 600));
  }

  return { ok: true, geom: { barRect, labelRect, fontPx }, warnings };
}

function clampRect(r: Rect, W: number, H: number): Rect {
  const w = clamp(Math.round(r.w), 1, W);
  const h = clamp(Math.round(r.h), 1, H);
  const x = clamp(Math.round(r.x), 0, W - w);
  const y = clamp(Math.round(r.y), 0, H - h);
  return { x, y, w, h };
}

// ── The m0 escape hatch ───────────────────────────────────────────────────

export type LayoutM0Outcome =
  | { kind: "unset" }
  | { kind: "rect"; rect: Rect }
  | { kind: "error"; code: string; message: string };

/**
 * Validate the `layoutM0` escape hatch: normalize (strip `#` comments and
 * blank lines; empty → unset), parse at the ctx canvas, require exactly ONE
 * rendered rect shaped like a widget band (wide: w >= 2h, h >= 20). Every
 * failure is a hard error.
 */
export function validateLayoutM0(
  raw: string | undefined,
  W: number,
  H: number,
): LayoutM0Outcome {
  const normalized = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0)
    .join("");
  if (normalized === "") return { kind: "unset" };

  let frames: Array<{ x: number; y: number; width: number; height: number }>;
  try {
    const result = parseM0StringComplete(normalized as M0String, W, H);
    frames = result.ok
      ? result.ir.renderFrames
      : parseM0StringToRenderFrames(normalized as M0String, W, H);
  } catch (err) {
    return {
      kind: "error",
      code: "TG_M0_PARSE",
      message: `Layout (m0) is not a valid m0 string: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (!frames || frames.length === 0) {
    return {
      kind: "error",
      code: "TG_M0_PARSE",
      message: "Layout (m0) parsed to no rendered rect.",
    };
  }
  if (frames.length !== 1) {
    return {
      kind: "error",
      code: "TG_M0_COUNT",
      message:
        `Layout (m0) must resolve to exactly ONE rect (got ${frames.length}) — ` +
        `carve the box with '-' null tiles.`,
    };
  }
  const f = frames[0];
  const rect: Rect = {
    x: Math.round(f.x),
    y: Math.round(f.y),
    w: Math.round(f.width),
    h: Math.round(f.height),
  };
  if (!(rect.w >= 2 * rect.h && rect.h >= 20)) {
    return {
      kind: "error",
      code: "TG_M0_SHAPE",
      message: `Layout (m0) rect is ${rect.w}x${rect.h} — the widget needs a wide band (w >= 2*h, h >= 20).`,
    };
  }
  return { kind: "rect", rect };
}

// ── Geometry-override (json) validation ───────────────────────────────────

export type GeometryOverrideOutcome =
  | { ok: true; value: TipGoalGeometryOverride; warnings: string[] }
  | { ok: false; code: string; message: string };

const RECT_KEYS = ["barRect", "labelRect"] as const;

/** Parse the agent `geometry` prop. Unknown keys ignored (forward compat). */
export function validateGeometryOverride(
  raw: unknown,
): GeometryOverrideOutcome {
  if (raw === undefined || raw === null) return { ok: true, value: {}, warnings: [] };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      code: "TG_GEOMETRY_PARSE",
      message: "Geometry (px) must be an object like { barRect: {x,y,w,h}, ... }.",
    };
  }
  const obj = raw as Record<string, unknown>;
  const value: TipGoalGeometryOverride = {};
  const warnings: string[] = [];
  for (const key of RECT_KEYS) {
    const r = obj[key];
    if (r === undefined) continue;
    if (
      typeof r !== "object" ||
      r === null ||
      !isFiniteNum((r as Record<string, unknown>).x) ||
      !isFiniteNum((r as Record<string, unknown>).y) ||
      !isFiniteNum((r as Record<string, unknown>).w) ||
      !isFiniteNum((r as Record<string, unknown>).h)
    ) {
      return {
        ok: false,
        code: "TG_GEOMETRY",
        message: `geometry.${key} must be {x,y,w,h} with finite numbers.`,
      };
    }
    const rect = r as { x: number; y: number; w: number; h: number };
    if (rect.w <= 0 || rect.h <= 0) {
      return {
        ok: false,
        code: "TG_GEOMETRY",
        message: `geometry.${key} must have positive w/h (got ${rect.w}x${rect.h}).`,
      };
    }
    value[key] = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
  const fs = obj.fontSizePx;
  if (fs !== undefined) {
    if (isFiniteNum(fs)) value.fontSizePx = fs as number;
    else warnings.push("geometry.fontSizePx is not a finite number — ignored.");
  }
  return { ok: true, value, warnings };
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
