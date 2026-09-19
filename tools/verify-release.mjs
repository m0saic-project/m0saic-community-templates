#!/usr/bin/env node
/**
 * verify-release — is this checkout a signed m0saic community release?
 *
 * Node built-ins only (crypto, fs, path, child_process). This file ships in
 * the public repo and runs in its CI, where the @m0saic substrate is not
 * installable — so it cannot import `@m0saic/product`, the module that
 * defines the release format for the CLI and Mosaic Desktop. It is a PORT of
 * that module's `verifyCommunityRelease`: the same tree listing, the same
 * hash, the same signed payload, the same refuse ladder, the same reason and
 * detail strings. A monorepo test (`scripts/verify-release.parity.test.mjs`)
 * asserts the two agree on every accept and refuse path, and the mint script
 * runs both against every signed snapshot — two implementations of one
 * algorithm without a parity check is how a verifier silently fails open.
 *
 * What is verified (the format, restated so this file stands alone):
 *
 *   release.json  { schemaVersion: 1, tag, publishedAt, treeSha256,
 *                   signature: { kid, alg: "ed25519", sig: <base64url> } }
 *
 *   Tree listing: every file under dist/** plus template-manifest.json and
 *   package.json, sorted by POSIX-relative path in plain code-unit order, one
 *   line per file: "<path>\0<sha256>\n". JSON files hash on their CANONICAL
 *   form (JSON.stringify(JSON.parse(text))) so a CRLF or re-indented checkout
 *   still verifies; every other file hashes as raw bytes.
 *
 *   Payload: "m0saic-community-release/v1\n<tag>\n<publishedAt>\n<treeSha256>\n",
 *   ed25519-signed by the private key whose public half is keys/<kid>.public.pem.
 *
 *   Fail-closed structure: a symlink anywhere in the signed roots (or at the
 *   checkout root), any non-regular entry (FIFO, socket, device), or a
 *   node_modules by any capitalisation at the root or under dist/ is REFUSED,
 *   never skipped — checked after the signature and before the hash, so
 *   "tree-mismatch" always means an authentic release whose files changed.
 *
 * What this proves, and what it does not: the public keys are committed in
 * this same repo, so CI verifying against them proves the tree on `main` is
 * exactly a tree the key holder signed — a merged PR or a hand edit that
 * touched dist/ turns CI red. It does not by itself prove the key is
 * m0saic's; the CLI and Desktop carry their own embedded copy of the same
 * public keys, and THAT is what grants the reserved namespaces to a checkout.
 *
 * Usage:
 *   node tools/verify-release.mjs [--repo <dir>] [--keys <dir>]
 *                                 [--require-tag] [--json]
 *
 *   --repo         the checkout to verify (default: this repo's root).
 *   --keys         public-key directory, relative to the repo (default: keys/).
 *   --require-tag  also require release.json's tag to exist as a git tag in
 *                  the checkout (CI on a tag push; needs a full clone).
 *   --json         one machine-readable result object instead of prose.
 *
 * Exit 0 when the release verifies (and the tag exists, when required); 1 otherwise.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RELEASE_FILE = "release.json";
export const SIGNED_DIR = "dist";
export const SIGNED_FILES = ["template-manifest.json", "package.json"];
export const PAYLOAD_PREFIX = "m0saic-community-release/v1";
export const SCHEMA_VERSION = 1;
export const KEYS_DIR = "keys";
export const PUBLIC_KEY_SUFFIX = ".public.pem";

const HEX_SHA256 = /^[0-9a-f]{64}$/;
const TAG_PATTERN = /^[A-Za-z0-9][\w.-]*$/;
const PUBLISHED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const FOREIGN_MODULES_DIR = "node_modules";
// Built at runtime rather than written as an escape: a `﻿` literal in
// source is exactly what some editors and tools rewrite.
const BOM = String.fromCharCode(0xfeff);

const stripBom = (text) => (text.startsWith(BOM) ? text.slice(1) : text);
const isForeignModulesName = (name) => name.toLowerCase() === FOREIGN_MODULES_DIR;
const sha256Hex = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Thrown by the hasher for an entry the listing cannot represent. */
export class TreeError extends Error {
  constructor(problem) {
    super(`release tree would not verify (${problem.reason}: ${problem.detail})`);
    this.name = "TreeError";
    this.problem = problem;
  }
}

export function hashReleaseFile(absPath) {
  const bytes = fs.readFileSync(absPath);
  if (absPath.toLowerCase().endsWith(".json")) {
    try {
      return sha256Hex(JSON.stringify(JSON.parse(stripBom(bytes.toString("utf8")))));
    } catch {
      /* fall through to raw bytes */
    }
  }
  return sha256Hex(bytes);
}

function sortedEntries(absDir) {
  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    entries.sort((a, b) => byCodeUnit(a.name, b.name));
    return entries;
  } catch {
    return null;
  }
}

function direntKind(ent) {
  if (ent.isSymbolicLink()) return "symlink";
  if (ent.isDirectory()) return "dir";
  if (ent.isFile()) return "file";
  return "special";
}

function lstatKind(abs) {
  try {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) return "symlink";
    if (st.isDirectory()) return "dir";
    if (st.isFile()) return "file";
    return "special";
  } catch {
    return "missing";
  }
}

function walkFiles(absDir, relDir, out) {
  const entries = sortedEntries(absDir);
  if (!entries) return;
  for (const ent of entries) {
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    switch (direntKind(ent)) {
      case "symlink":
        break;
      case "dir":
        walkFiles(path.join(absDir, ent.name), rel, out);
        break;
      case "file":
        out.push(rel);
        break;
      default:
        throw new TreeError({ reason: "special-file-in-tree", detail: rel });
    }
  }
}

function findTreeProblem(absDir, relDir) {
  const entries = sortedEntries(absDir);
  if (!entries) return null;
  for (const ent of entries) {
    const rel = `${relDir}/${ent.name}`;
    switch (direntKind(ent)) {
      case "symlink":
        return { reason: "symlink-in-tree", detail: rel };
      case "special":
        return { reason: "special-file-in-tree", detail: rel };
      case "file":
        break;
      default: {
        if (isForeignModulesName(ent.name)) return { reason: "foreign-modules", detail: rel };
        const nested = findTreeProblem(path.join(absDir, ent.name), rel);
        if (nested) return nested;
      }
    }
  }
  return null;
}

/** First structural problem in the checkout, or null. Never throws. */
export function inspectTree(repoDir) {
  const rootEntries = sortedEntries(repoDir);
  if (rootEntries) {
    for (const ent of rootEntries) {
      const kind = direntKind(ent);
      if (kind === "symlink") return { reason: "symlink-in-tree", detail: ent.name };
      if (kind === "special") return { reason: "special-file-in-tree", detail: ent.name };
      if (kind === "dir" && isForeignModulesName(ent.name)) return { reason: "foreign-modules", detail: ent.name };
    }
  }
  const distKind = lstatKind(path.join(repoDir, SIGNED_DIR));
  if (distKind === "symlink") return { reason: "symlink-in-tree", detail: SIGNED_DIR };
  if (distKind === "special") return { reason: "special-file-in-tree", detail: SIGNED_DIR };
  if (distKind === "dir") {
    const problem = findTreeProblem(path.join(repoDir, SIGNED_DIR), SIGNED_DIR);
    if (problem) return problem;
  }
  for (const f of SIGNED_FILES) {
    const kind = lstatKind(path.join(repoDir, f));
    if (kind === "symlink") return { reason: "symlink-in-tree", detail: f };
    if (kind === "special") return { reason: "special-file-in-tree", detail: f };
  }
  return null;
}

/** Sorted `{ path, sha256 }` for every file the signature covers. Throws TreeError. */
export function listTree(repoDir) {
  const rels = [];
  const distAbs = path.join(repoDir, SIGNED_DIR);
  const distKind = lstatKind(distAbs);
  if (distKind === "special") throw new TreeError({ reason: "special-file-in-tree", detail: SIGNED_DIR });
  if (distKind === "dir") walkFiles(distAbs, SIGNED_DIR, rels);
  for (const f of SIGNED_FILES) {
    const kind = lstatKind(path.join(repoDir, f));
    if (kind === "special") throw new TreeError({ reason: "special-file-in-tree", detail: f });
    if (kind === "file") rels.push(f);
  }
  rels.sort(byCodeUnit);
  return rels.map((rel) => ({ path: rel, sha256: hashReleaseFile(path.join(repoDir, ...rel.split("/"))) }));
}

export function buildTreeListing(repoDir) {
  return listTree(repoDir).map((e) => `${e.path}\0${e.sha256}\n`).join("");
}

export function computeTreeSha256(repoDir) {
  return sha256Hex(buildTreeListing(repoDir));
}

export function buildPayload(tag, publishedAt, treeSha256) {
  return Buffer.from(`${PAYLOAD_PREFIX}\n${tag}\n${publishedAt}\n${treeSha256}\n`, "utf8");
}

/** `keys/<kid>.public.pem` → { kid: pem }. Only regular files; anything else is ignored. */
export function loadPublicKeys(repoDir, keysDir = KEYS_DIR) {
  const abs = path.join(repoDir, keysDir);
  const out = {};
  const entries = sortedEntries(abs);
  if (!entries) return out;
  for (const ent of entries) {
    if (direntKind(ent) !== "file" || !ent.name.endsWith(PUBLIC_KEY_SUFFIX)) continue;
    const kid = ent.name.slice(0, -PUBLIC_KEY_SUFFIX.length);
    if (!kid) continue;
    out[kid] = fs.readFileSync(path.join(abs, ent.name), "utf8");
  }
  return out;
}

/**
 * Verify `repoDir` against its release.json. Never throws. Same ladder as
 * @m0saic/product: missing-release → malformed → missing-signature →
 * unknown-kid → bad-signature → the three structural refusals → tree-mismatch → ok.
 */
export function verifyRelease({ repoDir, publicKeys }) {
  const releasePath = path.join(repoDir, RELEASE_FILE);
  const releaseKind = lstatKind(releasePath);
  if (releaseKind === "symlink") return { ok: false, reason: "symlink-in-tree", detail: RELEASE_FILE };
  if (releaseKind === "special") return { ok: false, reason: "special-file-in-tree", detail: RELEASE_FILE };

  let text;
  try {
    text = fs.readFileSync(releasePath, "utf8");
  } catch {
    return { ok: false, reason: "missing-release", detail: `no ${RELEASE_FILE} in checkout` };
  }
  let parsed;
  try {
    parsed = JSON.parse(stripBom(text));
  } catch {
    return { ok: false, reason: "malformed", detail: `${RELEASE_FILE} is not valid JSON` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "malformed", detail: `${RELEASE_FILE} is not an object` };
  }
  const rel = parsed;
  if (typeof rel.tag !== "string" || !TAG_PATTERN.test(rel.tag)) {
    return { ok: false, reason: "malformed", detail: "release tag missing or invalid" };
  }
  const tag = rel.tag;
  if (rel.signature === undefined || rel.signature === null) {
    return { ok: false, reason: "missing-signature", detail: `${RELEASE_FILE} carries no signature (unsigned snapshot)` };
  }
  if (rel.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, reason: "malformed", detail: `release schemaVersion ${String(rel.schemaVersion)} !== ${SCHEMA_VERSION}` };
  }
  if (typeof rel.treeSha256 !== "string" || !HEX_SHA256.test(rel.treeSha256)) {
    return { ok: false, reason: "malformed", detail: "treeSha256 missing or not a hex sha256" };
  }
  if (typeof rel.publishedAt !== "string" || !PUBLISHED_AT_PATTERN.test(rel.publishedAt)) {
    return { ok: false, reason: "malformed", detail: "publishedAt missing or not an ISO 8601 timestamp" };
  }
  const sigObj = rel.signature;
  if (!sigObj || typeof sigObj !== "object" || Array.isArray(sigObj)) {
    return { ok: false, reason: "malformed", detail: "signature is not an object" };
  }
  const { kid, alg, sig } = sigObj;
  if (typeof kid !== "string" || !kid) return { ok: false, reason: "malformed", detail: "signature.kid missing" };
  if (alg !== "ed25519") return { ok: false, reason: "malformed", detail: `signature.alg "${String(alg)}" is not ed25519` };
  if (typeof sig !== "string" || !sig) return { ok: false, reason: "malformed", detail: "signature.sig missing" };

  const pem = publicKeys[kid];
  if (!pem) return { ok: false, reason: "unknown-kid", detail: `unknown signing key "${kid}" — update m0saic or re-check the checkout` };

  let sigBytes;
  try {
    sigBytes = Buffer.from(sig, "base64url");
    if (sigBytes.length === 0) throw new Error("empty");
  } catch {
    return { ok: false, reason: "malformed", detail: "signature.sig is not base64url" };
  }
  let sigOk = false;
  try {
    sigOk = crypto.verify(null, buildPayload(tag, rel.publishedAt, rel.treeSha256), crypto.createPublicKey(pem), sigBytes);
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: "bad-signature", detail: `signature check failed for tag ${tag} (${kid})` };

  const problem = inspectTree(repoDir);
  if (problem) return { ok: false, reason: problem.reason, detail: problem.detail };

  let computed;
  try {
    computed = computeTreeSha256(repoDir);
  } catch (err) {
    if (err instanceof TreeError) return { ok: false, reason: err.problem.reason, detail: err.problem.detail };
    return { ok: false, reason: "tree-mismatch", detail: `could not hash the checkout: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (computed !== rel.treeSha256) {
    return { ok: false, reason: "tree-mismatch", detail: "release tree differs from the signed one (dist/, template-manifest.json or package.json modified)" };
  }
  return { ok: true, tag, kid, treeSha256: rel.treeSha256 };
}

/** Does `tag` exist as a git tag in the checkout? Needs git and a clone with tags. */
export function gitTagExists(repoDir, tag, spawn = spawnSync) {
  if (!TAG_PATTERN.test(tag)) return { ok: false, error: `invalid tag "${tag}"` };
  const res = spawn("git", ["tag", "--list", "--", tag], { cwd: repoDir, encoding: "utf8" });
  if (res.error) return { ok: false, error: `git not available: ${res.error.message}` };
  if (res.status !== 0) return { ok: false, error: `git tag --list failed (exit ${res.status}): ${(res.stderr || "").trim()}` };
  const found = String(res.stdout || "").split(/\r?\n/).map((s) => s.trim()).includes(tag);
  return found ? { ok: true } : { ok: false, error: `tag "${tag}" is not a git tag in this checkout (fetch tags: git fetch --tags)` };
}

/** Parse argv. Pure — returns `{ ok: false, error }` rather than exiting. */
export function parseArgs(argv, defaultRepo) {
  const val = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const repo = path.resolve(val("--repo") ?? defaultRepo);
  const keys = val("--keys") ?? KEYS_DIR;
  if (path.isAbsolute(keys)) return { ok: false, error: "--keys must be relative to the repo" };
  return { ok: true, repo, keys, requireTag: argv.includes("--require-tag"), json: argv.includes("--json") };
}

/** The whole check as one result: verify, then (when asked) the tag. */
export function run({ repo, keys = KEYS_DIR, requireTag = false }) {
  const publicKeys = loadPublicKeys(repo, keys);
  if (Object.keys(publicKeys).length === 0) {
    return { ok: false, reason: "no-keys", detail: `no *${PUBLIC_KEY_SUFFIX} under ${keys}/ — nothing to verify against` };
  }
  const verdict = verifyRelease({ repoDir: repo, publicKeys });
  if (!verdict.ok) return verdict;
  if (requireTag) {
    const t = gitTagExists(repo, verdict.tag);
    if (!t.ok) return { ok: false, reason: "tag-missing", detail: t.error, tag: verdict.tag, kid: verdict.kid, treeSha256: verdict.treeSha256 };
  }
  return { ...verdict, tagChecked: requireTag };
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args = parseArgs(process.argv.slice(2), path.resolve(here, ".."));
  if (!args.ok) {
    console.error(args.error);
    process.exit(1);
  }
  const result = run(args);
  if (args.json) {
    console.log(JSON.stringify(result));
  } else if (result.ok) {
    console.log(`✓ release verified: ${result.tag} (${result.kid}) treeSha256 ${result.treeSha256}${result.tagChecked ? " — git tag present" : ""}`);
  } else {
    console.error(`✗ release NOT verified — ${result.reason}: ${result.detail}`);
  }
  process.exit(result.ok ? 0 : 1);
}

/**
 * Run only when invoked directly. Compared by REAL path: on macOS the temp
 * root is a symlink (`/var/folders/…` → `/private/var/…`), so a plain
 * `path.resolve` of argv[1] never equals the resolved module URL and the
 * script would exit 0 having printed nothing — a verifier that says nothing
 * must never read as a pass.
 */
function isMainModule() {
  try {
    return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main();
}
