/**
 * Manifest tests: the builder's invariants and the freshness of the committed
 * template-manifest.json (regenerate with `npm run build` in this package).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { buildCommunityManifest } from "./gen-template-manifest";
import { TEMPLATE_REPO } from "./repo";

describe("community template-manifest", () => {
  it("builds with per-entry publisher + author and publisher descriptors", () => {
    const manifest = buildCommunityManifest();
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.repo.repoId).toBe(TEMPLATE_REPO.repoId);
    expect(manifest.entryModule).toBe("./dist/index.js");
    expect(manifest.templates.length).toBeGreaterThan(0);
    for (const entry of manifest.templates) {
      expect(entry.publisher).toBeTruthy();
      expect(entry.author).toBe(entry.publisher);
      expect(String(entry.templateKey).startsWith(`@${entry.publisher}/`)).toBe(true);
    }
    expect(manifest.publishers?.length).toBeGreaterThan(0);
    for (const publisher of manifest.publishers ?? []) {
      expect(publisher.templateCount).toBe(
        manifest.templates.filter((t) => t.publisher === publisher.id).length,
      );
    }
  });

  it("committed template-manifest.json is fresh (rebuild with `npm run build`)", () => {
    const manifestPath = path.join(__dirname, "..", "template-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const committed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildCommunityManifest())));
  });
});
