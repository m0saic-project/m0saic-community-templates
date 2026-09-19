import { prepareCues, sanitizeCueText } from "./cues";

const SDH = { stripSdh: true };
const NO_SDH = { stripSdh: false };

describe("sanitizeCueText", () => {
  it("strips HTML tags from ffmpeg's ASS→SRT transcode", () => {
    expect(sanitizeCueText('<font face="Roboto" size="26">Hola.</font>', NO_SDH)).toBe("Hola.");
    expect(sanitizeCueText("<i>It is there...</i>", NO_SDH)).toBe("It is there...");
  });

  it("strips residual ASS override tags", () => {
    expect(sanitizeCueText("{\\an8}STATION: RHODES", NO_SDH)).toBe("STATION: RHODES");
  });

  it("strips non-printing characters drawtext would render as tofu", () => {
    expect(sanitizeCueText("subastas\r\ny furgonetas", NO_SDH)).toBe("subastas\ny furgonetas");
    expect(sanitizeCueText("Ciudades.\rAsí son", NO_SDH)).toBe("Ciudades.Así son");
    expect(sanitizeCueText("a\u200Bb\uFEFFc", NO_SDH)).toBe("abc");
    expect(sanitizeCueText("one\u2028two", NO_SDH)).toBe("one\ntwo");
  });

  it("converts legacy SubRip pipe separators to line breaks", () => {
    expect(sanitizeCueText("A tu derecha...|adivina qué...", NO_SDH)).toBe(
      "A tu derecha...\nadivina qué...",
    );
  });

  it("strips SDH artifacts when asked", () => {
    expect(sanitizeCueText("[música dramática]", SDH)).toBe("");
    expect(sanitizeCueText("TOKIO: Bueno.", SDH)).toBe("Bueno.");
    expect(sanitizeCueText("♪ la la la ♪", SDH)).toBe("");
    expect(sanitizeCueText("[gunshot] Run!", SDH)).toBe("Run!");
  });

  it("keeps SDH artifacts when not asked", () => {
    expect(sanitizeCueText("[música dramática]", NO_SDH)).toBe("[música dramática]");
  });
});

describe("prepareCues", () => {
  const cues = [
    { startMs: 1000, endMs: 3000, text: "one" },
    { startMs: 5000, endMs: 8000, text: "<i>two</i>" },
    { startMs: 20000, endMs: 22000, text: "outside" },
  ];

  it("windows, offsets, and remaps to output-relative time", () => {
    const out = prepareCues(cues, { winStartMs: 4000, winEndMs: 10000, offsetMs: 0, sanitize: NO_SDH });
    expect(out).toEqual([{ startMs: 1000, endMs: 4000, text: "two" }]);
  });

  it("applies external-file offset before windowing", () => {
    const out = prepareCues(cues, { winStartMs: 0, winEndMs: 4000, offsetMs: 500, sanitize: NO_SDH });
    expect(out[0]).toEqual({ startMs: 1500, endMs: 3500, text: "one" });
  });

  it("drops cues that sanitize to empty", () => {
    const out = prepareCues([{ startMs: 0, endMs: 1000, text: "[thunder]" }], {
      winStartMs: 0,
      winEndMs: 2000,
      offsetMs: 0,
      sanitize: SDH,
    });
    expect(out).toEqual([]);
  });
});
