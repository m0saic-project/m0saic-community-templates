/**
 * Generate web-template-ids.json — the community template ids the BROWSER
 * entry (`./web`) carries.
 *
 * Usage:  node dist/gen-web-template-ids.js   (a build step, after the manifest)
 *
 * Self-contained port of `packages/templates/src/gen-web-template-ids.ts`,
 * kept as a copy on purpose (this package's other life is a standalone public
 * repo). One difference: the official entry REGISTERS at import and the
 * generator reads the registry; this package's entries never register (the
 * host does), so the list is read straight off the entry's `templates[]`.
 *
 * Consumers: the web app's asset copy step
 * (`apps/mosaic/web/scripts/copy-template-assets.js`) — a community id in this
 * file is web-runnable, so its preview assets and browse row are mirrored as
 * a live template rather than a Desktop-only card.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { WEB_ENTRY_MODULE, listWebTemplateIds } from "./web";

/** Package-root file the build writes; ships in the tarball and the snapshot. */
export const WEB_TEMPLATE_IDS_FILE = "web-template-ids.json";

const ROOT = path.resolve(__dirname, "..");

const ids = listWebTemplateIds();
if (ids.length === 0) {
  throw new Error("gen-web-template-ids: the browser entry carries no templates");
}

const outPath = path.join(ROOT, WEB_TEMPLATE_IDS_FILE);
fs.writeFileSync(
  outPath,
  JSON.stringify({ schemaVersion: 1, entryModule: WEB_ENTRY_MODULE, ids }, null, 2) + "\n",
  "utf8",
);
console.log(`Wrote ${outPath} (${ids.length} template ids)`);
