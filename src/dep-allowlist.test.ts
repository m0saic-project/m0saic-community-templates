/**
 * Dependency-policy lockstep: the repo's committed dep-allowlist.json (what
 * public-repo CI enforces via tools/check-deps.mjs) must equal
 * @m0saic/platform's TEMPLATE_REPO_DEP_ALLOWLIST (what the desktop dev
 * resolver honors) — one policy, two enforcement points, zero drift.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { TEMPLATE_REPO_DEP_ALLOWLIST } from "@m0saic/platform/template-repos";

const ROOT = path.join(__dirname, "..");

function readAllowlistJson(): {
  packages: string[];
  builtins: string[];
} {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "dep-allowlist.json"), "utf8"),
  );
}

describe("dependency policy", () => {
  it("dep-allowlist.json is in lockstep with the platform constant", () => {
    const json = readAllowlistJson();
    expect([...json.packages].sort()).toEqual(
      [...TEMPLATE_REPO_DEP_ALLOWLIST.packages].sort(),
    );
    expect([...json.builtins].sort()).toEqual(
      [...TEMPLATE_REPO_DEP_ALLOWLIST.builtins].sort(),
    );
  });

  it("package.json dependencies stay inside the allowlist", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      expect(TEMPLATE_REPO_DEP_ALLOWLIST.packages).toContain(dep);
    }
  });

  it("tools/check-deps.mjs (the public-repo CI gate) passes", () => {
    const res = spawnSync(
      process.execPath,
      [path.join(ROOT, "tools", "check-deps.mjs")],
      { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
    );
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });
});
