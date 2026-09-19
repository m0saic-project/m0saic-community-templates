import type { AnyMosaicTemplate } from "@m0saic/template-utils";
export { requireTemplate, getTemplate, listRegisteredTemplateIds, } from "@m0saic/template-utils";
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
export declare function getTemplates(opts?: GetTemplatesOptions): AnyMosaicTemplate[];
/**
 * `templates` is the named export the platform's template-repo loader
 * picks up (see `loadTemplateRepoFromPath.ts`). Eager full list — hosts
 * that want per-publisher subsets call `getTemplates({ publishers })`.
 *
 * Importing this entry has NO registration side effects: the HOST decides
 * what to register (and under which origin) — the desktop loads this repo
 * through the external-repo pipeline with the community pin.
 */
export declare const templates: AnyMosaicTemplate[];
