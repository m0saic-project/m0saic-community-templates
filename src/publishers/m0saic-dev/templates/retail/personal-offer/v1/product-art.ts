/**
 * The generic product art this template SHIPS - four flat, brand-less
 * illustrations as inline SVG text. No file on disk, no image decoder in
 * the loop: the markup goes into the document as a `data:image/svg+xml,`
 * asset and m0saic rasterizes it itself before ffmpeg sees a pixel, so the
 * same string draws the same product in the app preview, the CLI and the
 * web - and a designer can replace any of them with real SVG.
 *
 * Every piece is authored on one portrait viewBox ({@link ART_VIEWBOX}) and
 * takes its colours from the template: `accent` is the brand colour, `deep`
 * and `pale` are its shades, `ink` draws the label lines. Change the accent
 * and the bottle recolours with the rest of the clip.
 *
 * Why these four: a fragrance, a lipstick, a cream and a serum cover what
 * a beauty retailer's "we picked this for you" row would point at, and a
 * `productImage` prop swaps any of them for a real product shot.
 */

export const ART_KINDS = ["perfume", "lipstick", "cream", "serum"] as const;
export type ArtKind = (typeof ART_KINDS)[number];

export type ArtTone = {
  /** The brand colour (#rrggbb). */
  accent: string;
  /** A darker shade of the accent - caps, lids, the lipstick tube. */
  deep: string;
  /** A pale tint of the accent - collars, labels, the jar. */
  pale: string;
  /** The text colour - the hairlines that stand in for label copy. */
  ink: string;
};

/** The design space every piece is drawn in (a portrait product shot). */
export const ART_VIEWBOX = { width: 400, height: 480 } as const;

const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART_VIEWBOX.width} ${ART_VIEWBOX.height}" width="${ART_VIEWBOX.width}" height="${ART_VIEWBOX.height}">`;
const close = `</svg>`;

/** The soft shadow every product stands on. */
const shadow = (ink: string) => `<ellipse cx="200" cy="458" rx="128" ry="13" fill="${ink}" opacity="0.14"/>`;

/** Two or three hairlines where a label's copy would sit. */
const labelLines = (x: number, y: number, w: number, ink: string, n = 3) =>
  Array.from({ length: n }, (_, i) => {
    const lw = i === 0 ? w : Math.round(w * (i === 1 ? 0.72 : 0.5));
    const lx = x + Math.round((w - lw) / 2);
    return `<rect x="${lx}" y="${y + i * 16}" width="${lw}" height="${i === 0 ? 6 : 4}" rx="2" fill="${ink}" opacity="${i === 0 ? 0.55 : 0.32}"/>`;
  }).join("");

function perfumeSvg(t: ArtTone): string {
  return (
    open +
    shadow(t.ink) +
    // cap
    `<rect x="160" y="18" width="80" height="74" rx="14" fill="${t.deep}"/>` +
    `<rect x="172" y="28" width="14" height="54" rx="7" fill="#ffffff" opacity="0.28"/>` +
    // collar
    `<rect x="170" y="90" width="60" height="30" rx="6" fill="${t.pale}"/>` +
    // glass body
    `<rect x="70" y="118" width="260" height="330" rx="38" fill="#ffffff" opacity="0.22"/>` +
    `<rect x="72" y="120" width="256" height="326" rx="36" fill="none" stroke="${t.pale}" stroke-width="4"/>` +
    // the juice
    `<rect x="86" y="236" width="228" height="198" rx="30" fill="${t.accent}" opacity="0.9"/>` +
    // label
    `<rect x="128" y="286" width="144" height="96" rx="10" fill="${t.pale}"/>` +
    labelLines(150, 318, 100, t.ink) +
    // highlight
    `<rect x="96" y="142" width="22" height="276" rx="11" fill="#ffffff" opacity="0.38"/>` +
    close
  );
}

function lipstickSvg(t: ArtTone): string {
  return (
    open +
    shadow(t.ink) +
    // tube
    `<rect x="148" y="236" width="104" height="214" rx="16" fill="${t.deep}"/>` +
    `<rect x="148" y="236" width="104" height="30" rx="8" fill="${t.pale}"/>` +
    `<rect x="160" y="272" width="12" height="160" rx="6" fill="#ffffff" opacity="0.22"/>` +
    // holder
    `<rect x="166" y="176" width="68" height="64" rx="6" fill="${t.pale}"/>` +
    // bullet with its angled tip
    `<path d="M172 182 L172 86 Q172 70 190 64 L228 86 L228 182 Z" fill="${t.accent}"/>` +
    `<rect x="180" y="92" width="10" height="80" rx="5" fill="#ffffff" opacity="0.38"/>` +
    close
  );
}

function creamSvg(t: ArtTone): string {
  return (
    open +
    shadow(t.ink) +
    // lid
    `<rect x="66" y="112" width="268" height="84" rx="22" fill="${t.deep}"/>` +
    `<rect x="92" y="126" width="216" height="12" rx="6" fill="#ffffff" opacity="0.3"/>` +
    // jar
    `<rect x="78" y="194" width="244" height="240" rx="34" fill="${t.pale}"/>` +
    `<rect x="78" y="194" width="244" height="20" fill="${t.accent}" opacity="0.5"/>` +
    // label
    `<rect x="116" y="262" width="168" height="100" rx="12" fill="#ffffff" opacity="0.92"/>` +
    labelLines(142, 294, 116, t.ink) +
    // highlight
    `<rect x="96" y="226" width="20" height="180" rx="10" fill="#ffffff" opacity="0.42"/>` +
    close
  );
}

function serumSvg(t: ArtTone): string {
  return (
    open +
    shadow(t.ink) +
    // bulb and collar
    `<ellipse cx="200" cy="108" rx="44" ry="50" fill="${t.deep}"/>` +
    `<rect x="168" y="148" width="64" height="46" rx="8" fill="${t.pale}"/>` +
    // bottle
    `<rect x="118" y="188" width="164" height="254" rx="32" fill="${t.accent}" opacity="0.92"/>` +
    // pipette, seen through the glass
    `<rect x="193" y="194" width="14" height="172" rx="7" fill="#ffffff" opacity="0.4"/>` +
    // label
    `<rect x="144" y="292" width="112" height="76" rx="9" fill="${t.pale}"/>` +
    labelLines(160, 316, 80, t.ink) +
    // highlight
    `<rect x="136" y="212" width="18" height="190" rx="9" fill="#ffffff" opacity="0.32"/>` +
    close
  );
}

/** One product as SVG text, in the template's colours. */
export function productArtSvg(kind: ArtKind, tone: ArtTone): string {
  switch (kind) {
    case "perfume":
      return perfumeSvg(tone);
    case "lipstick":
      return lipstickSvg(tone);
    case "cream":
      return creamSvg(tone);
    case "serum":
      return serumSvg(tone);
  }
}

/**
 * The SVG as the data URI the engine rasterizes. URL-encoded, not base64:
 * no `Buffer`, so the same code runs in a browser, and a bare
 * `data:image/svg+xml,` is the form both the DOM and the rasterizer read.
 */
export function productArtDataUri(kind: ArtKind, tone: ArtTone): string {
  return `data:image/svg+xml,${encodeURIComponent(productArtSvg(kind, tone))}`;
}
