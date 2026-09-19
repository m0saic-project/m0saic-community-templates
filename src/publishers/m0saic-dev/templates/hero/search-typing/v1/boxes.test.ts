import { GATED_BOX_BUDGET } from "@m0saic/template-utils";

import { computeLayout, type SearchBarLayout } from "./layout";
import { buildTypingTimeline, type TypingTimeline } from "./timeline";
import { inkLeftPadPx, inkRightPadPx } from "./layout";
import {
  CARET_BOX_BUDGET,
  buildCaretBoxes,
  buildCoverBoxes,
  buildUnderlineBoxes,
  charSpans,
} from "./boxes";

const WORDS = ["Ideas", "Answers", "Templates", "Tutorials", "Inspiration"];
const TIMING = {
  typeCharMs: 120,
  deleteCharMs: 90,
  emptyHoldMs: 850,
  wordHoldMs: 1100,
  leadMs: 400,
  trailMs: 400,
};

const layout: SearchBarLayout = computeLayout({
  canvasW: 1280,
  canvasH: 400,
  words: WORDS,
  label: "Search for",
  frame: "card",
  showIcon: true,
  barWidthFrac: 0.62,
  barAspect: 0.26,
  cornerRadiusPx: 16,
});
const holdTimeline: TypingTimeline = buildTypingTimeline(WORDS, TIMING, "hold");
const loopTimeline: TypingTimeline = buildTypingTimeline(WORDS, TIMING, "loop");

describe("charSpans", () => {
  it("pads each span by the font-proportional ink overhangs", () => {
    const spans = charSpans(layout, 0);
    const { advances } = layout.words[0];
    const lsb = inkLeftPadPx(layout.fontSize);
    const rsb = inkRightPadPx(layout.fontSize);
    expect(spans).toHaveLength(advances.length - 1);
    spans.forEach((span, i) => {
      expect(span.x0).toBe(Math.floor(layout.wordX + advances[i] - lsb));
      const bleed = i === spans.length - 1 ? rsb : 0;
      expect(span.x1).toBe(Math.ceil(layout.wordX + advances[i + 1] + 1 + bleed));
      if (i > 0) {
        // Adjacent spans overlap so kerning/AA fringes can't peek through.
        expect(span.x0).toBeLessThan(spans[i - 1].x1);
      }
    });
  });

  it("stays inside the card", () => {
    for (let k = 0; k < WORDS.length; k++) {
      for (const span of charSpans(layout, k)) {
        expect(span.x0).toBeGreaterThanOrEqual(layout.bar.x);
        expect(span.x1).toBeLessThanOrEqual(layout.bar.x + layout.bar.w);
      }
    }
  });

  it("every span is contained by the word zone (the placed cell)", () => {
    for (let k = 0; k < WORDS.length; k++) {
      for (const span of charSpans(layout, k)) {
        expect(span.x0).toBeGreaterThanOrEqual(layout.wordZone.x);
        expect(span.x1).toBeLessThanOrEqual(layout.wordZone.x + layout.wordZone.w);
      }
    }
  });
});

describe("buildCoverBoxes", () => {
  const boxes = buildCoverBoxes(holdTimeline, layout);

  it("emits 2 boxes per deleting char, 1 per held char, none zero-duration", () => {
    // 41 chars total; the held last word's 11 chars get no delete box, and
    // each deleting word's char 0 delete box (deleteAt == band end) is
    // skipped as zero-duration: 82 − 11 − 4 = 67.
    expect(boxes).toHaveLength(67);
    const loopBoxes = buildCoverBoxes(loopTimeline, layout);
    expect(loopBoxes).toHaveLength(2 * 41 - 5);
    expect(loopBoxes.length).toBeLessThanOrEqual(GATED_BOX_BUDGET);
    for (const box of [...boxes, ...loopBoxes]) {
      if (box.fromSec != null && box.toSec != null) {
        expect(box.toSec).toBeGreaterThan(box.fromSec);
      }
    }
  });

  it("word 0 typed-covers are pure lt-gates (ON at frame 0)", () => {
    const band0 = holdTimeline.bands[0];
    const band0Typed = boxes.filter(
      (box) => box.fromSec === undefined && box.toSec != null && box.toSec <= band0.typedAtSec + 1e-9,
    );
    expect(band0Typed).toHaveLength(band0.chars.length);
    band0Typed.forEach((box, i) => {
      expect(box.toSec).toBeCloseTo(band0.chars[i].typeAtSec, 9);
    });
  });

  it("later words' typed-covers are between(bandStart, typeAt) — they never cover an earlier word", () => {
    for (let k = 1; k < holdTimeline.bands.length; k++) {
      const band = holdTimeline.bands[k];
      const typed = boxes.filter(
        (box) => box.fromSec === band.startSec,
      );
      expect(typed).toHaveLength(band.chars.length);
      for (const box of typed) {
        expect(box.fromSec).toBeGreaterThan(0);
        expect(box.toSec).toBeGreaterThan(box.fromSec as number);
      }
    }
  });

  it("deleted-covers run from deleteAt to the band end (char 0's skipped)", () => {
    const band = holdTimeline.bands[1];
    const deleted = boxes.filter(
      (box) => box.toSec === band.endSec && box.fromSec != null && box.fromSec >= (band.deleteStartSec ?? 0),
    );
    expect(deleted).toHaveLength(band.chars.length - 1);
    deleted.forEach((box) => {
      expect(box.fromSec).toBeGreaterThanOrEqual(band.deleteStartSec as number);
      expect(box.toSec).toBeGreaterThan(box.fromSec as number);
    });
  });

  it("covers span exactly the glyph band — never the underline or corners", () => {
    for (const box of boxes) {
      expect(box.y).toBe(layout.glyphTop);
      expect(box.y + box.h).toBe(layout.glyphBottom);
      expect(box.y + box.h).toBeLessThan(layout.underlineY);
    }
  });

  it("every cover box is contained by the word zone (the placed cell)", () => {
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(layout.wordZone.x);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.wordZone.x + layout.wordZone.w);
      expect(box.y).toBeGreaterThanOrEqual(layout.wordZone.y);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.wordZone.y + layout.wordZone.h);
    }
  });
});

describe("buildUnderlineBoxes", () => {
  const boxes = buildUnderlineBoxes(holdTimeline, layout);

  it("emits one exact-px 2px segment per char, on while the char is visible", () => {
    expect(boxes).toHaveLength(41);
    boxes.forEach((box) => {
      expect(box.y).toBe(layout.underlineY);
      expect(box.h).toBe(layout.underlineHeightPx);
      expect(box.fromSec).toBeGreaterThan(0);
      expect(box.toSec).toBeGreaterThan(box.fromSec as number);
    });
  });

  it("held-word segments run to the clip end", () => {
    const held = holdTimeline.bands[holdTimeline.bands.length - 1];
    const heldBoxes = boxes.slice(-held.chars.length);
    heldBoxes.forEach((box, i) => {
      expect(box.fromSec).toBeCloseTo(held.chars[i].typeAtSec, 9);
      expect(box.toSec).toBe(holdTimeline.durationSec);
    });
  });

  it("every underline box is contained by the underline zone (the placed cell)", () => {
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(layout.underlineZone.x);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.underlineZone.x + layout.underlineZone.w);
      expect(box.y).toBe(layout.underlineZone.y);
      expect(box.h).toBe(layout.underlineZone.h);
    }
  });
});

describe("buildCaretBoxes", () => {
  const caret = { blinkMs: 1000, widthPx: 2 };
  const boxes = buildCaretBoxes(holdTimeline, layout, caret);

  it("stays inside the glyph band at the caret width", () => {
    for (const box of boxes) {
      expect(box.w).toBe(2);
      expect(box.y).toBe(layout.glyphTop);
      expect(box.h).toBe(layout.glyphBottom - layout.glyphTop);
      expect(box.x).toBeGreaterThanOrEqual(Math.floor(layout.wordX));
      expect(box.x).toBeLessThanOrEqual(layout.bar.x + layout.bar.w);
    }
  });

  it("typing carets tile the keystroke windows contiguously", () => {
    const band = holdTimeline.bands[0];
    const typing = boxes.filter(
      (box) =>
        box.fromSec != null &&
        box.fromSec >= band.typeStartSec - 1e-9 &&
        box.toSec != null &&
        box.toSec <= band.typedAtSec + 1e-9,
    );
    // First-keystroke box + one per char transition, each closing 1ms early
    // so doubly-inclusive between() can't paint two carets on a shared
    // boundary frame.
    expect(typing.length).toBe(band.chars.length);
    for (let i = 1; i < typing.length; i++) {
      expect(typing[i].fromSec).toBeCloseTo((typing[i - 1].toSec as number) + 0.001, 9);
    }
  });

  it("blinks during holds and stays under its budget", () => {
    expect(boxes.length).toBeLessThanOrEqual(CARET_BOX_BUDGET);
    expect(boxes.length).toBeLessThanOrEqual(GATED_BOX_BUDGET);
    // At least one blink slot inside the first empty hold.
    const band = holdTimeline.bands[0];
    const blink = boxes.filter(
      (box) => box.fromSec != null && box.fromSec >= band.startSec && (box.toSec ?? 0) <= band.typeStartSec,
    );
    expect(blink.length).toBeGreaterThan(0);
  });

  it("coarsens blink instead of overflowing on very long pinned renders", () => {
    const long = buildTypingTimeline(WORDS, TIMING, "hold", { pinnedDurationMs: 1_200_000 });
    const longBoxes = buildCaretBoxes(long, layout, caret);
    expect(longBoxes.length).toBeLessThanOrEqual(GATED_BOX_BUDGET);
  });

  it("is deterministic", () => {
    expect(buildCaretBoxes(holdTimeline, layout, caret)).toEqual(boxes);
  });
});

describe("track budgets at the schema caps (8 words × 24 chars, loop)", () => {
  const capWords = Array.from({ length: 8 }, (_, i) => "W".repeat(23) + "abcdefgh"[i]);
  const capLayout = computeLayout({
    canvasW: 1920,
    canvasH: 600,
    words: capWords,
    label: "",
    frame: "card",
    showIcon: true,
    barWidthFrac: 0.75,
    barAspect: 0.26,
    cornerRadiusPx: 16,
  });

  it("cover and underline tracks stay under the 500-box wall", () => {
    const t = buildTypingTimeline(capWords, TIMING, "loop");
    // 192 chars × 2 boxes, minus each word's zero-duration char-0 delete box.
    expect(buildCoverBoxes(t, capLayout)).toHaveLength(2 * 192 - 8);
    expect(buildUnderlineBoxes(t, capLayout)).toHaveLength(192);
  });

  it.each([
    [0, 60],
    [0, 1000],
    [60_000, 60],
    [1_200_000, 1000],
    [3_600_000, 60],
    [3_600_000, 1000],
  ])("caret coarsening converges under the wall (pin %dms, blink %dms)", (pin, blinkMs) => {
    const t = buildTypingTimeline(
      capWords,
      TIMING,
      "loop",
      pin > 0 ? { pinnedDurationMs: pin } : {},
    );
    const caretBoxes = buildCaretBoxes(t, capLayout, { blinkMs, widthPx: 2 });
    expect(caretBoxes.length).toBeLessThanOrEqual(GATED_BOX_BUDGET);
  });
});
