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
/**
 * Manifest tests: the builder's invariants and the freshness of the committed
 * template-manifest.json (regenerate with `npm run build` in this package).
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const gen_template_manifest_1 = require("./gen-template-manifest");
const repo_1 = require("./repo");
describe("community template-manifest", () => {
    it("builds with per-entry publisher + author and publisher descriptors", () => {
        const manifest = (0, gen_template_manifest_1.buildCommunityManifest)();
        expect(manifest.schemaVersion).toBe(1);
        expect(manifest.repo.repoId).toBe(repo_1.TEMPLATE_REPO.repoId);
        expect(manifest.entryModule).toBe("./dist/index.js");
        expect(manifest.templates.length).toBeGreaterThan(0);
        for (const entry of manifest.templates) {
            expect(entry.publisher).toBeTruthy();
            expect(entry.author).toBe(entry.publisher);
            expect(String(entry.templateKey).startsWith(`@${entry.publisher}/`)).toBe(true);
        }
        expect(manifest.publishers?.length).toBeGreaterThan(0);
        for (const publisher of manifest.publishers ?? []) {
            expect(publisher.templateCount).toBe(manifest.templates.filter((t) => t.publisher === publisher.id).length);
        }
    });
    it("committed template-manifest.json is fresh (rebuild with `npm run build`)", () => {
        const manifestPath = path.join(__dirname, "..", "template-manifest.json");
        expect(fs.existsSync(manifestPath)).toBe(true);
        const committed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        expect(committed).toEqual(JSON.parse(JSON.stringify((0, gen_template_manifest_1.buildCommunityManifest)())));
    });
});
