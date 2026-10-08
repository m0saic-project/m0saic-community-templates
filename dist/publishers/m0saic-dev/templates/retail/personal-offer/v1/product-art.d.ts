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
export declare const ART_KINDS: readonly ["perfume", "lipstick", "cream", "serum"];
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
export declare const ART_VIEWBOX: {
    readonly width: 400;
    readonly height: 480;
};
/** One product as SVG text, in the template's colours. */
export declare function productArtSvg(kind: ArtKind, tone: ArtTone): string;
/**
 * The SVG as the data URI the engine rasterizes. URL-encoded, not base64:
 * no `Buffer`, so the same code runs in a browser, and a bare
 * `data:image/svg+xml,` is the form both the DOM and the rasterizer read.
 */
export declare function productArtDataUri(kind: ArtKind, tone: ArtTone): string;
