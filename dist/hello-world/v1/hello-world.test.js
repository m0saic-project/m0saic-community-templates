"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dsl_1 = require("@m0saic/dsl");
const platform_1 = require("@m0saic/platform");
const repo_1 = require("../../repo");
const template_registry_1 = require("../../template-registry");
const hello_world_1 = require("./hello-world");
const ID = "@m0saic-community/hello-world/v1";
const ctxFor = (w, h) => {
    const t = { width: w, height: h, fps: 30, durationMs: 2600 };
    return {
        mode: "render",
        target: t,
        output: { ...t, workspaceDir: "/tmp/community-hello-world-test" },
        media: {},
    };
};
const allSources = (doc) => {
    const kids = doc.children ?? {};
    return [...doc.sources, ...Object.values(kids).flatMap((d) => d.sources)];
};
const cardOf = (doc) => doc.children.card;
describe("@m0saic-community/hello-world/v1 — the repo front door", () => {
    it("is the id the repo descriptor names as its front door", () => {
        expect(String(hello_world_1.CommunityHelloWorld.id)).toBe(ID);
        expect(String(repo_1.TEMPLATE_REPO.helloWorld)).toBe(ID);
    });
    it("has a registry entry, so the manifest carries it", () => {
        const entry = template_registry_1.templateRegistry.find((e) => e.templateId === ID);
        expect(entry).toBeDefined();
        expect(entry.exportName).toBe("CommunityHelloWorld");
        expect(entry.author).toBe("m0saic-community");
    });
    /**
     * The front door is PACKLESS on purpose (`@<publisher>/<slug>/vN`) — the
     * 3-segment community shape, same as the built-in `@m0saic/hello-world/v1`.
     * A one-card pack invented to satisfy the grammar would be a dead rail
     * section, so the inverse is what gets pinned: no pack descriptor claims it.
     */
    it("is packless, and no pack descriptor claims it", () => {
        expect((0, platform_1.parseTemplateId)(ID).pack).toBeUndefined();
        expect(repo_1.TEMPLATE_PACKS.map((p) => String(p.id))).not.toContain("brand");
    });
    it("renders valid, canonical m0 on wide and square canvases", async () => {
        for (const [w, h] of [[1920, 1080], [1080, 1080]]) {
            const doc = (await hello_world_1.CommunityHelloWorld.render({}, ctxFor(w, h)));
            expect((0, dsl_1.validateM0String)(doc.m0).ok).toBe(true);
            expect((0, dsl_1.validateM0String)(cardOf(doc).m0).ok).toBe(true);
        }
    });
    it("needs no props — the first render on a fresh install", async () => {
        const doc = (await hello_world_1.CommunityHelloWorld.render({}, ctxFor(1920, 1080)));
        expect(doc.kind).toBe("mosaic_document");
    });
    /**
     * THE contract: the mark is an override, never a dependency. Whichever
     * state this checkout is in, the card renders — with the Community M when
     * the mint baked one, with the brand M when it did not.
     */
    it("mark follows asset availability, and the card renders either way", async () => {
        expect(hello_world_1.COMMUNITY_M_ASSET).toBe("community-m.png");
        expect(hello_world_1.COMMUNITY_M_PATH.endsWith(hello_world_1.COMMUNITY_M_ASSET)).toBe(true);
        expect(hello_world_1.communityMark === undefined).toBe(!hello_world_1.COMMUNITY_M_AVAILABLE);
        const doc = (await hello_world_1.CommunityHelloWorld.render({}, ctxFor(1920, 1080)));
        const mark = allSources(doc).find((s) => s.editor?.label === "mark");
        expect(mark).toBeDefined();
        if (hello_world_1.COMMUNITY_M_AVAILABLE) {
            // Baked: the image is the mark, and a bitmap never assembles.
            expect(mark.type).toBe("media");
            expect(mark.assetId).toBe("community_m");
            expect(Object.keys(cardOf(doc).assets)).toEqual(["community_m"]);
            expect(allSources(doc).some((s) => s.editor?.label === "mark-rects")).toBe(false);
        }
        else {
            // Not baked: the brand M, exactly as the core card draws it.
            expect(mark.type).not.toBe("media");
            expect(cardOf(doc).assets).toEqual({});
        }
    });
});
