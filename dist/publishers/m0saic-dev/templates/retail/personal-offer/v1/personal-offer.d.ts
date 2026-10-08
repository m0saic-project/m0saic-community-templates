import type { LayoutConstraint } from "@m0saic/template-utils";
import { type TextFit } from "./text";
/**
 * `@m0saic-dev/retail/personal-offer/v1` - a promo clip addressed to ONE
 * customer: their name, the product picked for them, their discount, their
 * code.
 *
 * ONE CONCEPT: **the ad is a row of customer data.** A retailer's weekly send
 * already knows who Susie is, what she buys, what tier she is on and what
 * code to mint for her. Those fields ARE this template's props: the job
 * writes them in, the render is her video, and a thousand customers are a
 * loop over a thousand rows. The look never drifts - a designer signs off
 * on this template once, and every row renders inside it.
 *
 * Three beats, timed as shares of the clip so any length keeps the rhythm:
 *
 *   1. hello     - "Hi Susie," and one line of why she is hearing from you.
 *                  Static from frame 0: the first frame is the thumbnail,
 *                  and her own name is what gets the click.
 *   2. the pick  - the product, large, on its card: kicker, name, note. The
 *                  card stays up for the rest of the clip.
 *   3. the offer - the percentage, the code in a pill, when it ends, where
 *                  to go. It holds to the last frame, so a paused clip
 *                  still shows the code.
 *
 * The product art is GENERIC and SHIPS WITH THE TEMPLATE: four flat
 * illustrations as inline SVG text (`product-art.ts`), tinted from the
 * accent, rasterized by m0saic itself. `productArt` picks one; a
 * `productImage` (a real product shot) replaces it on the same card.
 *
 * The rule that bites: **a file prop needs an ABSOLUTE path.** A relative
 * `productImage` does not resolve at render and the clip fails on a missing
 * input. With no image the bundled art draws, so a row with no product shot
 * still renders a finished clip.
 *
 * Text is Latin (the bundled Roboto): emoji and other scripts in a CRM row
 * are dropped rather than drawn as empty boxes; curly quotes and long dashes
 * fold to ASCII.
 */
export type PersonalOfferProps = {
    /** Where the clip is going (story | feed | square | landscape): sets the canvas it is rendered at. */
    platform?: string;
    /** Who the clip is for - the name in the greeting, and in the thumbnail. Required. */
    customerName?: string;
    /** The word before the name. Empty leaves the name alone. */
    greeting?: string;
    /** One line under the greeting. Empty removes it. */
    hook?: string;
    /** The small wordmark on every frame, and the clip's name. Required. */
    brandName?: string;
    /** Zero or one logo (an image or a short video, absolute path) in place of the wordmark text. Empty draws the name. */
    brandLogo?: string[];
    /** The short line above the product name. Empty removes it. */
    productKicker?: string;
    /** The product picked for this customer. Required. */
    productName?: string;
    /** One or two sentences about the product. Empty removes it. */
    productNote?: string;
    /** Which bundled illustration stands in for the product (perfume | lipstick | cream | serum). */
    productArt?: string;
    /** Zero or one product shot (absolute path). Empty draws the bundled art. */
    productImage?: string[];
    /** The line above the percentage. Empty removes it. */
    offerLabel?: string;
    /** Whole percent off, 1..90. */
    discountPercent?: number;
    /** The code in the pill. Empty removes the pill. */
    promoCode?: string;
    /** When the offer ends, under the code. Empty removes it. */
    expiry?: string;
    /** The call to action. Empty removes it. */
    ctaLabel?: string;
    /** Where to go, under the call to action. Empty removes it. */
    ctaUrl?: string;
    /** Light or dark: the page and text pair the clip starts from. */
    theme?: string;
    /** The brand colour: the card, the percentage, the pill, the progress line (#rrggbb). */
    accent?: string;
    /** The page (#rrggbb). Empty takes the theme's. */
    background?: string;
    /** The text (#rrggbb). Empty takes the theme's. */
    ink?: string;
    /** Clip length in whole seconds (6..30). The three beats keep their shares. */
    durationSec?: number;
    /** Dev-only: check the layout contract and draw it over the frame. */
    debugLayout?: boolean;
};
export declare const PERSONAL_OFFER_MIN_SEC = 6;
export declare const PERSONAL_OFFER_MAX_SEC = 30;
export declare const PERSONAL_OFFER_MIN_PERCENT = 1;
export declare const PERSONAL_OFFER_MAX_PERCENT = 90;
/**
 * Where the clip is going, as the canvas it wants. The knob drives
 * `resolveOutputHints`, so a Make user who keeps the resolution locked to
 * the template just picks a platform and the canvas follows; an explicit
 * `-w/-h` or Device choice still wins at render.
 */
export declare const OFFER_PLATFORMS: {
    /** 9:16 - Stories, Reels, TikTok. */
    readonly story: {
        readonly width: 1080;
        readonly height: 1920;
    };
    /** 4:5 - a portrait feed post. */
    readonly feed: {
        readonly width: 1080;
        readonly height: 1350;
    };
    /** 1:1 - feed, chat, an email tile. */
    readonly square: {
        readonly width: 1080;
        readonly height: 1080;
    };
    /** 16:9 - an email header, the web, a player. */
    readonly landscape: {
        readonly width: 1920;
        readonly height: 1080;
    };
};
export type OfferPlatform = keyof typeof OFFER_PLATFORMS;
export declare const OFFER_PLATFORM_KEYS: OfferPlatform[];
export declare const THEMES: readonly ["light", "dark"];
export type Theme = (typeof THEMES)[number];
/** The page and text pair each theme starts from; `background` / `ink` override either half. */
export declare const THEME_COLORS: Record<Theme, {
    background: string;
    ink: string;
}>;
export type OfferBeats = {
    /** Clip length in seconds. */
    total: number;
    /** Where beats two and three begin. */
    cuts: [number, number];
    /** Exit fade length. */
    fade: number;
    /** Entrance ramp length. */
    rise: number;
    /** Delay between two staggered entrances. */
    stagger: number;
};
/**
 * The beats as shares of the clip - 22% hello, 36% the pick, 42% the offer
 * (the code is what must be read) - with ramps that shorten on a short clip,
 * so the last line of the offer has landed with time to spare.
 */
export declare function offerBeats(totalSec: number): OfferBeats;
export type OfferRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type OfferBlock = {
    fit: TextFit;
    rect: OfferRect;
};
export type OfferCopy = {
    customerName: string;
    greeting: string;
    hook: string;
    brandName: string;
    /** A logo takes the wordmark's slot (taller, so a mark or a video has room). */
    hasLogo: boolean;
    productKicker: string;
    productName: string;
    productNote: string;
    offerLabel: string;
    discountPercent: number;
    promoCode: string;
    expiry: string;
    ctaLabel: string;
    ctaUrl: string;
};
export type OfferLayout = {
    W: number;
    H: number;
    /** Stacked (portrait) or side by side (landscape and square). */
    stacked: boolean;
    /** The brand name, drawn when there is no logo. */
    wordmark: OfferBlock;
    /** The logo's slot, left-aligned in the chrome row; null without a logo. */
    logo: OfferRect | null;
    bar: OfferRect;
    hello: OfferBlock;
    hook: OfferBlock | null;
    card: OfferRect;
    art: OfferRect;
    kicker: OfferBlock | null;
    name: OfferBlock;
    note: OfferBlock | null;
    offerLabel: OfferBlock | null;
    percent: OfferBlock;
    pill: OfferRect | null;
    code: TextFit | null;
    expiry: OfferBlock | null;
    cta: OfferBlock | null;
    url: OfferBlock | null;
};
/** The percentage as drawn. */
export declare function percentText(n: number): string;
/**
 * Three regions: chrome (the wordmark on top, the progress line on the
 * bottom), the card the product sits on, and a copy column. Portrait stacks
 * the card over the column; landscape and square put them side by side. The
 * hello beat ignores the card and centres on the whole content area. Every
 * text rect is sized FROM its fitted block, so nothing can overflow.
 */
export declare function layoutPersonalOffer(copy: OfferCopy, W: number, H: number): OfferLayout;
/** What the geometry promises, label by label - checked when debugLayout is on, swept by the test. */
export declare function personalOfferContract(L: OfferLayout): LayoutConstraint[];
export declare const PersonalOfferV1: import("@m0saic/types").MosaicTemplate<PersonalOfferProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>;
export default PersonalOfferV1;
