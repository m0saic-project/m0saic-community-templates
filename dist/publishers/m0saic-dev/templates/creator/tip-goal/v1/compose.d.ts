/**
 * Document builders — the nested-children architecture:
 *
 *   parent (WxH)   m0: F{labelRect?|barRect}   sources: [base, counter text?, tg_bar ref]
 *   └─ tg_bar (barW x barH): track + sliding fill + gated tip flash
 *
 * The bar child document is the CLIP BOUNDARY for the fill slide (the alpine
 * progress-card "plot child" mechanism): the fill tile spans the whole bar
 * and slides in from the left via `overlay.xExpr`, so whatever hangs past
 * x=0 is cut by the child canvas. The parent's `tg_bar` ref carries the
 * pill/rounded `effects.rounding`, which the engine applies to the rendered
 * child (buildChildMosaicSource merges parent-cell effects) — the whole bar,
 * fill and flash included, keeps the track's silhouette.
 */
import type { MosaicAsset, MosaicDocument } from "@m0saic/types";
import { type M0String } from "@m0saic/dsl";
import type { ResolvedConfig } from "./resolve";
export type BaseMedia = {
    assetId: string;
    asset: MosaicAsset;
    mediaType: "video" | "image";
};
export type TipGoalStats = {
    anchorCount: number;
    tipCount: number;
    flashCount: number;
    fontPx: number;
    /** What the counter rendered as — the layout-contract gate keys off this. */
    counterKind: "expr" | "literal" | "none";
};
export type ComposeOutcome = {
    ok: true;
    doc: MosaicDocument;
    stats: TipGoalStats;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
export declare function buildTipGoalDoc(cfg: ResolvedConfig, W: number, H: number, fps: number, durationMs: number, base: BaseMedia | undefined): ComposeOutcome;
/** `F` nested under `n` overlay layers: 0 → "F", 1 → "F{F}", 2 → "F{F{F}}"… */
export declare function nestOverlays(n: number): M0String;
