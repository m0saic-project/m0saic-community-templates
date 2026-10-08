import "./catalog";
import type { AnyMosaicTemplate } from "@m0saic/template-utils";
export { TEMPLATE_PACKS, TEMPLATE_REPO, repo } from "./repo";
/** The built entry's path from the package root — what the manifest-style
 *  `web-template-ids.json` names, for parity with the official pack. */
export declare const WEB_ENTRY_MODULE = "./dist/web.js";
/**
 * Every community template Mosaic Web can run, in stable order. A subset of
 * the node entry's `templates` (asserted by the sibling test): a template on
 * the web is always also a Desktop template, never the reverse.
 */
export declare const templates: AnyMosaicTemplate[];
/** The ids above, sorted — what `web-template-ids.json` carries. */
export declare function listWebTemplateIds(): string[];
