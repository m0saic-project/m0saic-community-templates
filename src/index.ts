import type { AnyMosaicTemplate } from "@m0saic/template-utils";

import { PUBLISHER_ENTRIES, PUBLISHER_IDS } from "./publishers";

export {
  requireTemplate,
  getTemplate,
  listRegisteredTemplateIds,
} from "@m0saic/template-utils";

export * from "./repo";
export { PUBLISHER_IDS } from "./publishers";
export type { PublisherModule } from "./publishers";
export { templateRegistry } from "./template-registry";
export type { CommunityTemplateRegistryEntry } from "./template-registry";

export type GetTemplatesOptions = {
  /**
   * Publisher handles to load (`"m0saic-dev"`; a leading `@` is tolerated).
   * Omit both fields to load every publisher. Unknown handles are ignored.
   */
  publishers?: string[];
  /**
   * Publisher-scoped pack keys, `"<publisher>/<pack>"` (e.g.
   * `"m0saic-dev/print"`). Union semantics with `publishers`: a template is
   * included when it matches either list.
   */
  packs?: string[];
};

/**
 * Selective template access — the loader-facing seam. Only the requested
 * publishers' modules are evaluated, so a host can load one publisher out of
 * many without paying for the rest; a publisher exposing per-pack thunks
 * (`PublisherModule.packs`) is evaluated per pack.
 */
export function getTemplates(opts?: GetTemplatesOptions): AnyMosaicTemplate[] {
  const wantedPublishers = (opts?.publishers ?? []).map((p) => p.replace(/^@/, ""));
  const wantedPacks = (opts?.packs ?? []).map((k) => k.replace(/^@/, ""));
  const selective = wantedPublishers.length > 0 || wantedPacks.length > 0;
  if (!selective) {
    return PUBLISHER_IDS.flatMap((id) => PUBLISHER_ENTRIES[id]().templates);
  }

  const out: AnyMosaicTemplate[] = [];
  const seen = new Set<string>();
  const push = (templates: AnyMosaicTemplate[]) => {
    for (const template of templates) {
      const id = String(template.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(template);
    }
  };

  for (const handle of PUBLISHER_IDS) {
    const packKeys = wantedPacks
      .filter((k) => k.startsWith(`${handle}/`))
      .map((k) => k.slice(handle.length + 1));
    const wholePublisher = wantedPublishers.includes(handle);
    if (!wholePublisher && packKeys.length === 0) continue;

    const mod = PUBLISHER_ENTRIES[handle]();
    if (wholePublisher) {
      push(mod.templates);
      continue;
    }
    for (const pack of packKeys) {
      const thunk = mod.packs?.[pack];
      if (thunk) {
        push(thunk());
      } else {
        push(
          mod.templates.filter((t) =>
            String(t.id).startsWith(`@${handle}/${pack}/`),
          ),
        );
      }
    }
  }
  return out;
}

/**
 * `templates` is the named export the platform's template-repo loader
 * picks up (see `loadTemplateRepoFromPath.ts`). Eager full list — hosts
 * that want per-publisher subsets call `getTemplates({ publishers })`.
 *
 * Importing this entry has NO registration side effects: the HOST decides
 * what to register (and under which origin) — the desktop loads this repo
 * through the external-repo pipeline with the community pin.
 */
export const templates: AnyMosaicTemplate[] = getTemplates();
