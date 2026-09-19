"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCommunityManifest = buildCommunityManifest;
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
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const types_1 = require("@m0saic/types");
const platform_1 = require("@m0saic/platform");
const template_registry_1 = require("./template-registry");
const repo_1 = require("./repo");
const publishers_1 = require("./publishers");
const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = repo_1.TEMPLATE_REPO.assets?.templatesDir ?? "assets/templates";
const ENTRY_MODULE = "./dist/index.js";
/* ── Helpers ─────────────────────────────────────────────── */
function encodeTemplateKey(templateKey) {
    return templateKey.replace(/\//g, "__");
}
function absFromRepo(relPath) {
    return path.join(ROOT, relPath);
}
function existsRepoRel(relPath) {
    return fs.existsSync(absFromRepo(relPath));
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
function ensurePreviewPathsExist(preview, templateKey) {
    if (!preview)
        return;
    const check = (p, field) => {
        if (!p)
            return;
        assert(existsRepoRel(p), `Template "${templateKey}" preview.${field} points to missing file: "${p}"`);
    };
    check(preview.image, "image");
    check(preview.video, "video");
    check(preview.poster, "poster");
}
function buildPreviewFromConvention(templateKey) {
    const encoded = encodeTemplateKey(templateKey);
    const baseDir = `${TEMPLATES_DIR}/${encoded}`;
    const image = `${baseDir}/preview.png`;
    const video = `${baseDir}/preview.mp4`;
    const poster = `${baseDir}/poster.png`;
    const preview = {};
    if (existsRepoRel(image))
        preview.image = image;
    if (existsRepoRel(video))
        preview.video = video;
    if (existsRepoRel(poster))
        preview.poster = poster;
    return preview.image || preview.video || preview.poster ? preview : undefined;
}
function mergePreview(explicit, fallback) {
    if (!explicit && !fallback)
        return undefined;
    const merged = {
        image: explicit?.image ?? fallback?.image,
        video: explicit?.video ?? fallback?.video,
        poster: explicit?.poster ?? fallback?.poster,
    };
    return merged.image || merged.video || merged.poster ? merged : undefined;
}
/* ── Build (pure — also consumed by the freshness test) ───── */
function buildCommunityManifest() {
    /* Validate registry shape + uniqueness. Slugs are unique per
     * (publisher, pack) — the npm-scope model, one level deeper than the
     * official repo's per-pack rule. */
    const seenSlugKeys = new Set();
    const seenTemplateIds = new Set();
    const seenExports = new Set();
    for (const entry of template_registry_1.templateRegistry) {
        assert(entry.slug, `Entry missing slug (exportName=${entry.exportName})`);
        assert(entry.templateId, `Entry "${entry.slug}" missing templateId`);
        const parsed = (0, platform_1.parseTemplateId)((0, types_1.asTemplateId)(entry.templateId));
        const publisherHandle = String(parsed.publisher).replace(/^@/, "");
        assert(publishers_1.PUBLISHER_IDS.includes(publisherHandle), `Entry "${entry.templateId}" is under publisher "@${publisherHandle}" ` +
            `but no such publisher exists in PUBLISHER_ENTRIES`);
        assert(entry.author === publisherHandle, `Entry "${entry.templateId}" author "${entry.author}" must equal its ` +
            `id's publisher handle "${publisherHandle}"`);
        const slugKey = `${publisherHandle}/${parsed.pack ?? ""}/${entry.slug}`;
        assert(!seenSlugKeys.has(slugKey), `Duplicate publisher/pack-scoped slug: "${slugKey}"`);
        seenSlugKeys.add(slugKey);
        assert(!seenTemplateIds.has(entry.templateId), `Duplicate templateId: "${entry.templateId}"`);
        seenTemplateIds.add(entry.templateId);
        assert(entry.exportName, `Entry "${entry.slug}" missing exportName`);
        assert(!seenExports.has(entry.exportName), `Duplicate exportName: "${entry.exportName}"`);
        seenExports.add(entry.exportName);
    }
    /* Registry ↔ exports must agree exactly. */
    const exportedIds = new Set();
    for (const handle of publishers_1.PUBLISHER_IDS) {
        for (const template of publishers_1.PUBLISHER_ENTRIES[handle]().templates) {
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
    const templates = template_registry_1.templateRegistry.map((entry) => {
        const templateKey = entry.templateId;
        ensurePreviewPathsExist(entry.preview, templateKey);
        const preview = mergePreview(entry.preview, buildPreviewFromConvention(templateKey));
        if (preview?.video && !preview.poster) {
            preview.poster = preview.video;
        }
        const parsed = (0, platform_1.parseTemplateId)((0, types_1.asTemplateId)(templateKey));
        const publisherHandle = String(parsed.publisher).replace(/^@/, "");
        return {
            slug: entry.slug,
            templateKey: (0, types_1.asTemplateId)(templateKey),
            title: entry.title,
            description: entry.description,
            tags: entry.tags,
            ...(parsed.pack ? { pack: parsed.pack } : {}),
            publisher: publisherHandle,
            author: entry.author,
            preview,
        };
    });
    /* Publisher descriptors, with per-publisher template counts. */
    const publishers = publishers_1.PUBLISHER_IDS.map((handle) => {
        const { publisher } = publishers_1.PUBLISHER_ENTRIES[handle]();
        assert(publisher?.id === handle, `Publisher module "${handle}" declares descriptor id "${publisher?.id}" ` +
            `— must equal its PUBLISHER_ENTRIES key`);
        return {
            ...publisher,
            templateCount: templates.filter((t) => t.publisher === handle).length,
        };
    });
    return {
        schemaVersion: 1,
        repo: repo_1.TEMPLATE_REPO,
        entryModule: ENTRY_MODULE,
        templates,
        ...(repo_1.TEMPLATE_PACKS.length ? { packs: repo_1.TEMPLATE_PACKS } : {}),
        publishers,
    };
}
/* ── Write (build-script entrypoint) ─────────────────────── */
if (require.main === module) {
    const manifest = buildCommunityManifest();
    const outPath = path.join(ROOT, "template-manifest.json");
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    const previewCount = manifest.templates.filter((t) => t.preview).length;
    console.log(`[gen-template-manifest] wrote ${path.relative(ROOT, outPath)} ` +
        `(${manifest.templates.length} templates, ${manifest.publishers?.length ?? 0} publishers, ` +
        `${previewCount} with preview assets)`);
}
