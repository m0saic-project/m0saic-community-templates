import type { MosaicTemplatePublisherDescriptor } from "@m0saic/types";
/**
 * Publisher descriptor for `m0saic-dev` — the m0saic founder's personal
 * publisher. Templates here are experiments and niche use cases that live
 * outside the official brand library.
 *
 * The `id` is the publisher handle: the first segment of every member
 * template id without the leading `@` (`@m0saic-dev/<pack>/<slug>/vN`),
 * and the directory name under `src/publishers/`.
 */
export declare const publisher: MosaicTemplatePublisherDescriptor;
