/**
 * Authoring registry for the community template repo.
 *
 * Each entry provides the metadata needed to generate template-manifest.json.
 * This is the single source of truth for browse metadata (title, description,
 * tags, preview paths, per-template author credit) for the community repo.
 * Mirrors `packages/templates/src/template-registry.ts`.
 *
 * ALL exported templates belong here — the manifest generator asserts the
 * registry and `getTemplates()` agree exactly.
 */
import type { MosaicTemplateRepoManifestEntry } from "@m0saic/types";
export type CommunityTemplateRegistryEntry = Omit<MosaicTemplateRepoManifestEntry, "templateKey"> & {
    /** The template's id field (= templateKey in manifest). */
    templateId: string;
    /** Named export from dist/index.js (must match barrel export). */
    exportName: string;
    /**
     * Publisher handle credited for the template. REQUIRED in the community
     * repo, and must equal the id's `@<publisher>` first segment (sans `@`).
     */
    author: string;
};
export declare const templateRegistry: CommunityTemplateRegistryEntry[];
