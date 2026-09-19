/**
 * Entry-contract tests for the community repo package: publisher-scoped id
 * grammar (BOTH shapes — packed `@<publisher>/<pack>/<slug>/vN` for
 * contributor templates, packless `@<publisher>/<slug>/vN` for the repo's own
 * front door), `getTemplates` selectivity, registry ↔ exports agreement, and the
 * (temporary, Phase-2-removed) import-side-effect registration the desktop
 * app currently relies on.
 */
import { asTemplateId } from "@m0saic/types";
import { parseTemplateId } from "@m0saic/platform";
import { listRegisteredTemplateIds } from "@m0saic/template-utils";

import { getTemplates, templates, PUBLISHER_IDS } from "./index";
import { templateRegistry } from "./template-registry";

/** The repo's own publisher handle — the front door, and nothing else. */
const REPO_OWN_HANDLE = "m0saic-community";

describe("community-templates entry contract", () => {
  it("ships at least one publisher and one template", () => {
    expect(PUBLISHER_IDS.length).toBeGreaterThan(0);
    expect(templates.length).toBeGreaterThan(0);
  });

  /**
   * Packs are how a CONTRIBUTOR's templates are grouped in the browse rail,
   * so every contributor template carries one. The repo's own handle carries
   * exactly the front door, which is repo furniture rather than a member of
   * any group — packless, like the built-in `@m0saic/hello-world/v1` it
   * mirrors. Asserted as an `iff` so neither side can drift alone: a packed
   * front door and a packless contributor template both fail here.
   */
  it("ids are publisher-scoped, and packed iff the publisher is not the repo", () => {
    for (const template of templates) {
      const parsed = parseTemplateId(asTemplateId(String(template.id)));
      const handle = String(parsed.publisher).replace(/^@/, "");
      expect(PUBLISHER_IDS).toContain(handle);
      // Never inside the reserved first-party namespace.
      expect(String(template.id).toLowerCase().startsWith("@m0saic/")).toBe(false);
      expect(parsed.version).toMatch(/^v\d+$/);
      expect(Boolean(parsed.pack)).toBe(handle !== REPO_OWN_HANDLE);
    }
  });

  it("the repo's own handle ships exactly the front door", () => {
    const own = getTemplates({ publishers: [REPO_OWN_HANDLE] }).map((t) => String(t.id));
    expect(own).toEqual(["@m0saic-community/hello-world/v1"]);
  });

  it("eager templates[] equals getTemplates() with no filter", () => {
    expect(templates.map((t) => t.id)).toEqual(getTemplates().map((t) => t.id));
  });

  it("getTemplates({ publishers }) selects by handle, tolerating a leading @", () => {
    const all = getTemplates().map((t) => String(t.id));
    expect(getTemplates({ publishers: ["m0saic-dev"] }).map((t) => String(t.id))).toEqual(
      all.filter((id) => id.startsWith("@m0saic-dev/")),
    );
    expect(getTemplates({ publishers: ["@m0saic-dev"] }).length).toBe(
      getTemplates({ publishers: ["m0saic-dev"] }).length,
    );
    expect(getTemplates({ publishers: ["no-such-publisher"] })).toEqual([]);
  });

  it("registry and exported templates agree exactly", () => {
    const exported = new Set(templates.map((t) => String(t.id)));
    const registered = new Set(templateRegistry.map((e) => e.templateId));
    expect(registered).toEqual(exported);
    for (const entry of templateRegistry) {
      const handle = String(
        parseTemplateId(asTemplateId(entry.templateId)).publisher,
      ).replace(/^@/, "");
      expect(entry.author).toBe(handle);
    }
  });

  // The host decides what to register: importing the entry must NOT touch
  // the global registry (registration happens via the external-repo load
  // path under the community origin pin).
  it("importing the entry registers nothing", () => {
    const registered = new Set(listRegisteredTemplateIds());
    for (const template of templates) {
      expect(registered.has(String(template.id))).toBe(false);
    }
  });

  it("getTemplates({ packs }) selects publisher-scoped packs", () => {
    const printOnly = getTemplates({ packs: ["m0saic-dev/print"] }).map((t) =>
      String(t.id),
    );
    expect(printOnly).toEqual(["@m0saic-dev/print/dvd-wrap/v1"]);
    // Union with publishers, no duplicates. Note BOTH publishers are needed
    // to cover everything: the front door belongs to no pack, so no set of
    // pack keys can ever reach it — that is the packless shape, not a gap.
    const union = getTemplates({
      publishers: ["m0saic-dev", REPO_OWN_HANDLE],
      packs: ["m0saic-dev/print"],
    });
    expect(union.length).toBe(getTemplates().length);
    expect(
      getTemplates({ publishers: ["m0saic-dev"] }).length,
    ).toBe(getTemplates().length - 1);
    expect(getTemplates({ packs: ["m0saic-dev/no-such-pack"] })).toEqual([]);
  });
});
