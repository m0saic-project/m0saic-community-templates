// Run with: node --test tools/check-freeze.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  FREEZE_MANIFEST_FILE, checkTree, collectFrozenFiles, hashBytes, isFrozenSeed, judgeStaged, mintManifest, relativeImportSpecifiers,
} from "./check-freeze.mjs";

function pkg() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cfreeze-"));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  w("src/publishers/acme/templates/cards/hello/v1/hello.ts", 'import { helper } from "../../_shared/theme";\nexport const a = helper(1);\n');
  w("src/publishers/acme/templates/cards/hello/v1/hello.test.ts", "test('x', () => {});\n");
  w("src/publishers/acme/templates/cards/_shared/theme.ts", 'import { base } from "../../../../../util/base";\nexport const helper = (n) => base + n;\n');
  w("src/util/base.ts", "export const base = 1;\n");
  w("src/publishers/acme/publisher.ts", "export const publisher = {};\n");
  w("src/publishers/index.ts", "export {};\n");
  w("src/_PUBLISHER_STARTER/templates/x/v1/x.ts", "export const scaffold = 1;\n");
  w("src/hello-world/v1/index.ts", "export const hw = 1;\n");
  w("src/publishers/acme/templates/mermaid/flow/v1/flow.ts", "export const m = 1;\n");
  return { root, w };
}

test("seeds are vN / _shared files under the publisher and front-door roots only", () => {
  assert.equal(isFrozenSeed("src/publishers/acme/templates/cards/hello/v1/hello.ts"), true);
  assert.equal(isFrozenSeed("src/publishers/acme/templates/cards/_shared/theme.ts"), true);
  assert.equal(isFrozenSeed("src/hello-world/v1/index.ts"), true);
  assert.equal(isFrozenSeed("src/publishers/acme/templates/cards/hello/v1/hello.test.ts"), false);
  assert.equal(isFrozenSeed("src/publishers/acme/publisher.ts"), false);
  assert.equal(isFrozenSeed("src/template-registry.ts"), false);
});

test("the frozen set is seeds + their import closure, minus the scaffold and excluded packs", () => {
  const { root } = pkg();
  assert.deepEqual(collectFrozenFiles(root, ["src/publishers/acme/templates/mermaid/"]), [
    "src/hello-world/v1/index.ts",
    "src/publishers/acme/templates/cards/_shared/theme.ts",
    "src/publishers/acme/templates/cards/hello/v1/hello.ts",
    "src/util/base.ts",
  ]);
  assert.ok(collectFrozenFiles(root).includes("src/publishers/acme/templates/mermaid/flow/v1/flow.ts"));
});

test("import scan ignores commented-out imports", () => {
  assert.deepEqual(relativeImportSpecifiers('// import x from "./dead";\n/* import y from "./dead2" */\nimport z from "./live";\nimport "@m0saic/types";'), ["./live"]);
});

test("hashes are CRLF-agnostic", () => {
  assert.equal(hashBytes(Buffer.from("a\r\nb\rc\n")), hashBytes(Buffer.from("a\nb\nc\n")));
});

test("checkTree: unchanged passes, a byte edit (even a comment) fails, a deletion fails, new work is unfrozen", () => {
  const { root, w } = pkg();
  const m = mintManifest(root, { tag: "v1", commit: "abc", excluded: ["src/publishers/acme/templates/mermaid/"] });
  assert.equal(Object.keys(m.files).length, 4);
  assert.equal(checkTree(root, m).ok, true);
  w("src/publishers/acme/templates/cards/hello/v1/hello.ts", '// a comment\nimport { helper } from "../../_shared/theme";\nexport const a = helper(1);\n');
  let r = checkTree(root, m);
  assert.equal(r.ok, false);
  assert.deepEqual(r.changed, ["src/publishers/acme/templates/cards/hello/v1/hello.ts"]);
  fs.rmSync(path.join(root, "src/util/base.ts"));
  r = checkTree(root, m);
  assert.deepEqual(r.deleted, ["src/util/base.ts"]);
  w("src/publishers/acme/templates/cards/hello/v2/hello.ts", "export const a = 2;\n");
  assert.ok(checkTree(root, m).unfrozen.includes("src/publishers/acme/templates/cards/hello/v2/hello.ts"));
  assert.equal(checkTree(root, { ...m, hashVersion: 99 }).hashVersionMismatch !== undefined, true);
});

test("judgeStaged: the index is judged against the manifest at HEAD; the manifest is additive-only", () => {
  const { root, w } = pkg();
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  git("init", "-q");
  git("config", "commit.gpgsign", "false");
  const m = mintManifest(root, { tag: "v1", commit: "abc", excluded: ["src/publishers/acme/templates/mermaid/"] });
  fs.writeFileSync(path.join(root, FREEZE_MANIFEST_FILE), JSON.stringify(m, null, 2) + "\n");
  git("add", "-A");
  git("commit", "-q", "-m", "frozen");
  // new work stages clean
  w("src/publishers/acme/templates/cards/hello/v2/hello.ts", "export const a = 2;\n");
  git("add", "-A");
  assert.equal(judgeStaged(root, "").code, 0);
  // a frozen edit is caught in the INDEX even if the working tree is later restored
  w("src/publishers/acme/templates/cards/hello/v1/hello.ts", "export const a = 3;\n");
  git("add", "-A");
  let v = judgeStaged(root, "");
  assert.equal(v.code, 1);
  assert.ok(v.lines.some((l) => l.startsWith("changed  src/publishers/acme/templates/cards/hello/v1/hello.ts")));
  git("checkout", "HEAD", "--", "src/publishers/acme/templates/cards/hello/v1/hello.ts");
  assert.equal(judgeStaged(root, "").code, 0);
  // blessing the edit by staging a re-minted manifest is refused
  w("src/publishers/acme/templates/cards/hello/v1/hello.ts", "export const a = 3;\n");
  const remint = mintManifest(root, { tag: "v1", commit: "abc", excluded: m.excluded });
  fs.writeFileSync(path.join(root, FREEZE_MANIFEST_FILE), JSON.stringify(remint, null, 2) + "\n");
  git("add", "-A");
  v = judgeStaged(root, "");
  assert.equal(v.code, 1);
  assert.ok(v.lines.some((l) => l.startsWith("manifest moves")));
  // deleting a frozen file is refused
  git("checkout", "HEAD", "--", ".");
  git("rm", "-q", "src/util/base.ts");
  v = judgeStaged(root, "");
  assert.equal(v.code, 1);
  assert.ok(v.lines.some((l) => l.startsWith("DELETED  src/util/base.ts")));
});
