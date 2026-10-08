import { evaluateM0 } from "@m0saic/dsl-stdlib";
import { resolvePropBindings, resolveTemplateOutputHints } from "@m0saic/template-utils";

import { sweepLayout } from "./layout";
import { asDocument, targetCtx } from "../../../../../../__testutils__/render";
import {
  OFFER_PLATFORMS,
  PersonalOfferV1,
  THEME_COLORS,
  layoutPersonalOffer,
  offerBeats,
  percentText,
  type OfferCopy,
  type PersonalOfferProps,
} from "./personal-offer";
import { ART_KINDS, productArtSvg } from "./product-art";

const ID = "@m0saic-dev/retail/personal-offer/v1";

const render = (props: PersonalOfferProps = {}, w = 1080, h = 1920) =>
  PersonalOfferV1.render({ ...PersonalOfferV1.defaultProps, ...props }, targetCtx(w, h)).then(asDocument);

const sweep = (props: PersonalOfferProps = {}) =>
  sweepLayout((p, ctx) => PersonalOfferV1.render({ ...PersonalOfferV1.defaultProps, ...p }, ctx).then(asDocument), ID, props, (w, h) => targetCtx(w, h));

const COPY: OfferCopy = {
  customerName: "Susie",
  greeting: "Hi",
  hook: "We set something aside for you this week.",
  brandName: "Atelier Nine",
  hasLogo: false,
  productKicker: "New in fragrance",
  productName: "Velvet Iris",
  productNote: "Eau de parfum. Iris, sandalwood and a trace of pink pepper.",
  offerLabel: "Your member reward",
  discountPercent: 20,
  promoCode: "SUSIE20",
  expiry: "Through Sunday, in store and online",
  ctaLabel: "Shop the new arrivals",
  ctaUrl: "atelier-nine.example/new",
};

describe(ID, () => {
  it("binds every customer field to the rect that shows it - Make's double-click edits the row in place", async () => {
    const doc = await render();
    const { byProp, rejected } = resolvePropBindings(doc, 1080, 1920, { propsSchema: PersonalOfferV1.propsSchema });
    expect(rejected).toEqual([]);
    for (const key of ["customerName", "brandName", "productName", "discountPercent", "promoCode", "ctaUrl", "accent"]) {
      expect(byProp[key]?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    // The card is a drop target for a real product shot; the wordmark for a logo.
    expect(byProp.productImage).toHaveLength(1);
    expect(byProp.brandLogo).toHaveLength(1);
  });

  it("starts from a light or dark theme, with an explicit colour winning over its half", async () => {
    const light = await render();
    const dark = await render({ theme: "dark" });
    expect(light.backgroundColor).toBe(THEME_COLORS.light.background);
    expect(dark.backgroundColor).toBe(THEME_COLORS.dark.background);
    const mixed = await render({ theme: "dark", background: "#003344" });
    expect(mixed.backgroundColor).toBe("#003344");
    await sweep({ theme: "dark" });
    await expect(render({ theme: "sepia" })).rejects.toThrow(/theme/);
  }, 60_000);

  it("takes a logo - an image or a muted looping video - in the wordmark's slot", async () => {
    const labelsOf = (doc: Awaited<ReturnType<typeof render>>) => doc.sources.map((s) => (s as { editor?: { label?: string } }).editor?.label);
    const none = await render();
    expect(labelsOf(none)).toContain("wordmark");
    expect(labelsOf(none)).not.toContain("logo");

    const png = await render({ brandLogo: ["C:/brand/mark.png"] });
    expect(labelsOf(png)).toContain("logo");
    expect(labelsOf(png)).not.toContain("wordmark");
    expect(png.assets["brand-logo" as keyof typeof png.assets]).toMatchObject({ kind: "file", mediaType: "image" });

    const mp4 = await render({ brandLogo: ["C:/brand/mark-loop.mp4"] });
    expect(mp4.assets["brand-logo" as keyof typeof mp4.assets]).toMatchObject({ kind: "file", mediaType: "video" });
    const logoSrc = mp4.sources.find((s) => (s as { editor?: { label?: string } }).editor?.label === "logo") as Record<string, unknown>;
    expect(logoSrc).toMatchObject({ mediaType: "video", loopMode: "loop", audio: { enabled: false } });
    // The logo's rect is the drop target for the next logo, and the layout still holds everywhere.
    const { byProp, rejected } = resolvePropBindings(mp4, 1080, 1920, { propsSchema: PersonalOfferV1.propsSchema });
    expect(rejected).toEqual([]);
    expect(byProp.brandLogo).toHaveLength(1);
    await sweep({ brandLogo: ["C:/brand/mark.png"] });
    await expect(render({ brandLogo: ["a.png", "b.png"] })).rejects.toThrow(/zero or one/);
  }, 60_000);

  it("holds its layout contract at the seven canvases, with defaults, long copy and emptied lines", async () => {
    await sweep();
    await sweep({
      customerName: "Maximiliana Featherstonehaugh",
      productName: "Midnight Garden Intense Eau de Parfum Limited Edition",
      productNote: "A long note from a product database that goes on well past the width of any column and must wrap or shrink rather than overflow the card.",
      promoCode: "MAXIMILIANA-FEATHER-2026",
      discountPercent: 85,
    });
    await sweep({ hook: "", productKicker: "", productNote: "", offerLabel: "", expiry: "", ctaLabel: "", ctaUrl: "" });
    await sweep({ promoCode: "" });
  }, 60_000);

  it("re-flows: stacked in portrait, side by side in landscape and square", () => {
    const tall = layoutPersonalOffer(COPY, 1080, 1920);
    const wide = layoutPersonalOffer(COPY, 1920, 1080);
    const square = layoutPersonalOffer(COPY, 1080, 1080);
    expect(tall.stacked).toBe(true);
    expect(wide.stacked).toBe(false);
    expect(square.stacked).toBe(false);
    // Stacked: the copy column starts under the card. Side by side: to its right.
    expect(tall.name.rect.y).toBeGreaterThan(tall.card.y + tall.card.h);
    expect(wide.name.rect.x).toBeGreaterThan(wide.card.x + wide.card.w);
    // The card is square and the art sits inside it.
    for (const L of [tall, wide, square]) {
      expect(L.card.w).toBe(L.card.h);
      expect(L.art.x).toBeGreaterThan(L.card.x);
      expect(L.art.x + L.art.w).toBeLessThan(L.card.x + L.card.w);
      // The pill hugs its code and stays inside the column.
      expect(L.pill).not.toBeNull();
      expect(L.pill!.w).toBeLessThanOrEqual(L.percent.rect.w);
    }
  });

  it("times three beats as shares of the clip, shortening ramps on a short one", () => {
    const ten = offerBeats(10);
    expect(ten.cuts).toEqual([2.2, 5.8]);
    expect(ten.fade).toBe(0.3);
    const six = offerBeats(6);
    expect(six.cuts).toEqual([1.32, 3.48]);
    expect(six.rise).toBeLessThan(ten.rise);
    // The last staggered line of the offer has landed before the clip ends.
    expect(six.cuts[1] + 4 * six.stagger + six.rise).toBeLessThan(six.total);
  });

  it("ships its product art as inline SVG text and tints it from the accent", async () => {
    const tone = { accent: "#b4436c", deep: "#331320", pale: "#eec7d6", ink: "#1f1a1c" };
    for (const kind of ART_KINDS) {
      const svg = productArtSvg(kind, tone);
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg).toContain(tone.accent);
    }
    const doc = await render();
    const art = doc.assets["product-art" as keyof typeof doc.assets];
    expect(art?.kind).toBe("data-uri");
    expect((art as { uri: string }).uri.startsWith("data:image/svg+xml,")).toBe(true);
    // A real product shot replaces the bundled art on the same card.
    const shot = await render({ productImage: ["C:/shots/velvet-iris.png"] });
    expect(shot.assets["product-image" as keyof typeof shot.assets]?.kind).toBe("file");
    expect(shot.assets["product-art" as keyof typeof shot.assets]).toBeUndefined();
  });

  it("lets the platform knob pick the canvas a host seeds, without ever throwing from the hint", async () => {
    const hints = (props: PersonalOfferProps) => resolveTemplateOutputHints(PersonalOfferV1, { ...PersonalOfferV1.defaultProps, ...props });
    expect(hints({})).toMatchObject({ width: 1080, height: 1920, durationMs: 10_000 });
    for (const [key, dims] of Object.entries(OFFER_PLATFORMS)) {
      expect(hints({ platform: key })).toMatchObject(dims);
    }
    expect(hints({ platform: " Landscape " })).toMatchObject(OFFER_PLATFORMS.landscape);
    // Junk in the knob leaves the static hint standing; the render is where it is refused.
    expect(hints({ platform: "billboard" })).toMatchObject({ width: 1080, height: 1920 });
    await expect(render({ platform: "billboard" })).rejects.toThrow(/platform/);
    // The static hints equal the default platform, so a share link at defaults carries no canvas ask.
    expect(PersonalOfferV1.outputHints).toMatchObject(OFFER_PLATFORMS.story);
    // Each preset's canvas holds the layout contract.
    for (const dims of Object.values(OFFER_PLATFORMS)) {
      await sweepLayout((p, ctx) => PersonalOfferV1.render({ ...PersonalOfferV1.defaultProps, ...p }, ctx).then(asDocument), ID, {}, (w, h) => targetCtx(w, h), [[dims.width, dims.height]]);
    }
  }, 60_000);

  it("clears its safe minimum at its own hint and is deterministic", async () => {
    const doc = await render();
    const ev = evaluateM0(String(doc.m0), { width: 1080, height: 1920 });
    expect(ev.feasible && ev.meetsPrecision).toBe(true);
    expect(doc.durationMs).toBe(10_000);
    expect(await render()).toEqual(await render());
  });

  it("is the gate: a bad percent, colour, art or a second image is refused", async () => {
    expect(percentText(20)).toBe("20% OFF");
    await expect(render({ discountPercent: 0 })).rejects.toThrow(/discountPercent/);
    await expect(render({ discountPercent: 12.5 })).rejects.toThrow(/discountPercent/);
    await expect(render({ accent: "pink" })).rejects.toThrow(/#rrggbb/);
    await expect(render({ productArt: "candle" })).rejects.toThrow(/productArt/);
    await expect(render({ productImage: ["a.png", "b.png"] })).rejects.toThrow(/zero or one/);
    await expect(render({ customerName: "" })).rejects.toThrow(/customerName/);
    await expect(render({ durationSec: 3 })).rejects.toThrow(/durationSec/);
  });
});
