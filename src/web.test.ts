/**
 * The browser entry's contract (see the docblock in ./web.ts):
 *   1. node-clean — nothing in the import closure of `src/web.ts` reaches a
 *      node builtin or a deep `@m0saic/template-utils/dist/…` import (those
 *      are the node-only helpers the barrel deliberately leaves out);
 *   2. a subset of the node entry — every web template is also a Desktop
 *      template, registered in `template-registry.ts`;
 *   3. no required desktop-only prop — a required media / folder / file
 *      picker can never be filled in the browser, so such a template is a
 *      web CARD, never a web template;
 *   4. the generated id list is what the entry carries.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { getTemplates } from "./index";
import { templateRegistry } from "./template-registry";
import { WEB_ENTRY_MODULE, listWebTemplateIds, templates as webTemplates } from "./web";

const SRC = path.resolve(__dirname);
const ENTRY = path.join(SRC, "web.ts");

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
const NODE_BUILTIN_RE = /^(node:|fs$|path$|os$|child_process$|crypto$|url$|util$|stream$|zlib$|worker_threads$)/;

function resolveRelative(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, path.join(base, "index.ts"), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every `.ts` file reachable from the entry by relative imports, plus every
 *  bare specifier those files import. */
function importClosure(entry: string): { files: string[]; bare: Map<string, string[]> } {
  const seen = new Set<string>();
  const bare = new Map<string, string[]>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (spec.startsWith(".")) {
        const resolved = resolveRelative(file, spec);
        if (resolved) stack.push(resolved);
        continue;
      }
      const rel = path.relative(SRC, file);
      const users = bare.get(spec) ?? [];
      users.push(rel);
      bare.set(spec, users);
    }
  }
  return { files: Array.from(seen), bare };
}

describe("browser entry — @m0saic/community-templates/web", () => {
  const closure = importClosure(ENTRY);

  it("carries at least one template and names its built module", () => {
    expect(webTemplates.length).toBeGreaterThan(0);
    expect(WEB_ENTRY_MODULE).toBe("./dist/web.js");
  });

  it("is node-clean: no node builtin anywhere in the import closure", () => {
    const offenders = Array.from(closure.bare.entries())
      .filter(([spec]) => NODE_BUILTIN_RE.test(spec))
      .map(([spec, users]) => `${spec} ← ${users.join(", ")}`);
    expect(offenders).toEqual([]);
  });

  it("never deep-imports a node-only template-utils module the browser field does not swap", () => {
    // The barrel is browser-safe by contract; `dist/<folder>/…` deep imports
    // are exactly how the node-only helpers (defaultMedia, assetPath, dev) are
    // reached. The ONE exception is a module template-utils's package.json
    // `browser` field maps to a browser twin (defaultMedia → its data-URI
    // twin): a bundle resolves the twin, so the frozen template that imports
    // the node helper runs unchanged. Anything else is a Desktop template.
    const utilsPkg = JSON.parse(
      fs.readFileSync(path.resolve(SRC, "..", "..", "template-utils", "package.json"), "utf8"),
    ) as { browser?: Record<string, string> };
    const swapped = new Set(
      Object.keys(utilsPkg.browser ?? {}).map((file) =>
        `@m0saic/template-utils/${file.replace(/^\.\//, "").replace(/\.js$/, "")}`,
      ),
    );
    const offenders = Array.from(closure.bare.entries())
      .filter(([spec]) => /^@m0saic\/template-utils\/dist\//.test(spec) && !swapped.has(spec))
      .map(([spec, users]) => `${spec} ← ${users.join(", ")}`);
    expect(offenders).toEqual([]);
    // The swap is what admits drop-calendar; pin it so a dropped field is loud.
    expect(swapped.has("@m0saic/template-utils/dist/media/defaultMedia")).toBe(true);
  });

  it("is a subset of the node entry and of the authoring registry", () => {
    const nodeIds = new Set(getTemplates().map((t) => String(t.id)));
    const registryIds = new Set(templateRegistry.map((e) => e.templateId));
    for (const t of webTemplates) {
      const id = String(t.id);
      expect(nodeIds.has(id)).toBe(true);
      expect(registryIds.has(id)).toBe(true);
    }
  });

  it("has no required desktop-only prop (media / folder / file picker)", () => {
    const offenders: string[] = [];
    for (const t of webTemplates) {
      const schema = (t.propsSchema ?? {}) as Record<string, { type?: string; required?: boolean; picker?: string; meta?: { control?: { picker?: string } } }>;
      for (const [key, def] of Object.entries(schema)) {
        if (!def?.required) continue;
        const type = String(def.type ?? "");
        const picker = def.meta?.control?.picker ?? def.picker;
        if (type.startsWith("media") || picker === "folder" || picker === "file" || picker === "files") {
          offenders.push(`${String(t.id)}.${key} (${type}${picker ? `, picker=${picker}` : ""})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("lists sorted, unique ids — what web-template-ids.json carries", () => {
    const ids = listWebTemplateIds();
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(webTemplates.map((t) => String(t.id)).sort());
    // The founder's loop: a Make link on these ids opens LIVE on the web.
    expect(ids).toContain("@m0saic-dev/creator/tip-goal/v1");
    // Required audio → stays a card.
    expect(ids).not.toContain("@m0saic-dev/music/lyric-video/v1");
  });
});
