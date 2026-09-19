"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schema_1 = require("./schema");
describe("parseProps — defaults", () => {
    it("resolves the deterministic defaults (cardColor canonicalized)", () => {
        const resolved = (0, schema_1.parseProps)(undefined);
        expect(resolved).toEqual({
            ...schema_1.defaultProps,
            style: { ...schema_1.defaultProps.style, cardColor: "#ffffff" },
        });
    });
    it("is deterministic and treats explicit defaults identically", () => {
        expect((0, schema_1.parseProps)(undefined)).toEqual((0, schema_1.parseProps)(undefined));
        expect((0, schema_1.parseProps)(schema_1.defaultProps)).toEqual((0, schema_1.parseProps)(undefined));
        expect((0, schema_1.parseProps)({})).toEqual((0, schema_1.parseProps)(undefined));
    });
    it("deep-merges partial groups over the defaults", () => {
        const resolved = (0, schema_1.parseProps)({
            timing: { typeCharMs: 200 },
            style: { inkColor: "#111111" },
        });
        expect(resolved.timing).toEqual({ ...schema_1.defaultProps.timing, typeCharMs: 200 });
        expect(resolved.style.inkColor).toBe("#111111");
        expect(resolved.style.pageColor).toBe(schema_1.defaultProps.style.pageColor);
        expect(resolved.words).toEqual(schema_1.defaultProps.words);
    });
    it("trims words", () => {
        expect((0, schema_1.parseProps)({ words: ["  Hi ", "There"] }).words).toEqual(["Hi", "There"]);
    });
    it("trims the label so whitespace-only hides like an empty label", () => {
        expect((0, schema_1.parseProps)({ label: "   " }).label).toBe("");
        expect((0, schema_1.parseProps)({ label: " Find " }).label).toBe("Find");
    });
    it("NFC-normalizes words so decomposed accents become one typed char", () => {
        // "e" + combining acute (U+0301) precomposes to é — 6 chars total.
        const resolved = (0, schema_1.parseProps)({ words: ["éclair"] });
        expect(resolved.words).toEqual(["éclair"]);
        expect(resolved.words[0]).toHaveLength(6);
    });
});
describe("parseProps — color knobs", () => {
    it("falls back on cleared / none color values (never blanks a mark)", () => {
        const resolved = (0, schema_1.parseProps)({
            style: { labelColor: "", inkColor: "none", pageColor: "  " },
        });
        expect(resolved.style.labelColor).toBe(schema_1.defaultProps.style.labelColor);
        expect(resolved.style.inkColor).toBe(schema_1.defaultProps.style.inkColor);
        expect(resolved.style.pageColor).toBe(schema_1.defaultProps.style.pageColor);
    });
    it("normalizes cardColor to canonical lowercase #rrggbb", () => {
        expect((0, schema_1.parseProps)({ style: { cardColor: "#FAFBFC" } }).style.cardColor).toBe("#fafbfc");
        expect((0, schema_1.parseProps)({ style: { cardColor: "#abc" } }).style.cardColor).toBe("#aabbcc");
        expect((0, schema_1.parseProps)({ style: { cardColor: "" } }).style.cardColor).toBe("#ffffff");
    });
    it.each([
        ["rgba() alpha", "rgba(255,255,255,0.5)"],
        ["8-digit hex alpha", "#aabbccdd"],
        ["named color", "white"],
    ])("rejects a non-hex cardColor (%s) — the curtain needs one opaque value", (_name, value) => {
        expect(() => (0, schema_1.parseProps)({ style: { cardColor: value } })).toThrow("style.cardColor");
    });
    it("normalizeOpaqueHex names the offending prop path", () => {
        expect(() => (0, schema_1.normalizeOpaqueHex)("teal", "style.cardColor")).toThrow('style.cardColor must be opaque plain hex');
        expect((0, schema_1.normalizeOpaqueHex)(" #0Af ", "style.cardColor")).toBe("#00aaff");
    });
});
describe("parseProps — fail-fast validation", () => {
    const cases = [
        ["empty words", { words: [] }, "non-empty"],
        [
            "too many words",
            { words: Array.from({ length: schema_1.MAX_WORDS + 1 }, (_, i) => `w${i}`) },
            `at most ${schema_1.MAX_WORDS}`,
        ],
        [
            "over-long word",
            { words: ["x".repeat(schema_1.MAX_WORD_CHARS + 1)] },
            `at most ${schema_1.MAX_WORD_CHARS}`,
        ],
        ["blank word", { words: ["   "] }, "empty after trimming"],
        ["multi-line word", { words: ["a\nb"] }, "single-line"],
        ["emoji word", { words: ["\u{1F525}hot"] }, "must not contain emoji"],
        ["residual combining mark", { words: ["x\u0300y"] }, "must not contain emoji"],
        ["zero-width char in word", { words: ["a\u200bb"] }, "must not contain emoji"],
        ["over-long label", { label: "x".repeat(schema_1.MAX_LABEL_CHARS + 1) }, `at most ${schema_1.MAX_LABEL_CHARS}`],
        ["emoji label", { label: "\u{1F50D} find" }, "must not contain emoji"],
        ["non-string word", { words: [42] }, "must be a string"],
        ["multi-line label", { label: "a\nb" }, "single-line"],
        ["non-string label", { label: 7 }, "single-line"],
        ["zero timing knob", { timing: { typeCharMs: 0 } }, "timing.typeCharMs"],
        ["negative timing knob", { timing: { wordHoldMs: -5 } }, "timing.wordHoldMs"],
        ["non-number timing knob", { timing: { emptyHoldMs: "fast" } }, "timing.emptyHoldMs"],
        ["bad frame", { frame: "floating" }, "frame must be fill or card"],
        ["bad endBehavior", { endBehavior: "bounce" }, "endBehavior"],
        ["bad underline", { underline: "wavy" }, "underline"],
        ["non-boolean caret.show", { caret: { show: "yes" } }, "caret.show"],
        ["zero caret.blinkMs", { caret: { blinkMs: 0 } }, "caret.blinkMs"],
        ["zero caret.widthPx", { caret: { widthPx: 0 } }, "caret.widthPx"],
        ["non-boolean icon.show", { icon: { show: 1 } }, "icon.show"],
        ["negative corner radius", { style: { cornerRadiusPx: -1 } }, "style.cornerRadiusPx"],
        ["zero barWidthFrac", { style: { barWidthFrac: 0 } }, "style.barWidthFrac"],
        ["overshooting barWidthFrac", { style: { barWidthFrac: 1.5 } }, "style.barWidthFrac"],
        ["zero barAspect", { style: { barAspect: 0 } }, "style.barAspect"],
    ];
    it.each(cases)("throws on %s", (_name, props, message) => {
        expect(() => (0, schema_1.parseProps)(props)).toThrow(message);
    });
});
describe("props schema shape", () => {
    it("covers exactly the public prop keys", () => {
        expect(Object.keys(schema_1.searchTypingPropsSchema).sort()).toEqual(Object.keys(schema_1.defaultProps).sort());
    });
    it("group fields mirror the nested default keys", () => {
        for (const key of ["timing", "caret", "icon", "style"]) {
            const definition = schema_1.searchTypingPropsSchema[key];
            expect(definition.type).toBe("group");
            expect(Object.keys(definition.fields ?? {}).sort()).toEqual(Object.keys(schema_1.defaultProps[key]).sort());
        }
    });
});
