import { type DealRow } from "./deals";
import { type Notes } from "./walkthrough";
/**
 * `@m0saic-dev/sales/pipeline-review/v1` — a quarter's Salesforce
 * opportunities as a leadership dashboard video, with an optional guided
 * walkthrough.
 *
 * ONE CONCEPT: the data is the prop. `deals` holds the export (rows, or the
 * CSV text pasted as-is) and every number on screen is DERIVED from it in
 * deals.ts — won, win rate, what slipped, what is still open, by month, by
 * region, who carried the quarter. Next quarter is a new paste, not a new
 * template.
 *
 * The dashboard: a header, four KPI tiles, three panels (won by month, won
 * by region, the deals that slipped past their close month) and three
 * one-line callouts, each a pixel rect placed with placeInsetPieces. It
 * builds itself with staggered fades over the first ~6 seconds.
 *
 * The walkthrough: give any headline a note (`notes.<headline>`) and the
 * video stops on it — a camera (`effects.camera` over the dashboard as a
 * child mosaic) eases in, the note shows on a card below, and it moves on.
 * Stops run in reading order; the clip length follows the notes
 * (resolveOutputHints). The child renders at MAX_ZOOM x the canvas so a
 * zoomed crop is never an upscale. No notes = the plain dashboard, no child.
 *
 * The rule that bites: "slipped" means OPEN with a close month at or before
 * the quarter's last month. The quarter comes from `quarterStart`, never
 * from the clock — the same export always renders the same video.
 */
export type PipelineReviewProps = {
    /** Headline. */
    title?: string;
    /** Line under the headline; empty = the quarter span and deal count. */
    subtitle?: string;
    /** First month of the quarter, YYYY-MM. */
    quarterStart?: string;
    /** Quarterly bookings target in dollars; 0 = none. */
    target?: number;
    /** The opportunity export: rows, or the raw CSV text. */
    deals?: DealRow[] | string;
    /** One note per headline; each set note is a camera stop. */
    notes?: Notes;
    /** Bar colour (#rrggbb). */
    accent?: string;
    /** Backdrop (#rrggbb). */
    pageColor?: string;
    /** Build the dashboard and walk the notes; off = a still of the finished board. */
    animate?: boolean;
};
export declare const PipelineReviewV1: import("@m0saic/types").MosaicTemplate<PipelineReviewProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default PipelineReviewV1;
