/**
 * `@m0saic-dev/integrations/chipset/v1` — your product as the chip
 * on a circuit board, wired to every partner. A glowing packet leaves the chip
 * down each trace in turn; the trace powers up behind it and the partner's
 * pill lights when it lands. Ends with everything connected.
 *
 * ONE CONCEPT: the list IS the layout. Add a partner, remove one, rename one
 * — the pills re-flow (one or two rows under the chip on a wide canvas, two
 * columns on a phone), every trace re-routes as a non-crossing bus, and the
 * pulse schedule re-spaces to fit the clip. Clearing a pill's text in Make
 * removes that partner.
 *
 * The rule that bites: overlay depth. Each lit trace overlaps its bus
 * neighbours, so they live in ONE nested child (`wiring`) — at the root they
 * would stack past the depth where the engine starts dropping masks.
 */
export type ChipsetProps = {
    /** The chip's label: your product. */
    hub?: string;
    /** The chip's mark: "m0saic" (the M), "none", or an SVG path `d` in a 24×24 box. */
    hubIcon?: string;
    /** The partners, one pill each (1–16). */
    partners?: string[];
    /** Glow colour (#rrggbb): packets, lit traces, lit pills, the chip's edge. */
    accent?: string;
    /** Seed for the board decoration and the order the partners light up in. */
    seed?: number;
};
export declare const ChipsetV1: import("@m0saic/types").MosaicTemplate<ChipsetProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default ChipsetV1;
