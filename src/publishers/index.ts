import type { AnyMosaicTemplate } from "@m0saic/template-utils";
import type { MosaicTemplatePublisherDescriptor } from "@m0saic/types";

/** What each publisher module exports (see `_PUBLISHER_STARTER/`). */
export type PublisherModule = {
  publisher: MosaicTemplatePublisherDescriptor;
  templates: AnyMosaicTemplate[];
  /**
   * OPTIONAL per-pack thunks (`pack id → templates`), for publishers large
   * enough that evaluating all their packs to serve one is a real cost.
   * When present, `getTemplates({ packs })` prefers these over filtering
   * the flat `templates` array. Small publishers omit it.
   */
  packs?: Record<string, () => AnyMosaicTemplate[]>;
};

/**
 * Publisher table. Each entry lazily requires its publisher module so hosts
 * can load a SUBSET of publishers without evaluating the rest — the
 * selective-loading seam behind `getTemplates({ publishers })` in
 * `../index.ts`.
 *
 * Adding a publisher: copy `src/_PUBLISHER_STARTER/` to
 * `src/publishers/<your-handle>/` and add one line here.
 */
export const PUBLISHER_ENTRIES: Record<string, () => PublisherModule> = {
  // Inline require is deliberate: lazy per-publisher evaluation IS the point —
  // a top-of-file import would evaluate every publisher on entry load.
  "m0saic-dev": () => require("./m0saic-dev") as PublisherModule,
  "exsencer": () => require("./exsencer") as PublisherModule,
  // The repo's OWN handle — the front door, which lives top-level at
  // `src/front-door.ts` rather than under a publisher folder. See its
  // docblock: the greeting belongs to the repo, not to a contributor.
  "m0saic-community": () => require("../front-door") as PublisherModule,
};

/** All publisher handles shipped by this repo, in registration order. */
export const PUBLISHER_IDS: string[] = Object.keys(PUBLISHER_ENTRIES);
