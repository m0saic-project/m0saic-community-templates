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
 * Dependency-policy lockstep: the repo's committed dep-allowlist.json (what
 * public-repo CI enforces via tools/check-deps.mjs) must equal
 * @m0saic/platform's TEMPLATE_REPO_DEP_ALLOWLIST (what the desktop dev
 * resolver honors) — one policy, two enforcement points, zero drift.
 */
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const template_repos_1 = require("@m0saic/platform/template-repos");
const ROOT = path.join(__dirname, "..");
function readAllowlistJson() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "dep-allowlist.json"), "utf8"));
}
describe("dependency policy", () => {
    it("dep-allowlist.json is in lockstep with the platform constant", () => {
        const json = readAllowlistJson();
        expect([...json.packages].sort()).toEqual([...template_repos_1.TEMPLATE_REPO_DEP_ALLOWLIST.packages].sort());
        expect([...json.builtins].sort()).toEqual([...template_repos_1.TEMPLATE_REPO_DEP_ALLOWLIST.builtins].sort());
    });
    it("package.json dependencies stay inside the allowlist", () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
        for (const dep of Object.keys(pkg.dependencies ?? {})) {
            expect(template_repos_1.TEMPLATE_REPO_DEP_ALLOWLIST.packages).toContain(dep);
        }
    });
    it("tools/check-deps.mjs (the public-repo CI gate) passes", () => {
        const res = (0, node_child_process_1.spawnSync)(process.execPath, [path.join(ROOT, "tools", "check-deps.mjs")], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
        expect(res.stderr).toBe("");
        expect(res.status).toBe(0);
    });
});
