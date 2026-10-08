#!/usr/bin/env node
/**
 * Gather the catalog SIDECARS into template-catalog.json (0.3.1).
 *
 * Each template's catalog lives beside its code: `<name>.catalog.json` in the
 * template's own folder — label, tags, deprecation, prop copy: what may change
 * after the code ships (the freeze hashes code, never this). This writes the
 * wire copy, `template-catalog.json`, beside `template-manifest.json`: the file
 * hosts read, signed with each release. Never hand-edit it.
 *
 * Run:  node tools/gen-template-catalog.mjs   (the first build step)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { collectTemplateCatalog, serializeTemplateCatalog } = require("@m0saic/platform/template-repos");

const collected = collectTemplateCatalog(ROOT);
if (collected.problems.length) {
  console.error(`[gen-template-catalog] ✗ ${collected.problems.length} problem(s) in the catalog sidecars:`);
  for (const p of collected.problems) console.error(`    ${p}`);
  process.exit(1);
}
// Two copies, one text: `src/template-catalog.json` is what `src/catalog.ts`
// imports (under `rootDir: src`) so every entry declares the catalog at load;
// the root copy is the wire file hosts read from a checkout and the mint signs.
const text = serializeTemplateCatalog(collected.file);
fs.writeFileSync(path.join(ROOT, "src", "template-catalog.json"), text, "utf8");
fs.writeFileSync(path.join(ROOT, "template-catalog.json"), text, "utf8");
console.log(`[gen-template-catalog] wrote src/template-catalog.json + template-catalog.json (${collected.sidecars.length} sidecar(s))`);
