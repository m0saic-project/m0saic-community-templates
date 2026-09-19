import type { MosaicTemplatePackDescriptor, MosaicTemplateRepoDescriptor } from "@m0saic/types";
/**
 * Repo descriptor — embedded into `template-manifest.json` by the generator.
 *
 * `repoId` is the canonical single-segment repo scope (no slashes). Template
 * ids in this repo are PUBLISHER-scoped (`@<publisher>/<pack>/<slug>/vN`),
 * so the repoId is a repo identity for grouping/trust display, not an id
 * prefix.
 *
 * `homepage` is the public GitHub home (D2). It is DISPLAY, never trust: the
 * host stamps provenance from where it loaded the bytes, and the lookalike
 * classifier deliberately ignores homepage (every un-edited starter fork
 * carries one). Mirrors: `COMMUNITY_GITHUB_REPO_DEFAULT` in
 * apps/mosaic/electron/communityRepo.js and `PUBLIC_REPO` in
 * scripts/sync-community-templates.mjs.
 */
export declare const TEMPLATE_REPO: MosaicTemplateRepoDescriptor;
/**
 * Named packs in this repo. Pack ids match the `{pack}` segment of member
 * template ids and each descriptor carries its publisher handle — with
 * publisher-scoped ids, `(publisher, pack)` is the real grouping key; the
 * per-entry `publisher` manifest field disambiguates if two publishers ever
 * ship the same pack name.
 *
 * The front door (`@m0saic-community/hello-world/v1`) is PACKLESS and so has
 * no entry here — a one-card pack invented purely to satisfy the grammar is
 * a dead rail section. `parseTemplateId` treats the 3-segment shape as the
 * first-class community convention; the pack lint in `tools/check-deps.mjs`
 * skips packless ids for the same reason.
 *
 * `mermaid` has NO descriptor on purpose: the pack is DISCONNECTED in-tree
 * (2026-09-07, `@dagrejs/dagre`) and excluded from the public snapshot
 * (`EXCLUDED_PACKS` in `scripts/sync-community-templates.mjs`). An advertised
 * pack with zero members is a dead end in the browse rail. Restore this entry
 * in the same change that re-registers the pack.
 */
export declare const TEMPLATE_PACKS: MosaicTemplatePackDescriptor[];
export declare const repo: MosaicTemplateRepoDescriptor;
