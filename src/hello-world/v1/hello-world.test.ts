/**
 * The community repo's front door.
 *
 * The Community M mark is a MINT-TIME asset, so it is present in a released
 * checkout and absent in a fresh workspace. These tests must pass in BOTH
 * states — they pin the wiring and the fallback rule, never the picture.
 */
import type { MosaicDocument, MosaicEngineContext, MosaicSource } from "@m0saic/types";
import { validateM0String } from "@m0saic/dsl";
import { parseTemplateId } from "@m0saic/platform";
import { TEMPLATE_PACKS, TEMPLATE_REPO } from "../../repo";
import { templateRegistry } from "../../template-registry";
import {
  COMMUNITY_M_ASSET,
  COMMUNITY_M_AVAILABLE,
  COMMUNITY_M_PATH,
  CommunityHelloWorld,
  communityMark,
} from "./hello-world";

const ID = "@m0saic-community/hello-world/v1";

const ctxFor = (w: number, h: number): MosaicEngineContext => {
  const t = { width: w, height: h, fps: 30, durationMs: 2600 };
  return {
    mode: "render",
    target: t,
    output: { ...t, workspaceDir: "/tmp/community-hello-world-test" },
    media: {},
  } as unknown as MosaicEngineContext;
};

type Labelled = MosaicSource & { editor?: { label?: string } };
const allSources = (doc: MosaicDocument): Labelled[] => {
  const kids = (doc as unknown as { children?: Record<string, MosaicDocument> }).children ?? {};
  return [...(doc.sources as Labelled[]), ...Object.values(kids).flatMap((d) => d.sources as Labelled[])];
};
const cardOf = (doc: MosaicDocument) =>
  (doc as unknown as { children: Record<string, MosaicDocument> }).children.card;

describe("@m0saic-community/hello-world/v1 — the repo front door", () => {
  it("is the id the repo descriptor names as its front door", () => {
    expect(String(CommunityHelloWorld.id)).toBe(ID);
    expect(String(TEMPLATE_REPO.helloWorld)).toBe(ID);
  });

  it("has a registry entry, so the manifest carries it", () => {
    const entry = templateRegistry.find((e) => e.templateId === ID);
    expect(entry).toBeDefined();
    expect(entry!.exportName).toBe("CommunityHelloWorld");
    expect(entry!.author).toBe("m0saic-community");
  });

  /**
   * The front door is PACKLESS on purpose (`@<publisher>/<slug>/vN`) — the
   * 3-segment community shape, same as the built-in `@m0saic/hello-world/v1`.
   * A one-card pack invented to satisfy the grammar would be a dead rail
   * section, so the inverse is what gets pinned: no pack descriptor claims it.
   */
  it("is packless, and no pack descriptor claims it", () => {
    expect(parseTemplateId(ID).pack).toBeUndefined();
    expect(TEMPLATE_PACKS.map((p) => String(p.id))).not.toContain("brand");
  });

  it("renders valid, canonical m0 on wide and square canvases", async () => {
    for (const [w, h] of [[1920, 1080], [1080, 1080]] as const) {
      const doc = (await CommunityHelloWorld.render({}, ctxFor(w, h))) as MosaicDocument;
      expect(validateM0String(doc.m0).ok).toBe(true);
      expect(validateM0String(cardOf(doc).m0).ok).toBe(true);
    }
  });

  it("needs no props — the first render on a fresh install", async () => {
    const doc = (await CommunityHelloWorld.render({}, ctxFor(1920, 1080))) as MosaicDocument;
    expect(doc.kind).toBe("mosaic_document");
  });

  /**
   * THE contract: the mark is an override, never a dependency. Whichever
   * state this checkout is in, the card renders — with the Community M when
   * the mint baked one, with the brand M when it did not.
   */
  it("mark follows asset availability, and the card renders either way", async () => {
    expect(COMMUNITY_M_ASSET).toBe("community-m.png");
    expect(COMMUNITY_M_PATH.endsWith(COMMUNITY_M_ASSET)).toBe(true);
    expect(communityMark === undefined).toBe(!COMMUNITY_M_AVAILABLE);

    const doc = (await CommunityHelloWorld.render({}, ctxFor(1920, 1080))) as MosaicDocument;
    const mark = allSources(doc).find((s) => s.editor?.label === "mark") as
      | (Labelled & { assetId?: string })
      | undefined;
    expect(mark).toBeDefined();

    if (COMMUNITY_M_AVAILABLE) {
      // Baked: the image is the mark, and a bitmap never assembles.
      expect(mark!.type).toBe("media");
      expect(mark!.assetId).toBe("community_m");
      expect(Object.keys(cardOf(doc).assets)).toEqual(["community_m"]);
      expect(allSources(doc).some((s) => s.editor?.label === "mark-rects")).toBe(false);
    } else {
      // Not baked: the brand M, exactly as the core card draws it.
      expect(mark!.type).not.toBe("media");
      expect(cardOf(doc).assets).toEqual({});
    }
  });
});
