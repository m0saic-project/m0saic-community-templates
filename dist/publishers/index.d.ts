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
export declare const PUBLISHER_ENTRIES: Record<string, () => PublisherModule>;
/** All publisher handles shipped by this repo, in registration order. */
export declare const PUBLISHER_IDS: string[];
