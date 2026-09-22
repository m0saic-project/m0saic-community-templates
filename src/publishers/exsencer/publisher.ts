import type { MosaicTemplatePublisherDescriptor } from "@m0saic/types";

/**
 * Your publisher descriptor. `id` is your handle: the first segment of every
 * template id you publish (without the leading `@`) and this folder's name
 * under `src/publishers/`. Handles matching /m0saic/i are reserved.
 */
export const publisher: MosaicTemplatePublisherDescriptor = {
  id: "exsencer",
  displayName: "exsencer",
  description: "Data and education cards.",
  entryModule: "./dist/publishers/exsencer/index.js",
};
