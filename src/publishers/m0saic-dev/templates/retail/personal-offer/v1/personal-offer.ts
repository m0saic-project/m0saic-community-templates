import type {
  MosaicColor,
  MosaicDocument,
  MosaicEngineContext,
  MosaicOverlayExpr,
  MosaicSource,
} from "@m0saic/types";
import { asAssetId, asTemplateId } from "@m0saic/types";
import { toM0String } from "@m0saic/dsl-stdlib";
import {
  bindProp,
  bindProps,
  composeMotion,
  defineMosaicTemplate,
  definePropsSchema,
  entrance,
  exit,
  makeColorTile,
  placeInsetPieces,
  resolvePinnedDurationMs,
  tag,
} from "@m0saic/template-utils";
import type { LayoutConstraint } from "@m0saic/template-utils";
import { textFitsMeasured, withLayoutIntent } from "./layout";
import { budget, cleanCopy, fitText, type TextFit } from "./text";
import { ART_KINDS, productArtDataUri, type ArtKind } from "./product-art";

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

const ID = "@m0saic-dev/retail/personal-offer/v1";
const HEX = /^#[0-9a-fA-F]{6}$/;

export const PERSONAL_OFFER_MIN_SEC = 6;
export const PERSONAL_OFFER_MAX_SEC = 30;
export const PERSONAL_OFFER_MIN_PERCENT = 1;
export const PERSONAL_OFFER_MAX_PERCENT = 90;

/**
 * Where the clip is going, as the canvas it wants. The knob drives
 * `resolveOutputHints`, so a Make user who keeps the resolution locked to
 * the template just picks a platform and the canvas follows; an explicit
 * `-w/-h` or Device choice still wins at render.
 */
export const OFFER_PLATFORMS = {
  /** 9:16 - Stories, Reels, TikTok. */
  story: { width: 1080, height: 1920 },
  /** 4:5 - a portrait feed post. */
  feed: { width: 1080, height: 1350 },
  /** 1:1 - feed, chat, an email tile. */
  square: { width: 1080, height: 1080 },
  /** 16:9 - an email header, the web, a player. */
  landscape: { width: 1920, height: 1080 },
} as const;
export type OfferPlatform = keyof typeof OFFER_PLATFORMS;
export const OFFER_PLATFORM_KEYS = Object.keys(OFFER_PLATFORMS) as OfferPlatform[];

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The page and text pair each theme starts from; `background` / `ink` override either half. */
export const THEME_COLORS: Record<Theme, { background: string; ink: string }> = {
  light: { background: "#f7f1ec", ink: "#1f1a1c" },
  dark: { background: "#17120f", ink: "#f5efe6" },
};

/** Generic on purpose: this repo is public, so the defaults name no real brand and no real person. */
const DEFAULTS = {
  platform: "story" as OfferPlatform,
  customerName: "Susie",
  greeting: "Hi",
  hook: "We set something aside for you this week.",
  brandName: "Atelier Nine",
  productKicker: "New in fragrance",
  productName: "Velvet Iris",
  productNote: "Eau de parfum. Iris, sandalwood and a trace of pink pepper.",
  productArt: "perfume" as ArtKind,
  offerLabel: "Your member reward",
  discountPercent: 20,
  promoCode: "SUSIE20",
  expiry: "Through Sunday, in store and online",
  ctaLabel: "Shop the new arrivals",
  ctaUrl: "atelier-nine.example/new",
  theme: "light" as Theme,
  accent: "#b4436c",
  durationSec: 10,
};

// What each prop IS. How Make presents it - label, hint, placeholder, order -
// lives in personal-offer.catalog.json beside this file (m0saic 0.3.1).
const propsSchema = definePropsSchema<PersonalOfferProps>({
  platform: { type: "string", required: false, meta: { constraints: { oneOf: [...OFFER_PLATFORM_KEYS] } } },
  customerName: { type: "string", required: false },
  greeting: { type: "string", required: false },
  hook: { type: "string", required: false },
  brandName: { type: "string", required: false },
  brandLogo: {
    type: "media[]",
    required: false,
    meta: { control: { multiple: false, picker: "file", accept: ["image", "video"] } },
  },
  productKicker: { type: "string", required: false },
  productName: { type: "string", required: false },
  productNote: { type: "string", required: false },
  productArt: { type: "string", required: false, meta: { constraints: { oneOf: [...ART_KINDS] } } },
  productImage: {
    type: "media[]",
    required: false,
    meta: { control: { multiple: false, picker: "file", accept: ["image"] } },
  },
  offerLabel: { type: "string", required: false },
  discountPercent: {
    type: "number",
    required: false,
    meta: { constraints: { min: PERSONAL_OFFER_MIN_PERCENT, max: PERSONAL_OFFER_MAX_PERCENT } },
  },
  promoCode: { type: "string", required: false },
  expiry: { type: "string", required: false },
  ctaLabel: { type: "string", required: false },
  ctaUrl: { type: "string", required: false },
  theme: { type: "string", required: false, meta: { constraints: { oneOf: [...THEMES] } } },
  accent: {
    type: "string",
    required: false,
    meta: { constraints: { isColor: true }, control: { colorPicker: true, defaultColor: DEFAULTS.accent } },
  },
  // No default of their own: unset means "the theme's" - the sidecar's
  // placeholder ("from theme") is how an editor shows that unset state.
  background: {
    type: "string",
    required: false,
    meta: { constraints: { isColor: true }, control: { colorPicker: true } },
  },
  ink: {
    type: "string",
    required: false,
    meta: { constraints: { isColor: true }, control: { colorPicker: true } },
  },
  durationSec: {
    type: "number",
    required: false,
    meta: { constraints: { min: PERSONAL_OFFER_MIN_SEC, max: PERSONAL_OFFER_MAX_SEC } },
  },
  debugLayout: { type: "boolean", required: false },
});

/* ── timing: pure, exported, and what the test asserts ── */

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
export function offerBeats(totalSec: number): OfferBeats {
  const D = round3(totalSec);
  return {
    total: D,
    cuts: [round3(0.22 * D), round3(0.58 * D)],
    fade: round3(Math.min(0.3, 0.04 * D)),
    rise: round3(Math.min(0.45, 0.06 * D)),
    stagger: round3(Math.min(0.4, 0.045 * D)),
  };
}

/* ── geometry: one pure function, so the test can sweep it ── */

export type OfferRect = { x: number; y: number; w: number; h: number };
export type OfferBlock = { fit: TextFit; rect: OfferRect };

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
export function percentText(n: number): string {
  return `${n}% OFF`;
}

/**
 * Three regions: chrome (the wordmark on top, the progress line on the
 * bottom), the card the product sits on, and a copy column. Portrait stacks
 * the card over the column; landscape and square put them side by side. The
 * hello beat ignores the card and centres on the whole content area. Every
 * text rect is sized FROM its fitted block, so nothing can overflow.
 */
export function layoutPersonalOffer(copy: OfferCopy, W: number, H: number): OfferLayout {
  const S = Math.min(W, H);
  const stacked = W / H < 0.9;
  const margin = Math.round(0.06 * S);
  const gap = Math.round(0.02 * S);
  const clamp = (r: OfferRect): OfferRect => {
    const x = Math.max(0, Math.min(W - 1, Math.round(r.x)));
    const y = Math.max(0, Math.min(H - 1, Math.round(r.y)));
    return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w))), h: Math.max(1, Math.min(H - y, Math.round(r.h))) };
  };

  // ── chrome ──
  const wmH = Math.max(10, Math.round(0.04 * S));
  const wmFit = fitText(copy.brandName.toUpperCase(), budget(W - 2 * margin), wmH, Math.round(0.028 * S), 8, 1, "bold");
  const wordmark: OfferBlock = { fit: wmFit, rect: clamp({ x: margin, y: Math.round(0.045 * S), w: W - 2 * margin, h: wmFit.h }) };
  // A logo gets a taller slot than a line of text (a mark, a lockup or a
  // video all want height); it is contain-fitted and left-aligned inside it.
  const logo: OfferRect | null = copy.hasLogo
    ? clamp({ x: margin, y: Math.round(0.035 * S), w: Math.round(Math.min(W - 2 * margin, 0.4 * W)), h: Math.round(0.085 * S) })
    : null;
  const chromeBottom = logo ? logo.y + logo.h : wordmark.rect.y + wordmark.rect.h;
  const barH = Math.max(3, Math.round(0.006 * S));
  const bar: OfferRect = { x: 0, y: H - barH, w: W, h: barH };

  const cy0 = chromeBottom + Math.round(0.04 * S);
  const cy1 = H - barH - Math.round(0.05 * S);
  const availH = Math.max(1, cy1 - cy0);

  /**
   * Lay a stack of blocks in a column; returns the rects in order. Centred by
   * default; `anchor: "top"` hangs the stack from `y0` (stacked mode hangs
   * the copy from the card so no dead band opens between them).
   */
  const stack = (x: number, w: number, y0: number, y1: number, heights: number[], between: number, anchor: "center" | "top" = "center"): OfferRect[] => {
    const total = heights.reduce((a, b) => a + b, 0) + between * Math.max(0, heights.length - 1);
    let y = y0 + (anchor === "top" ? 0 : Math.max(0, (y1 - y0 - total) / 2));
    return heights.map((h) => {
      const r = clamp({ x, y, w, h });
      y += h + between;
      return r;
    });
  };
  const at = (fit: TextFit, rect: OfferRect): OfferBlock => ({ fit, rect });

  // ── beat 1: hello, centred on the whole content area ──
  const fullX = margin;
  const fullW = W - 2 * margin;
  const helloText = copy.greeting ? `${copy.greeting} ${copy.customerName},` : `${copy.customerName},`;
  const helloFit = fitText(helloText, budget(fullW), availH * 0.5, Math.round(0.105 * S), 12, 2, "bold");
  const hookFit = copy.hook ? fitText(copy.hook, budget(Math.round(fullW * 0.86)), availH * 0.25, Math.round(0.042 * S), 9, 2, "regular") : null;
  const helloRects = stack(fullX, fullW, cy0, cy1, [helloFit.h, ...(hookFit ? [hookFit.h] : [])], gap);
  const hello = at(helloFit, helloRects[0]);
  const hook = hookFit ? at(hookFit, helloRects[1]) : null;

  // ── the card and the copy column ──
  let card: OfferRect;
  let colX: number;
  let colW: number;
  let colY0: number;
  let colY1: number;
  if (stacked) {
    const side = Math.round(Math.min(0.68 * W, 0.46 * availH));
    card = clamp({ x: (W - side) / 2, y: cy0, w: side, h: side });
    colX = margin;
    colW = W - 2 * margin;
    colY0 = card.y + card.h + gap * 3;
    colY1 = cy1;
  } else {
    const side = Math.round(Math.min(availH, 0.46 * W));
    card = clamp({ x: margin, y: cy0 + (availH - side) / 2, w: side, h: side });
    colX = card.x + card.w + gap * 2;
    colW = W - margin - colX;
    colY0 = cy0;
    colY1 = cy1;
  }
  const inset = Math.round(0.08 * card.w);
  const art = clamp({ x: card.x + inset, y: card.y + inset, w: card.w - 2 * inset, h: card.h - 2 * inset });
  const colH = Math.max(1, colY1 - colY0);
  const colBudget = budget(colW);
  const anchor = stacked ? "top" : "center";

  // ── beat 2: the pick ──
  const kickerFit = copy.productKicker ? fitText(copy.productKicker.toUpperCase(), colBudget, colH * 0.12, Math.round(0.028 * S), 8, 1, "bold") : null;
  const nameFit = fitText(copy.productName, colBudget, colH * 0.42, Math.round(0.072 * S), 12, 2, "bold");
  const noteFit = copy.productNote ? fitText(copy.productNote, budget(Math.round(colW * 0.92)), colH * 0.34, Math.round(0.036 * S), 9, 3, "regular") : null;
  const pickRects = stack(colX, colW, colY0, colY1, [kickerFit?.h ?? 0, nameFit.h, noteFit?.h ?? 0].filter((h) => h > 0), gap, anchor);
  let i = 0;
  const kicker = kickerFit ? at(kickerFit, pickRects[i++]) : null;
  const name = at(nameFit, pickRects[i++]);
  const note = noteFit ? at(noteFit, pickRects[i++]) : null;

  // ── beat 3: the offer ──
  const labelFit = copy.offerLabel ? fitText(copy.offerLabel.toUpperCase(), colBudget, colH * 0.1, Math.round(0.028 * S), 8, 1, "bold") : null;
  const percentFit = fitText(percentText(copy.discountPercent), colBudget, colH * 0.36, Math.round(Math.min(0.15 * S, 0.26 * colH)), 14, 1, "bold");
  const codeFit = copy.promoCode ? fitText(copy.promoCode.toUpperCase(), budget(Math.round(colW * 0.8)), colH * 0.16, Math.round(0.05 * S), 10, 1, "bold") : null;
  const pillH = codeFit ? codeFit.h + Math.round(codeFit.px * 0.5) : 0;
  const expiryFit = copy.expiry ? fitText(copy.expiry, budget(Math.round(colW * 0.92)), colH * 0.14, Math.round(0.03 * S), 8, 2, "regular") : null;
  const ctaFit = copy.ctaLabel ? fitText(copy.ctaLabel, colBudget, colH * 0.12, Math.round(0.036 * S), 9, 1, "bold") : null;
  const urlFit = copy.ctaUrl ? fitText(copy.ctaUrl, colBudget, colH * 0.1, Math.round(0.03 * S), 8, 1, "regular") : null;
  const offerHeights = [labelFit?.h ?? 0, percentFit.h, pillH, expiryFit?.h ?? 0, ctaFit?.h ?? 0, urlFit?.h ?? 0];
  const offerRects = stack(colX, colW, colY0, colY1, offerHeights.filter((h) => h > 0), gap, anchor);
  let j = 0;
  const offerLabel = labelFit ? at(labelFit, offerRects[j++]) : null;
  const percent = at(percentFit, offerRects[j++]);
  let pill: OfferRect | null = null;
  if (codeFit) {
    const row = offerRects[j++];
    const padX = Math.round(codeFit.px * 0.9);
    const w = Math.min(colW, Math.ceil(codeFit.width / 0.94) + 2 * padX);
    pill = clamp({ x: colX + (colW - w) / 2, y: row.y, w, h: row.h });
  }
  const expiry = expiryFit ? at(expiryFit, offerRects[j++]) : null;
  const cta = ctaFit ? at(ctaFit, offerRects[j++]) : null;
  const url = urlFit ? at(urlFit, offerRects[j++]) : null;

  return { W, H, stacked, wordmark, logo, bar, hello, hook, card, art, kicker, name, note, offerLabel, percent, pill, code: codeFit, expiry, cta, url };
}

/** What the geometry promises, label by label - checked when debugLayout is on, swept by the test. */
export function personalOfferContract(L: OfferLayout): LayoutConstraint[] {
  const out: LayoutConstraint[] = [];
  const fits = (label: string, fit: TextFit | null | undefined) => {
    if (fit) out.push(textFitsMeasured(label, fit.lines.join("\n"), fit.px, fit.width));
  };
  if (!L.logo) fits("wordmark", L.wordmark.fit);
  fits("hello", L.hello.fit);
  fits("hook", L.hook?.fit);
  fits("kicker", L.kicker?.fit);
  fits("product-name", L.name.fit);
  fits("product-note", L.note?.fit);
  fits("offer-label", L.offerLabel?.fit);
  fits("percent", L.percent.fit);
  fits("code", L.code);
  fits("expiry", L.expiry?.fit);
  fits("cta", L.cta?.fit);
  fits("cta-url", L.url?.fit);
  out.push({ label: "card", aspect: 1 });
  out.push({ label: L.logo ? "logo" : "wordmark", within: { yFrac: [0, 0.25] } });
  out.push({ label: "progress", minWidthFrac: 0.98, within: { yFrac: [0.9, 1] } });
  return out;
}

export const PersonalOfferV1 = defineMosaicTemplate<PersonalOfferProps>({
  id: asTemplateId(ID),
  capabilities: { tier: "core" },

  outputHints: {
    ...OFFER_PLATFORMS[DEFAULTS.platform],
    fps: 30,
    durationMs: DEFAULTS.durationSec * 1000,
    format: { kind: "video", container: "mp4" },
    note: "The canvas follows the platform knob (story 1080x1920 by default; feed, square and landscape re-flow with the product beside the copy); an explicit -w/-h wins. The clip is durationSec long; an explicit --durationMs overrides it.",
  },
  // The canvas and the length are knobs: a host seeds its Device and Duration
  // fields from the props and re-seeds when they change. Never throws - a
  // hint must not kill a render; junk falls back to the defaults.
  resolveOutputHints: (props) => {
    const key = typeof props?.platform === "string" ? props.platform.trim().toLowerCase() : "";
    const dims = OFFER_PLATFORMS[(key in OFFER_PLATFORMS ? key : DEFAULTS.platform) as OfferPlatform];
    const sec = numberOr(props?.durationSec, DEFAULTS.durationSec, PERSONAL_OFFER_MIN_SEC, PERSONAL_OFFER_MAX_SEC);
    return { ...dims, durationMs: Math.round(sec * 1000) };
  },

  propsSchema,
  defaultProps: {
    platform: DEFAULTS.platform,
    customerName: DEFAULTS.customerName,
    greeting: DEFAULTS.greeting,
    hook: DEFAULTS.hook,
    brandName: DEFAULTS.brandName,
    brandLogo: [],
    productKicker: DEFAULTS.productKicker,
    productName: DEFAULTS.productName,
    productNote: DEFAULTS.productNote,
    productArt: DEFAULTS.productArt,
    productImage: [],
    offerLabel: DEFAULTS.offerLabel,
    discountPercent: DEFAULTS.discountPercent,
    promoCode: DEFAULTS.promoCode,
    expiry: DEFAULTS.expiry,
    ctaLabel: DEFAULTS.ctaLabel,
    ctaUrl: DEFAULTS.ctaUrl,
    theme: DEFAULTS.theme,
    accent: DEFAULTS.accent,
    durationSec: DEFAULTS.durationSec,
    debugLayout: false,
  },
  // `background` is the document's own fill and needs no rect; `ink` and the
  // length can carry a handle and deliberately do not. `theme` is a closed
  // set and needs no entry.
  bindings: { unbound: { background: "canvas", ink: "theme", durationSec: "timing" } },

  render,
});

export default PersonalOfferV1;

/* ── input: the schema is documentation, render() is the gate ── */

/** A finite number in range, or the fallback - for the hints resolver, which must never throw. */
function numberOr(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** undefined = the default, "" = removed. */
function pickText(value: unknown, fallback: string, name: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`${ID}: ${name} must be a string.`);
  return cleanCopy(value);
}

function pickColor(value: unknown, fallback: string, name: string): MosaicColor {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length === 0) return fallback as MosaicColor;
  if (!HEX.test(s)) throw new Error(`${ID}: ${name} ${JSON.stringify(value)} must be #rrggbb.`);
  return s as MosaicColor;
}

function pickInt(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${ID}: ${name} must be a whole number from ${min} to ${max}. Got ${JSON.stringify(value)}.`);
  }
  return n;
}

function pickArt(value: unknown): ArtKind {
  if (value === undefined || value === null || value === "") return DEFAULTS.productArt;
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!(ART_KINDS as readonly string[]).includes(s)) {
    throw new Error(`${ID}: productArt must be one of ${ART_KINDS.join(", ")}. Got ${JSON.stringify(value)}.`);
  }
  return s as ArtKind;
}

function pickTheme(value: unknown): Theme {
  if (value === undefined || value === null || value === "") return DEFAULTS.theme;
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!(THEMES as readonly string[]).includes(s)) {
    throw new Error(`${ID}: theme must be one of ${THEMES.join(", ")}. Got ${JSON.stringify(value)}.`);
  }
  return s as Theme;
}

/** The canvas comes from ctx.target; the knob is still validated here so a typo fails with a name. */
function pickPlatform(value: unknown): OfferPlatform {
  if (value === undefined || value === null || value === "") return DEFAULTS.platform;
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!(s in OFFER_PLATFORMS)) {
    throw new Error(`${ID}: platform must be one of ${OFFER_PLATFORM_KEYS.join(", ")}. Got ${JSON.stringify(value)}.`);
  }
  return s as OfferPlatform;
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

/**
 * Image or video? The host's probe (`ctx.media`) is the authority when it has
 * seen the file; otherwise the extension decides, so a CLI render with a
 * `.mp4` logo still plays it rather than failing on a still-image input.
 */
function mediaKindOf(ctx: MosaicEngineContext, assetId: string, ref: string): "image" | "video" {
  const known = ctx.media?.[assetId as keyof NonNullable<typeof ctx.media>] as { kind?: string } | undefined;
  if (known?.kind === "video" || known?.kind === "image") return known.kind;
  return VIDEO_EXT.test(ref) ? "video" : "image";
}

/** A zero-or-one media prop: an array of path strings; more than one is an error. */
function pickMedia(value: unknown, name: string): string {
  if (value === undefined || value === null) return "";
  if (!Array.isArray(value)) throw new Error(`${ID}: ${name} must be an array of zero or one path.`);
  const refs = value.map((v) => String(v).trim()).filter(Boolean);
  if (refs.length > 1) throw new Error(`${ID}: ${name} accepts zero or one file (got ${refs.length}).`);
  return refs[0] ?? "";
}

const ASSET_ID_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

/* ── colour ── */

function rgb(c: MosaicColor): [number, number, number] {
  const n = parseInt(String(c).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear byte mix, `t` of `a` over `1 - t` of `b`: a static stand-in for opacity that costs no overlay layer. */
function mix(a: MosaicColor, b: MosaicColor, t: number): MosaicColor {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const ch = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  return `#${((1 << 24) + (ch(ar, br) << 16) + (ch(ag, bg) << 8) + ch(ab, bb)).toString(16).slice(1)}` as MosaicColor;
}

function luminance(c: MosaicColor): number {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Whichever of the two reads better on `fill`. */
function onColor(fill: MosaicColor, a: MosaicColor, b: MosaicColor): MosaicColor {
  const l = luminance(fill);
  return Math.abs(luminance(a) - l) >= Math.abs(luminance(b) - l) ? a : b;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ── sources ── */

/** One svg-rasterized text block (the bundled font, no drawtext), centred in its rect. */
function textSource(fit: TextFit, color: MosaicColor, label: string, overlay: MosaicOverlayExpr | undefined, hAlign: "left" | "center" = "center"): MosaicSource {
  return tag({
    type: "text",
    rasterizer: "svg",
    renderMode: { kind: "image" },
    layers: [
      {
        content: { kind: "literal", text: fit.lines.join("\n") },
        style: {
          fontSize: fit.px,
          fontColor: color,
          ...(fit.face === "bold" ? { fontWeight: "bold" } : {}),
          ...(fit.face === "italic" ? { fontStyle: "italic" } : {}),
        },
        placement: { hAlign, vAlign: "middle" },
      },
    ],
    ...(overlay ? { overlay } : {}),
    editor: { owner: "template" },
  } as MosaicSource, label);
}

async function render(props: PersonalOfferProps, ctx: MosaicEngineContext): Promise<MosaicDocument> {
  const customerName = pickText(props.customerName, DEFAULTS.customerName, "customerName");
  if (customerName.length === 0) throw new Error(`${ID}: customerName is required - the clip is addressed to someone.`);
  const brandName = pickText(props.brandName, DEFAULTS.brandName, "brandName");
  if (brandName.length === 0) throw new Error(`${ID}: brandName is required - the clip is from someone.`);
  const productName = pickText(props.productName, DEFAULTS.productName, "productName");
  if (productName.length === 0) throw new Error(`${ID}: productName is required - the clip is about something.`);
  const imageRef = pickMedia(props.productImage, "productImage");
  const logoRef = pickMedia(props.brandLogo, "brandLogo");
  const copy: OfferCopy = {
    customerName,
    greeting: pickText(props.greeting, DEFAULTS.greeting, "greeting"),
    hook: pickText(props.hook, DEFAULTS.hook, "hook"),
    brandName,
    hasLogo: logoRef.length > 0,
    productKicker: pickText(props.productKicker, DEFAULTS.productKicker, "productKicker"),
    productName,
    productNote: pickText(props.productNote, DEFAULTS.productNote, "productNote"),
    offerLabel: pickText(props.offerLabel, DEFAULTS.offerLabel, "offerLabel"),
    discountPercent: pickInt(props.discountPercent, DEFAULTS.discountPercent, PERSONAL_OFFER_MIN_PERCENT, PERSONAL_OFFER_MAX_PERCENT, "discountPercent"),
    promoCode: pickText(props.promoCode, DEFAULTS.promoCode, "promoCode"),
    expiry: pickText(props.expiry, DEFAULTS.expiry, "expiry"),
    ctaLabel: pickText(props.ctaLabel, DEFAULTS.ctaLabel, "ctaLabel"),
    ctaUrl: pickText(props.ctaUrl, DEFAULTS.ctaUrl, "ctaUrl"),
  };
  const art = pickArt(props.productArt);
  pickPlatform(props.platform);
  // The theme is the page/text pair the clip starts from; an explicit colour wins over its half.
  const theme = THEME_COLORS[pickTheme(props.theme)];
  const accent = pickColor(props.accent, DEFAULTS.accent, "accent");
  const bg = pickColor(props.background, theme.background, "background");
  const ink = pickColor(props.ink, theme.ink, "ink");
  const dim = mix(ink, bg, 0.62);
  const cardFill = mix(accent, bg, 0.1);

  // Files a row hands over: an id-shaped ref IS the asset id (a host's picker
  // hands one over); a path gets a fixed id with the path in the manifest.
  const assets: NonNullable<MosaicDocument["assets"]> = {};
  const fileAssetId = (ref: string, fixed: string) => asAssetId(ASSET_ID_RE.test(ref) ? ref : fixed);

  // The logo: an image or a short video in the wordmark's slot. A video
  // loops for the clip and is muted - it is a mark, not a soundtrack.
  const logoId = logoRef ? fileAssetId(logoRef, "brand-logo") : undefined;
  const logoKind = logoId ? mediaKindOf(ctx, String(logoId), logoRef) : "image";
  if (logoId) assets[logoId] = { kind: "file", path: logoRef, mediaType: logoKind };

  // The product: a real shot when a row carries one, else the bundled art,
  // tinted to the accent, as an SVG the engine rasterizes.
  let imageId = imageRef ? fileAssetId(imageRef, "product-image") : undefined;
  if (imageId) {
    assets[imageId] = { kind: "file", path: imageRef, mediaType: "image" };
    const known = ctx.media?.[imageId];
    if (known && known.kind !== "image") throw new Error(`${ID}: productImage must be an image (got ${known.kind}).`);
  } else {
    imageId = asAssetId("product-art");
    assets[imageId] = {
      kind: "data-uri",
      uri: productArtDataUri(art, { accent, deep: mix(accent, "#000000" as MosaicColor, 0.72), pale: mix(accent, "#ffffff" as MosaicColor, 0.22), ink }),
      mediaType: "image",
      displayName: `${art} (bundled art)`,
    };
  }

  // An explicit user pin wins and BECOMES the clip; the host-seeded target is never read as one.
  const pinned = resolvePinnedDurationMs(ctx);
  const durationMs = pinned !== undefined ? Math.round(pinned) : pickInt(props.durationSec, DEFAULTS.durationSec, PERSONAL_OFFER_MIN_SEC, PERSONAL_OFFER_MAX_SEC, "durationSec") * 1000;
  const T = offerBeats(durationMs / 1000);
  const [cut1, cut2] = T.cuts;

  const W = Math.max(1, Math.round(ctx.target.width));
  const H = Math.max(1, Math.round(ctx.target.height));
  const L = layoutPersonalOffer(copy, W, H);

  /** Leave before the next beat starts. */
  const leave = (endSec: number) => exit({ kind: "fade", durationMs: T.fade * 1000, atSec: round3(endSec - T.fade) });
  /** Arrive `step` staggers into a beat; `endSec` undefined holds to the last frame. */
  const arrive = (startSec: number, step: number, endSec: number | undefined, kind: "rise" | "fade" = "rise") => {
    const enter = entrance({ kind, durationMs: T.rise * 1000, atSec: round3(startSec + step * T.stagger), ease: "easeOut" });
    return endSec === undefined ? enter : composeMotion(enter, leave(endSec));
  };

  const pieces: Parameters<typeof placeInsetPieces>[0]["pieces"] = [];
  const piece = (rect: OfferRect, importance: number, source: MosaicSource) => pieces.push({ rect: { ...rect, importance }, source });

  // ── chrome: on every frame ──
  if (L.logo && logoId) {
    // The logo takes the wordmark's slot; the brand name still names the clip
    // (editor.label below). The rect is the drop target for a new logo.
    piece(L.logo, 1, bindProp(tag({
      type: "media",
      mediaType: logoKind,
      assetId: logoId,
      placement: { fit: "contain", hAlign: "left", vAlign: "middle" },
      ...(logoKind === "video" ? { loopMode: "loop", audio: { enabled: false } } : {}),
      editor: { owner: "template" },
    } as MosaicSource, "logo"), "brandLogo", 0));
  } else {
    piece(L.wordmark.rect, 1, bindProps(textSource(L.wordmark.fit, ink, "wordmark", undefined, "left"), [{ propKey: "brandName" }, { propKey: "brandLogo", index: 0 }]));
  }
  // One full-width line that slides in from the left over the whole clip: a
  // scalar x offset per frame, so the progress costs nothing per pixel.
  piece(L.bar, 1, tag(makeColorTile(accent, { overlay: { xExpr: `-W*(1-min(1,t/${T.total}))` } }) as MosaicSource, "progress"));

  // ── beat 1: hello. Static at t=0 - frame 0 is the thumbnail. ──
  const out1 = leave(cut1);
  piece(L.hello.rect, 2, bindProps(textSource(L.hello.fit, ink, "hello", out1), [{ propKey: "customerName" }, { propKey: "greeting" }]));
  if (L.hook) piece(L.hook.rect, 2, bindProp(textSource(L.hook.fit, dim, "hook", out1), "hook"));

  // ── beat 2: the pick. The card arrives and stays; the copy makes way for the offer. ──
  const cardIn = arrive(cut1, 0, undefined, "fade");
  piece(L.card, 2, bindProp(tag(makeColorTile(cardFill, { effects: { rounding: { cornerStyle: "rounded", borderRadius: 0.12 } }, overlay: cardIn }) as MosaicSource, "card"), "accent"));
  piece(L.art, 3, bindProp(tag({
    type: "media",
    mediaType: "image",
    assetId: imageId,
    placement: { fit: "contain" },
    overlay: arrive(cut1, 1, undefined),
    editor: { owner: "template" },
  } as MosaicSource, "art"), "productImage", 0));
  if (L.kicker) piece(L.kicker.rect, 2, bindProp(textSource(L.kicker.fit, accent, "kicker", arrive(cut1, 1, cut2)), "productKicker"));
  piece(L.name.rect, 2, bindProp(textSource(L.name.fit, ink, "product-name", arrive(cut1, 2, cut2)), "productName"));
  if (L.note) piece(L.note.rect, 2, bindProp(textSource(L.note.fit, dim, "product-note", arrive(cut1, 3, cut2)), "productNote"));

  // ── beat 3: the offer. No exit - a paused clip still shows the code. ──
  if (L.offerLabel) piece(L.offerLabel.rect, 2, bindProp(textSource(L.offerLabel.fit, accent, "offer-label", arrive(cut2, 0, undefined)), "offerLabel"));
  piece(L.percent.rect, 2, bindProp(textSource(L.percent.fit, accent, "percent", arrive(cut2, 1, undefined)), "discountPercent"));
  if (L.pill && L.code) {
    const pillMotion = arrive(cut2, 2, undefined, "fade");
    piece(L.pill, 2, tag(makeColorTile(accent, { effects: { rounding: { cornerStyle: "pill" } }, overlay: pillMotion }) as MosaicSource, "code-pill"));
    piece(L.pill, 3, bindProp(textSource(L.code, onColor(accent, bg, ink), "code", pillMotion), "promoCode"));
  }
  if (L.expiry) piece(L.expiry.rect, 2, bindProp(textSource(L.expiry.fit, dim, "expiry", arrive(cut2, 3, undefined)), "expiry"));
  if (L.cta) piece(L.cta.rect, 2, bindProp(textSource(L.cta.fit, ink, "cta", arrive(cut2, 4, undefined)), "ctaLabel"));
  if (L.url) piece(L.url.rect, 2, bindProp(textSource(L.url.fit, accent, "cta-url", arrive(cut2, 4, undefined)), "ctaUrl"));

  const placed = placeInsetPieces({ rootW: W, rootH: H, pieces });
  const doc: MosaicDocument = {
    kind: "mosaic_document",
    version: 1,
    m0: toM0String(placed.m0, ID),
    assets,
    size: { width: W, height: H },
    fps: ctx.target.fps,
    // The length is authored (a prop, or the user's pin), so it out-ranks the hint.
    durationMs,
    backgroundColor: bg,
    sources: placed.sources,
    editor: { label: `Personal Offer - ${copy.customerName} from ${copy.brandName}` },
  };
  return withLayoutIntent(doc, ctx, { templateId: ID, constraints: personalOfferContract(L), debug: props.debugLayout === true });
}
