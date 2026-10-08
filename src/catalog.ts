/**
 * This repo's catalog — the m0saic 0.3.1 template convention.
 *
 * A template's CODE declares what it IS; what DESCRIBES it (label,
 * description, tags, visibility, deprecation, and each prop's label / hint /
 * placeholder / order) lives in its catalog sidecar, `<name>.catalog.json`
 * beside the module — it may change after the code ships (the freeze hashes
 * code, never the sidecar). The build's first step
 * (tools/gen-template-catalog.mjs) gathers the sidecars into
 * `src/template-catalog.json` (imported here, under `rootDir: src`, so both
 * entries carry it) and the wire copy `template-catalog.json` beside
 * `template-manifest.json` (what hosts read from a checkout, signed with
 * each release).
 *
 * IMPORTING THIS DECLARES THE CATALOG — `./index`, `./web` and the manifest
 * generator import it FIRST, so every template is defined with its entry
 * applied before the definition-time conventions judge it: a sidecar-described
 * template (label, tags and prop placeholders in the sidecar, none in code)
 * would otherwise fail `browseSurface` / `defaultProps` at load, which is what
 * kept the first 0.3.1-style templates out of the pack (2026-10-06).
 *
 * The catalog binds to the ORIGIN that declares it: a host loading this repo
 * as an external source (Desktop's pinned community load, Mosaic Web's
 * community entry) must import the entry INSIDE its `withExternalTemplateOrigin`
 * scope so the declaration and the registrations share one origin.
 */
import { parseTemplateCatalogFile } from "@m0saic/platform";
import { declareTemplateCatalog, declareTemplateConventions } from "@m0saic/template-utils";
import { TEMPLATE_REPO } from "./repo";
import catalogJson from "./template-catalog.json";

const parsed = parseTemplateCatalogFile(catalogJson);

/** This repo's catalog, parsed (malformed fields dropped — see the problems). */
export const TEMPLATE_CATALOG = parsed.file;

/** What is wrong with the catalog as authored — the build's gather step fails on any. */
export const TEMPLATE_CATALOG_PROBLEMS: readonly string[] = parsed.problems;

declareTemplateCatalog(TEMPLATE_CATALOG.templates);
// …and the repo's conventions target (`TEMPLATE_REPO.conventions`, 0.3.1): the
// checks hold each template to the lower of its shipped line and this target.
declareTemplateConventions(TEMPLATE_REPO.conventions);
