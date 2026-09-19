import { measureText } from "@m0saic/template-utils";

import {
  BAR_H_MAX_PX,
  FIT_SLACK,
  FONT_START_FRAC,
  ICON_FRAC,
  MIN_FONT_PX,
  PAD_X_FRAC,
  UNDERLINE_GAP_PX,
  UNDERLINE_H_PX,
  charAdvances,
  computeLayout,
  inkLeftPadPx,
  inkRightPadPx,
  type SearchBarLayoutInput,
} from "./layout";

const DEFAULT_INPUT: SearchBarLayoutInput = {
  canvasW: 1280,
  canvasH: 400,
  words: ["Ideas", "Answers", "Templates", "Tutorials", "Inspiration"],
  label: "Search for",
  frame: "card",
  showIcon: true,
  barWidthFrac: 0.62,
  barAspect: 0.26,
  cornerRadiusPx: 16,
};

describe("computeLayout — bar geometry", () => {
  const layout = computeLayout(DEFAULT_INPUT);

  it("centers the px-clamped bar ON the snap grid (defaults at 1280×400)", () => {
    // barW = round(0.62·1280) = 794 → snapped 792; barH = 206 → clamp 200
    // (a SNAP_PX multiple); centered then floor-snapped: x 240, y 96. The
    // grid-authored bar lets its placed cell BE the visual card.
    expect(layout.bar).toEqual({ x: 240, y: 96, w: 792, h: 200 });
    expect(layout.bar.h).toBe(BAR_H_MAX_PX);
  });

  it("keeps the corner radius and clamps it to barH/2", () => {
    expect(layout.cornerRadiusPx).toBe(16);
    const pill = computeLayout({ ...DEFAULT_INPUT, cornerRadiusPx: 500 });
    expect(pill.cornerRadiusPx).toBe(100);
  });

  it("caps the bar to a small canvas instead of overflowing it", () => {
    const small = computeLayout({
      ...DEFAULT_INPUT,
      canvasW: 300,
      canvasH: 80,
      words: ["Go"],
      label: "",
    });
    expect(small.bar.w).toBeLessThanOrEqual(300);
    expect(small.bar.h).toBeLessThanOrEqual(80);
  });

  it("places the icon square in the left pad zone, vertically centered", () => {
    const iconSize = Math.round(ICON_FRAC * layout.bar.h);
    expect(layout.icon).toEqual({
      x: layout.bar.x + Math.round(PAD_X_FRAC * layout.bar.h),
      y: Math.round(layout.bar.y + (layout.bar.h - iconSize) / 2),
      w: iconSize,
      h: iconSize,
    });
  });

  it("omits the icon zone when hidden — the label starts at the pad", () => {
    const layout2 = computeLayout({ ...DEFAULT_INPUT, showIcon: false });
    expect(layout2.icon).toBeNull();
    expect(layout2.labelX).toBe(layout2.bar.x + layout2.padXPx);
  });
});

describe('computeLayout — frame "fill"', () => {
  const layout = computeLayout({ ...DEFAULT_INPUT, frame: "fill" });

  it("makes the box the whole canvas, unclamped", () => {
    // canvasH 400 exceeds the card-mode BAR_H_MAX (200) — fill ignores clamps.
    expect(layout.bar).toEqual({ x: 0, y: 0, w: 1280, h: 400 });
  });

  it("scales the zones off the full canvas height", () => {
    expect(layout.icon?.w).toBe(Math.round(ICON_FRAC * 400));
    expect(layout.padXPx).toBe(Math.round(PAD_X_FRAC * 400));
    expect(layout.underlineY + UNDERLINE_H_PX).toBeLessThanOrEqual(400);
  });

  it("still clamps the corner radius to half the box height", () => {
    const pill = computeLayout({ ...DEFAULT_INPUT, frame: "fill", cornerRadiusPx: 999 });
    expect(pill.cornerRadiusPx).toBe(200);
  });
});

describe("computeLayout — shrink-to-fit fontSize (D9)", () => {
  it("converges to a size whose required width fits inside the slack margin", () => {
    const layout = computeLayout(DEFAULT_INPUT);
    expect(layout.fontSize).toBeLessThanOrEqual(FONT_START_FRAC * layout.bar.h);
    expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_FONT_PX);
    const iconSize = Math.round(ICON_FRAC * layout.bar.h);
    const iconGap = layout.labelX - (layout.bar.x + layout.padXPx + iconSize);
    const required =
      2 * layout.padXPx + iconSize + iconGap + layout.labelWidthPx + layout.maxWordWidthPx;
    expect(required).toBeLessThanOrEqual(layout.bar.w * (1 - FIT_SLACK));
  });

  it("shrinks further for longer content", () => {
    const short = computeLayout({ ...DEFAULT_INPUT, words: ["Go"] });
    const long = computeLayout({ ...DEFAULT_INPUT, words: ["Recommendations galore"] });
    expect(long.fontSize).toBeLessThanOrEqual(short.fontSize);
  });

  it("throws fail-fast when even the font floor overflows", () => {
    expect(() =>
      computeLayout({
        ...DEFAULT_INPUT,
        canvasW: 400,
        canvasH: 100,
        words: ["WWWWWWWWWWWWWWWWWWWWWWWW"],
      }),
    ).toThrow("font floor");
  });

  it("never emits a font below the floor, even on a canvas-capped squat bar", () => {
    const layout = computeLayout({
      ...DEFAULT_INPUT,
      canvasW: 300,
      canvasH: 40,
      words: ["Go"],
    });
    expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_FONT_PX);
  });

  it("throws fail-fast when the bar is too short for the glyph+underline group", () => {
    expect(() =>
      computeLayout({
        ...DEFAULT_INPUT,
        canvasW: 300,
        canvasH: 20,
        words: ["Go"],
        label: "",
      }),
    ).toThrow("too short");
  });
});

describe("computeLayout — label and word origin", () => {
  it("appends the separator space and starts words right after it", () => {
    const layout = computeLayout(DEFAULT_INPUT);
    expect(layout.labelText).toBe("Search for ");
    expect(layout.labelWidthPx).toBeCloseTo(
      measureText(layout.labelText, { fontSize: layout.fontSize }).width,
      6,
    );
    expect(layout.wordX).toBeCloseTo(layout.labelX + layout.labelWidthPx, 9);
    expect(layout.labelUnderline).toEqual({ x0: layout.labelX, x1: layout.wordX });
  });

  it("hides an empty label without leaving a gap", () => {
    const layout = computeLayout({ ...DEFAULT_INPUT, label: "" });
    expect(layout.labelText).toBe("");
    expect(layout.labelWidthPx).toBe(0);
    expect(layout.wordX).toBe(layout.labelX);
    expect(layout.labelUnderline.x0).toBe(layout.labelUnderline.x1);
  });
});

describe("computeLayout — vertical group", () => {
  const layout = computeLayout(DEFAULT_INPUT);

  it("keeps the glyph block inside the bar", () => {
    expect(layout.baselineY - layout.ascent).toBeGreaterThanOrEqual(layout.bar.y);
    expect(layout.baselineY + layout.descent).toBeLessThanOrEqual(layout.bar.y + layout.bar.h);
  });

  it("places the underline below the descent with the fixed gap", () => {
    expect(layout.underlineY).toBe(
      Math.round(layout.baselineY + layout.descent + UNDERLINE_GAP_PX),
    );
    expect(layout.underlineHeightPx).toBe(UNDERLINE_H_PX);
    expect(layout.underlineY + UNDERLINE_H_PX).toBeLessThanOrEqual(layout.bar.y + layout.bar.h);
  });

  it("bounds the cover band between the bar top and the underline", () => {
    expect(layout.glyphTop).toBeGreaterThanOrEqual(layout.bar.y + 1);
    expect(layout.glyphTop).toBeLessThanOrEqual(Math.floor(layout.baselineY - layout.ascent));
    expect(layout.glyphBottom).toBe(layout.underlineY - 1);
    expect(layout.glyphBottom).toBeGreaterThan(layout.glyphTop);
  });
});

describe("charAdvances", () => {
  it("returns L+1 strictly-increasing cumulative advances from 0", () => {
    for (const word of DEFAULT_INPUT.words) {
      const advances = charAdvances(word, 32);
      expect(advances).toHaveLength(word.length + 1);
      expect(advances[0]).toBe(0);
      for (let i = 1; i < advances.length; i++) {
        expect(advances[i]).toBeGreaterThan(advances[i - 1]);
      }
    }
  });

  it("agrees with measureText about the full word width", () => {
    const advances = charAdvances("Inspiration", 32);
    expect(advances[advances.length - 1]).toBeCloseTo(
      measureText("Inspiration", { fontSize: 32 }).width,
      6,
    );
  });

  it("advances are kern-aware full-word origins (boundary kern included)", () => {
    // Roboto kerns "LT" by several px at hero sizes; the T's origin must sit
    // LEFT of the bare "L" prefix advance, exactly at fullWidth − advance(T).
    const size = 57.76;
    const advances = charAdvances("LT", size);
    expect(advances[1]).toBeLessThan(measureText("L", { fontSize: size }).width);
    expect(advances[1]).toBeCloseTo(
      measureText("LT", { fontSize: size }).width - measureText("T", { fontSize: size }).width,
      6,
    );
  });

  it("is what the layout's per-word entries carry", () => {
    const layout = computeLayout(DEFAULT_INPUT);
    for (const entry of layout.words) {
      expect(entry.advances).toEqual(charAdvances(entry.word, layout.fontSize));
      expect(entry.widthPx).toBe(entry.advances[entry.advances.length - 1]);
      expect(entry.widthPx).toBeLessThanOrEqual(layout.maxWordWidthPx + 1e-6);
    }
  });
});

describe("computeLayout — real-geometry zones", () => {
  const layout = computeLayout(DEFAULT_INPUT);
  const fillLayout = computeLayout({ ...DEFAULT_INPUT, frame: "fill" });

  it("wordZone pads the word band by the font-proportional ink overhangs", () => {
    const lsb = inkLeftPadPx(layout.fontSize);
    const rsb = inkRightPadPx(layout.fontSize);
    expect(layout.wordZone.x).toBe(
      Math.max(layout.bar.x, Math.floor(layout.wordX) - lsb - 1),
    );
    expect(layout.wordZone.y).toBe(layout.glyphTop);
    expect(layout.wordZone.h).toBe(layout.glyphBottom - layout.glyphTop);
    expect(layout.wordZone.x + layout.wordZone.w).toBeGreaterThanOrEqual(
      Math.min(
        layout.bar.x + layout.bar.w,
        Math.ceil(layout.wordX + layout.maxWordWidthPx) + rsb + 2,
      ),
    );
  });

  it("labelZone exists iff the label shows and includes the underline row", () => {
    expect(layout.labelZone).not.toBeNull();
    expect(layout.labelZone!.y).toBe(layout.glyphTop);
    expect(layout.labelZone!.y + layout.labelZone!.h).toBe(
      layout.underlineY + layout.underlineHeightPx,
    );
    const hidden = computeLayout({ ...DEFAULT_INPUT, label: "" });
    expect(hidden.labelZone).toBeNull();
  });

  it("underlineZone rides the wordZone x-range at the 2px underline band", () => {
    expect(layout.underlineZone).toEqual({
      x: layout.wordZone.x,
      y: layout.underlineY,
      w: layout.wordZone.w,
      h: layout.underlineHeightPx,
    });
  });

  it("all zones stay inside the bar in both frame modes", () => {
    for (const l of [layout, fillLayout]) {
      const zones = [l.wordZone, l.underlineZone, ...(l.labelZone ? [l.labelZone] : [])];
      for (const zone of zones) {
        expect(zone.x).toBeGreaterThanOrEqual(l.bar.x);
        expect(zone.y).toBeGreaterThanOrEqual(l.bar.y);
        expect(zone.x + zone.w).toBeLessThanOrEqual(l.bar.x + l.bar.w);
        expect(zone.y + zone.h).toBeLessThanOrEqual(l.bar.y + l.bar.h);
      }
    }
  });
});

describe("computeLayout — determinism", () => {
  it("same input produces an identical layout", () => {
    expect(computeLayout(DEFAULT_INPUT)).toEqual(computeLayout(DEFAULT_INPUT));
  });
});
