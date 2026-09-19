#!/usr/bin/env node
/**
 * Community-repo policy gate — dependency allowlist + publisher lint.
 * Pure Node (no packages), so it runs in the public repo's CI before the
 * @m0saic substrate is installable from npm.
 *
 * Checks:
 *  1. package.json dependencies ⊆ dep-allowlist.json packages.
 *  2. Every import/require specifier in runtime source (src/**, tests
 *     excluded) is relative, an allowlisted package (subpaths included), an
 *     allowlisted builtin, or covered by a per-file exception.
 *  3. Publisher lint over template-manifest.json: every entry's publisher
 *     matches its templateKey's `@<handle>` scope, maps to an existing
 *     src/publishers/<handle>/ folder, and no handle matches /m0saic/i
 *     except the founder's `m0saic-dev` and the repo's own
 *     `m0saic-community` (see REPO_OWN_HANDLE).
 *  4. Pack lint: manifest.packs[] and the packs templates actually belong
 *     to agree both ways — no empty pack, no undescribed pack. Packless
 *     3-segment ids declare no pack and are skipped.
 *  5. NOTICE.md exists (third-party attribution record).
 *
 * Exit 0 = clean; exit 1 with a report otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

/**
 * The repo's OWN publisher handle — the front door, and nothing else.
 *
 * It is exempt from two rules below, both of which exist to police
 * CONTRIBUTOR publishers:
 *
 *  - the `src/publishers/<handle>/` folder rule: the front door is repo
 *    furniture and lives top-level at `src/front-door.ts` + `src/hello-world/`,
 *    beside `repo.ts` which names it, rather than inside a publisher namespace.
 *  - the `/m0saic/i` handle reservation: the point of that rule is that no
 *    contributor may wear an official-looking handle. The repo wearing its own
 *    is the one legitimate case, and it is gated upstream by the ed25519
 *    release signature (`COMMUNITY_TRUSTED_NAMESPACES`), not by this lint.
 *
 * Exactly one handle, matched exactly — a prefix or regex here would hand the
 * exemption to `m0saic-community-plugins` and friends.
 */
const REPO_OWN_HANDLE = "m0saic-community";

function fail(msg) {
  problems.push(msg);
}

const allowlist = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dep-allowlist.json"), "utf8"),
);
const allowedPackages = allowlist.packages ?? [];
const allowedBuiltins = new Set(allowlist.builtins ?? []);
const exceptions = new Map(
  (allowlist.exceptions ?? []).map((e) => [e.file, new Set(e.allow ?? [])]),
);

/* ── 1. package.json dependencies ─────────────────────────── */

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (!allowedPackages.includes(dep)) {
    fail(`package.json dependency "${dep}" is not in dep-allowlist.json`);
  }
}

/* ── 2. import scan over runtime source ───────────────────── */

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const IMPORT_RE =
  /(?:from\s+|import\s*\(\s*|require(?:\.resolve)?\s*\(\s*)["']([^"']+)["']/g;

function isAllowedPackage(spec) {
  return allowedPackages.some(
    (p) => spec === p || spec.startsWith(`${p}/`),
  );
}

const srcDir = path.join(ROOT, "src");
for (const file of walk(srcDir)) {
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
  if (/\.test\.tsx?$/.test(file)) continue; // policy targets runtime code
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const fileExceptions = exceptions.get(rel) ?? new Set();
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (spec.startsWith(".")) continue;
    if (allowedBuiltins.has(spec)) continue;
    if (isAllowedPackage(spec)) continue;
    if (fileExceptions.has(spec)) continue;
    fail(
      `${rel}: imports "${spec}" — not allowlisted (dep-allowlist.json) and no exception covers it`,
    );
  }
}

/* ── 3. publisher lint (manifest-driven) ──────────────────── */

const manifestPath = path.join(ROOT, "template-manifest.json");
if (!fs.existsSync(manifestPath)) {
  fail("template-manifest.json missing — run the build");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const publishersDir = path.join(ROOT, "src", "publishers");
  const handleDirs = fs.existsSync(publishersDir)
    ? fs
        .readdirSync(publishersDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
        .map((e) => e.name)
    : [];

  const declared = new Set((manifest.publishers ?? []).map((p) => p.id));
  for (const dir of handleDirs) {
    if (!declared.has(dir)) {
      fail(`src/publishers/${dir}/ has no descriptor in manifest.publishers[]`);
    }
  }

  for (const entry of manifest.templates ?? []) {
    const key = String(entry.templateKey ?? "");
    const m = /^@([^/]+)\//.exec(key);
    const handle = m ? m[1] : null;
    if (!handle) {
      fail(`manifest entry "${key}" has no @<publisher>/ scope`);
      continue;
    }
    if (entry.publisher !== handle) {
      fail(
        `manifest entry "${key}": publisher "${entry.publisher}" != id scope "@${handle}"`,
      );
    }
    if (handle !== REPO_OWN_HANDLE && !handleDirs.includes(handle)) {
      fail(`manifest entry "${key}": no src/publishers/${handle}/ folder`);
    }
    if (/m0saic/i.test(handle) && handle !== "m0saic-dev" && handle !== REPO_OWN_HANDLE) {
      fail(
        `manifest entry "${key}": handle "@${handle}" is reserved (matches /m0saic/i)`,
      );
    }
  }
}

/* ── 4. pack lint (manifest-driven) ───────────────────────── */

// Packs and templates must agree BOTH ways. An advertised pack with no
// members is a dead end in the browse rail; a pack of templates with no
// descriptor shows up unlabelled. Both are silent until someone opens the
// UI, so the gate is the only place they get caught.
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const packsWithTemplates = new Map();
  for (const entry of manifest.templates ?? []) {
    // Packed `@<publisher>/<pack>/<slug>/vN` vs packless `@<publisher>/<slug>/vN`.
    // Segment COUNT is the only thing that tells them apart, so match the whole
    // key: a `/^@([^/]+)\/([^/]+)\//` prefix reads a packless id's SLUG as its
    // pack and invents a phantom pack that no descriptor can ever satisfy.
    // The manifest generator already omits `pack` for these (`parseTemplateId`
    // treats the 3-segment shape as the first-class community convention), so
    // trust the emitted field and only fall back to parsing when it is absent.
    const key = String(entry.templateKey ?? "");
    const m = /^@([^/]+)\/([^/]+)\/[^/]+\/[^/]+$/.exec(key);
    const handle = m ? m[1] : /^@([^/]+)\//.exec(key)?.[1];
    const pack = entry.pack ?? (m ? m[2] : undefined);
    if (!handle || !pack) continue;
    if (!packsWithTemplates.has(pack)) packsWithTemplates.set(pack, handle);
  }
  const declaredPacks = new Set((manifest.packs ?? []).map((p) => p.id));

  for (const pack of declaredPacks) {
    if (!packsWithTemplates.has(pack)) {
      fail(
        `pack "${pack}" is declared in manifest.packs[] but no template belongs to it — ` +
          `drop the descriptor or register a template`,
      );
    }
  }
  for (const [pack, handle] of packsWithTemplates) {
    if (!declaredPacks.has(pack)) {
      fail(
        `pack "${pack}" has templates (@${handle}/${pack}/…) but no descriptor in manifest.packs[] — ` +
          `add one to TEMPLATE_PACKS in src/repo.ts`,
      );
    }
  }
}

/* ── 5. attribution notice ────────────────────────────────── */

if (!fs.existsSync(path.join(ROOT, "NOTICE.md"))) {
  fail("NOTICE.md missing (third-party attribution record)");
}

/* ── Report ───────────────────────────────────────────────── */

if (problems.length > 0) {
  console.error(`check-deps: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("check-deps: clean (dependencies, imports, publishers, packs, notices)");
