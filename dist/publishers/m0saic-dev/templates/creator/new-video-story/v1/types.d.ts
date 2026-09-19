import type { MosaicRegion, MosaicRegionsValue, MosaicTemplatePropDefinition } from "@m0saic/types";
/**
 * New Video Story props — the "NEW VIDEO" Instagram story a creator posts
 * when something drops. Pick what you're announcing (the platform preset
 * fills the sticker headline, the boxed call-to-action, the link-pill text,
 * the badge and the accent), drop in your media — an image or a video, e.g.
 * the screenshot of your channel — and move or resize it in place on the preview. Every
 * preset string is overridable.
 */
export type NewVideoStoryV1Props = {
    /**
     * What the story announces (see platforms.ts). Fills headline / CTA /
     * link text / badge / accent unless overridden. Default "youtube".
     */
    platform?: string;
    /** Your media — an image or a video (the screenshot of your channel, a clip). Empty = a placeholder slot. */
    media?: string;
    /**
     * WHERE your media goes, as one rect drawn on the preview
     * (`picker: "regions"`). Empty = the default slot (bottom ~49 % of the
     * story, full width). Double-clicking the media opens this.
     */
    mediaRegion?: MosaicRegionsValue | MosaicRegion[] | string;
    /** Sticker headline; the last word becomes the big line. Empty = the platform's. */
    headline?: string;
    /** Boxed call-to-action under the headline. Empty = the platform's. */
    cta?: string;
    /** Link-pill text (the domain your link sticker will carry). Empty = the platform's. */
    linkText?: string;
    /** Badge glyph beside the headline: "auto" = the platform's. Default "auto". */
    badge?: string;
    /**
     * An image (PNG with alpha works best) that REPLACES the drawn badge —
     * e.g. the official platform icon downloaded from its brand resources.
     * Empty = the drawn glyph.
     */
    badgeImage?: string;
    /** Badge / accent colour. Empty = the platform's. */
    accentColor?: string;
    /** Stage colour behind everything. Default "#000000". */
    backgroundColor?: string;
    /** How the media fills its slot. Default "cover". */
    mediaFit?: "cover" | "contain";
    /**
     * Cover-crop anchor, 0 = keep the top (the channel header), 1 = keep the
     * bottom. Only read with `mediaFit: "cover"`. Default 0.
     */
    mediaFocus?: number;
    /** Rounded corners on the media, 0–0.5 of its shorter side. Default 0. */
    mediaCorner?: number;
    /** Keep a video's audio. Default true. */
    mediaAudio?: boolean;
    /** Animate the story (slide-ins, the badge drop, bobbing arrows). Off = a still. Default true. */
    animate?: boolean;
    /** Dev-only layout contract wireframe/assertions. Default false. */
    debugLayout?: boolean;
    /** Dev-only zero-drift geometry contract wireframe. Wins over debugLayout
     *  when both are on (each debug view replaces the doc). Default false. */
    debugGeometry?: boolean;
};
export declare const NewVideoStoryPropsSchema: Record<keyof NewVideoStoryV1Props, MosaicTemplatePropDefinition>;
