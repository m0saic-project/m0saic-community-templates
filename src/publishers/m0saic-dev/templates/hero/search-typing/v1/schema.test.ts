import {
  MAX_LABEL_CHARS,
  MAX_WORDS,
  MAX_WORD_CHARS,
  defaultProps,
  normalizeOpaqueHex,
  parseProps,
  searchTypingPropsSchema,
  type SearchTypingProps,
} from "./schema";

describe("parseProps — defaults", () => {
  it("resolves the deterministic defaults (cardColor canonicalized)", () => {
    const resolved = parseProps(undefined);
    expect(resolved).toEqual({
      ...defaultProps,
      style: { ...defaultProps.style, cardColor: "#ffffff" },
    });
  });

  it("is deterministic and treats explicit defaults identically", () => {
    expect(parseProps(undefined)).toEqual(parseProps(undefined));
    expect(parseProps(defaultProps)).toEqual(parseProps(undefined));
    expect(parseProps({})).toEqual(parseProps(undefined));
  });

  it("deep-merges partial groups over the defaults", () => {
    const resolved = parseProps({
      timing: { typeCharMs: 200 },
      style: { inkColor: "#111111" },
    });
    expect(resolved.timing).toEqual({ ...defaultProps.timing, typeCharMs: 200 });
    expect(resolved.style.inkColor).toBe("#111111");
    expect(resolved.style.pageColor).toBe(defaultProps.style.pageColor);
    expect(resolved.words).toEqual(defaultProps.words);
  });

  it("trims words", () => {
    expect(parseProps({ words: ["  Hi ", "There"] }).words).toEqual(["Hi", "There"]);
  });

  it("trims the label so whitespace-only hides like an empty label", () => {
    expect(parseProps({ label: "   " }).label).toBe("");
    expect(parseProps({ label: " Find " }).label).toBe("Find");
  });

  it("NFC-normalizes words so decomposed accents become one typed char", () => {
    // "e" + combining acute (U+0301) precomposes to é — 6 chars total.
    const resolved = parseProps({ words: ["éclair"] });
    expect(resolved.words).toEqual(["éclair"]);
    expect(resolved.words[0]).toHaveLength(6);
  });
});

describe("parseProps — color knobs", () => {
  it("falls back on cleared / none color values (never blanks a mark)", () => {
    const resolved = parseProps({
      style: { labelColor: "", inkColor: "none", pageColor: "  " },
    });
    expect(resolved.style.labelColor).toBe(defaultProps.style.labelColor);
    expect(resolved.style.inkColor).toBe(defaultProps.style.inkColor);
    expect(resolved.style.pageColor).toBe(defaultProps.style.pageColor);
  });

  it("normalizes cardColor to canonical lowercase #rrggbb", () => {
    expect(parseProps({ style: { cardColor: "#FAFBFC" } }).style.cardColor).toBe("#fafbfc");
    expect(parseProps({ style: { cardColor: "#abc" } }).style.cardColor).toBe("#aabbcc");
    expect(parseProps({ style: { cardColor: "" } }).style.cardColor).toBe("#ffffff");
  });

  it.each([
    ["rgba() alpha", "rgba(255,255,255,0.5)"],
    ["8-digit hex alpha", "#aabbccdd"],
    ["named color", "white"],
  ])("rejects a non-hex cardColor (%s) — the curtain needs one opaque value", (_name, value) => {
    expect(() => parseProps({ style: { cardColor: value } })).toThrow("style.cardColor");
  });

  it("normalizeOpaqueHex names the offending prop path", () => {
    expect(() => normalizeOpaqueHex("teal", "style.cardColor")).toThrow(
      'style.cardColor must be opaque plain hex',
    );
    expect(normalizeOpaqueHex(" #0Af ", "style.cardColor")).toBe("#00aaff");
  });
});

describe("parseProps — fail-fast validation", () => {
  const cases: Array<[string, SearchTypingProps, string]> = [
    ["empty words", { words: [] }, "non-empty"],
    [
      "too many words",
      { words: Array.from({ length: MAX_WORDS + 1 }, (_, i) => `w${i}`) },
      `at most ${MAX_WORDS}`,
    ],
    [
      "over-long word",
      { words: ["x".repeat(MAX_WORD_CHARS + 1)] },
      `at most ${MAX_WORD_CHARS}`,
    ],
    ["blank word", { words: ["   "] }, "empty after trimming"],
    ["multi-line word", { words: ["a\nb"] }, "single-line"],
    ["emoji word", { words: ["\u{1F525}hot"] }, "must not contain emoji"],
    ["residual combining mark", { words: ["x\u0300y"] }, "must not contain emoji"],
    ["zero-width char in word", { words: ["a\u200bb"] }, "must not contain emoji"],
    ["over-long label", { label: "x".repeat(MAX_LABEL_CHARS + 1) }, `at most ${MAX_LABEL_CHARS}`],
    ["emoji label", { label: "\u{1F50D} find" }, "must not contain emoji"],
    ["non-string word", { words: [42 as unknown as string] }, "must be a string"],
    ["multi-line label", { label: "a\nb" }, "single-line"],
    ["non-string label", { label: 7 as unknown as string }, "single-line"],
    ["zero timing knob", { timing: { typeCharMs: 0 } }, "timing.typeCharMs"],
    ["negative timing knob", { timing: { wordHoldMs: -5 } }, "timing.wordHoldMs"],
    ["non-number timing knob", { timing: { emptyHoldMs: "fast" as unknown as number } }, "timing.emptyHoldMs"],
    ["bad frame", { frame: "floating" as unknown as "fill" }, "frame must be fill or card"],
    ["bad endBehavior", { endBehavior: "bounce" as unknown as "hold" }, "endBehavior"],
    ["bad underline", { underline: "wavy" as unknown as "grow" }, "underline"],
    ["non-boolean caret.show", { caret: { show: "yes" as unknown as boolean } }, "caret.show"],
    ["zero caret.blinkMs", { caret: { blinkMs: 0 } }, "caret.blinkMs"],
    ["zero caret.widthPx", { caret: { widthPx: 0 } }, "caret.widthPx"],
    ["non-boolean icon.show", { icon: { show: 1 as unknown as boolean } }, "icon.show"],
    ["negative corner radius", { style: { cornerRadiusPx: -1 } }, "style.cornerRadiusPx"],
    ["zero barWidthFrac", { style: { barWidthFrac: 0 } }, "style.barWidthFrac"],
    ["overshooting barWidthFrac", { style: { barWidthFrac: 1.5 } }, "style.barWidthFrac"],
    ["zero barAspect", { style: { barAspect: 0 } }, "style.barAspect"],
  ];

  it.each(cases)("throws on %s", (_name, props, message) => {
    expect(() => parseProps(props)).toThrow(message);
  });
});

describe("props schema shape", () => {
  it("covers exactly the public prop keys", () => {
    expect(Object.keys(searchTypingPropsSchema).sort()).toEqual(
      Object.keys(defaultProps).sort(),
    );
  });

  it("group fields mirror the nested default keys", () => {
    for (const key of ["timing", "caret", "icon", "style"] as const) {
      const definition = searchTypingPropsSchema[key];
      expect(definition.type).toBe("group");
      expect(Object.keys(definition.fields ?? {}).sort()).toEqual(
        Object.keys(defaultProps[key]).sort(),
      );
    }
  });
});
