/**
 * The repo's FRONT DOOR — `@m0saic-community/hello-world/v1`.
 *
 * Top-level on purpose. Every other template in this repo belongs to a
 * publisher and lives under `publishers/<handle>/templates/…`; this one
 * belongs to the REPO. It is the greeting the repo makes on a fresh install,
 * not something any contributor authored, so it sits beside `repo.ts` (which
 * names it) rather than inside somebody's namespace. `m0saic-dev` is the
 * founder's personal handle and the card was never his to sign.
 *
 * It still presents as a publisher module, because that is the seam
 * `PUBLISHER_ENTRIES` and the manifest generator read — a publisher handle
 * must exist for every id scope. The handle is the repo's own
 * (`m0saic-community`), and this file is the whole of it: one card, no packs.
 *
 * ⚠️ `@m0saic-community/` is a RESERVED namespace — one of the three the UI
 * gives official flair to. A host honours ids under it only when it has
 * granted this repo the namespace, which is gated on the ed25519 release
 * signature: see `COMMUNITY_TRUSTED_NAMESPACES` in `packages/cli/src/index.ts`
 * and `apps/mosaic/electron/communityRepo.js`. An unsigned checkout registers
 * nothing here, by design.
 */
import type { MosaicTemplatePublisherDescriptor } from "@m0saic/types";
/**
 * Publisher descriptor for the repo itself.
 *
 * `id` is the handle: the first segment of the front door's id without the
 * leading `@`. Unlike every other publisher it maps to no
 * `src/publishers/<handle>/` folder — `tools/check-deps.mjs` carves this one
 * handle out of the folder rule for exactly that reason.
 *
 * Member ids here are PACKLESS (`@m0saic-community/<slug>/vN`): the 3-segment
 * community shape `parseTemplateId` documents as first-class, and the shape
 * the built-in front door `@m0saic/hello-world/v1` already carries.
 */
export declare const publisher: MosaicTemplatePublisherDescriptor;
/** The one card. Deliberately not extensible: this handle owns the door. */
export declare const templates: import("@m0saic/types").MosaicTemplate<import("packages/template-utils/dist").HelloWorldProps, import("@m0saic/types").MosaicTemplateOutputs, import("@m0saic/types").MosaicTemplateUpstreamVariables, import("@m0saic/types").MosaicTemplateUpstreamData, import("@m0saic/types").MosaicTemplateSidecars>[];
export * from "./hello-world/v1";
