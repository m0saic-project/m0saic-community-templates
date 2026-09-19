/**
 * Generate template-manifest.json from the community authoring registry.
 *
 * Usage:  node dist/gen-template-manifest.js
 *
 * Self-contained port of `packages/templates/src/gen-template-manifest.ts`
 * (kept as a copy on purpose — this package's future life is a standalone
 * public repo). Differences from the official generator:
 *   - multi-publisher aware: emits `manifest.publishers[]` and a per-entry
 *     `publisher` field, and asserts every registry entry lives inside a
 *     declared publisher's `@<handle>/` namespace with a matching `author`;
 *   - asserts the registry and the exported templates agree exactly, so a
 *     template can't ship unregistered (or vice versa).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import type {
  MosaicTemplatePublisherDescriptor,
  MosaicTemplateRepoManifest,
  MosaicTemplateRepoManifestEntry,
} from "@m0saic/types";
import { asTemplateId } from "@m0saic/types";
import { parseTemplateId } from "@m0saic/platform";

import { templateRegistry } from "./template-registry";
import { TEMPLATE_REPO, TEMPLATE_PACKS } from "./repo";
import { PUBLISHER_ENTRIES, PUBLISHER_IDS } from "./publishers";

const ROOT = path.resolve(__dirname, "..");

const TEMPLATES_DIR = TEMPLATE_REPO.assets?.templatesDir ?? "assets/templates";
const ENTRY_MODULE = "./dist/index.js";

/* ── Helpers ─────────────────────────────────────────────── */

function encodeTemplateKey(templateKey: string): string {
  return templateKey.replace(/\//g, "__");
}

function absFromRepo(relPath: string): string {
  return path.join(ROOT, relPath);
}

function existsRepoRel(relPath: string): boolean {
  return fs.existsSync(absFromRepo(relPath));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function ensurePreviewPathsExist(
  preview: MosaicTemplateRepoManifestEntry["preview"] | undefined,
  templateKey: string,
) {
  if (!preview) return;
  const check = (p: string | undefined, field: string) => {
    if (!p) return;
    assert(
      existsRepoRel(p),
      `Template "${templateKey}" preview.${field} points to missing file: "${p}"`,
    );
  };
  check(preview.image, "image");
  check(preview.video, "video");
  check(preview.poster, "poster");
}

function buildPreviewFromConvention(
  templateKey: string,
): MosaicTemplateRepoManifestEntry["preview"] | undefined {
  const encoded = encodeTemplateKey(templateKey);
  const baseDir = `${TEMPLATES_DIR}/${encoded}`;

  const image = `${baseDir}/preview.png`;
  const video = `${baseDir}/preview.mp4`;
  const poster = `${baseDir}/poster.png`;

  const preview: NonNullable<MosaicTemplateRepoManifestEntry["preview"]> = {};
  if (existsRepoRel(image)) preview.image = image;
  if (existsRepoRel(video)) preview.video = video;
  if (existsRepoRel(poster)) preview.poster = poster;

  return preview.image || preview.video || preview.poster ? preview : undefined;
}

function mergePreview(
  explicit: MosaicTemplateRepoManifestEntry["preview"] | undefined,
  fallback: MosaicTemplateRepoManifestEntry["preview"] | undefined,
): MosaicTemplateRepoManifestEntry["preview"] | undefined {
  if (!explicit && !fallback) return undefined;
  const merged = {
    image: explicit?.image ?? fallback?.image,
    video: explicit?.video ?? fallback?.video,
    poster: explicit?.poster ?? fallback?.poster,
  };
  return merged.image || merged.video || merged.poster ? merged : undefined;
}

/* ── Build (pure — also consumed by the freshness test) ───── */

export function buildCommunityManifest(): MosaicTemplateRepoManifest {
  /* Validate registry shape + uniqueness. Slugs are unique per
   * (publisher, pack) — the npm-scope model, one level deeper than the
   * official repo's per-pack rule. */
  const seenSlugKeys = new Set<string>();
  const seenTemplateIds = new Set<string>();
  const seenExports = new Set<string>();

  for (const entry of templateRegistry) {
    assert(entry.slug, `Entry missing slug (exportName=${entry.exportName})`);
    assert(entry.templateId, `Entry "${entry.slug}" missing templateId`);

    const parsed = parseTemplateId(asTemplateId(entry.templateId));
    const publisherHandle = String(parsed.publisher).replace(/^@/, "");
    assert(
      PUBLISHER_IDS.includes(publisherHandle),
      `Entry "${entry.templateId}" is under publisher "@${publisherHandle}" ` +
        `but no such publisher exists in PUBLISHER_ENTRIES`,
    );
    assert(
      entry.author === publisherHandle,
      `Entry "${entry.templateId}" author "${entry.author}" must equal its ` +
        `id's publisher handle "${publisherHandle}"`,
    );

    const slugKey = `${publisherHandle}/${parsed.pack ?? ""}/${entry.slug}`;
    assert(!seenSlugKeys.has(slugKey), `Duplicate publisher/pack-scoped slug: "${slugKey}"`);
    seenSlugKeys.add(slugKey);

    assert(
      !seenTemplateIds.has(entry.templateId),
      `Duplicate templateId: "${entry.templateId}"`,
    );
    seenTemplateIds.add(entry.templateId);

    assert(entry.exportName, `Entry "${entry.slug}" missing exportName`);
    assert(!seenExports.has(entry.exportName), `Duplicate exportName: "${entry.exportName}"`);
    seenExports.add(entry.exportName);
  }

  /* Registry ↔ exports must agree exactly. */
  const exportedIds = new Set<string>();
  for (const handle of PUBLISHER_IDS) {
    for (const template of PUBLISHER_ENTRIES[handle]().templates) {
      exportedIds.add(String(template.id));
    }
  }
  for (const id of seenTemplateIds) {
    assert(exportedIds.has(id), `Registry entry "${id}" has no exported template`);
  }
  for (const id of exportedIds) {
    assert(seenTemplateIds.has(id), `Exported template "${id}" has no registry entry`);
  }

  /* Manifest entries. */
  const templates: MosaicTemplateRepoManifestEntry[] = templateRegistry.map(
    (entry): MosaicTemplateRepoManifestEntry => {
      const templateKey = entry.templateId;

      ensurePreviewPathsExist(entry.preview, templateKey);
      const preview = mergePreview(
        entry.preview,
        buildPreviewFromConvention(templateKey),
      );
      if (preview?.video && !preview.poster) {
        preview.poster = preview.video;
      }

      const parsed = parseTemplateId(asTemplateId(templateKey));
      const publisherHandle = String(parsed.publisher).replace(/^@/, "");

      return {
        slug: entry.slug,
        templateKey: asTemplateId(templateKey),
        title: entry.title,
        description: entry.description,
        tags: entry.tags,
        ...(parsed.pack ? { pack: parsed.pack } : {}),
        publisher: publisherHandle,
        author: entry.author,
        preview,
      };
    },
  );

  /* Publisher descriptors, with per-publisher template counts. */
  const publishers: MosaicTemplatePublisherDescriptor[] = PUBLISHER_IDS.map(
    (handle) => {
      const { publisher } = PUBLISHER_ENTRIES[handle]();
      assert(
        publisher?.id === handle,
        `Publisher module "${handle}" declares descriptor id "${publisher?.id}" ` +
          `— must equal its PUBLISHER_ENTRIES key`,
      );
      return {
        ...publisher,
        templateCount: templates.filter((t) => t.publisher === handle).length,
      };
    },
  );

  return {
    schemaVersion: 1,
    repo: TEMPLATE_REPO,
    entryModule: ENTRY_MODULE,
    templates,
    ...(TEMPLATE_PACKS.length ? { packs: TEMPLATE_PACKS } : {}),
    publishers,
  };
}

/* ── Write (build-script entrypoint) ─────────────────────── */

if (require.main === module) {
  const manifest = buildCommunityManifest();
  const outPath = path.join(ROOT, "template-manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const previewCount = manifest.templates.filter((t) => t.preview).length;
  console.log(
    `[gen-template-manifest] wrote ${path.relative(ROOT, outPath)} ` +
      `(${manifest.templates.length} templates, ${manifest.publishers?.length ?? 0} publishers, ` +
      `${previewCount} with preview assets)`,
  );
}
