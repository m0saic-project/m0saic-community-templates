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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Export templates here.
__exportStar(require("./creator"), exports);
__exportStar(require("./hero"), exports);
__exportStar(require("./language"), exports);
// `./mermaid` is deliberately NOT re-exported: the pack is DISCONNECTED
// (2026-09-07 — see ../index.ts) and its `@dagrejs/dagre` is a devDependency.
// Re-exporting it here made every host evaluate dagre-layout.js on pack
// load, so a checkout without a node_modules (a clone outside the workspace,
// the CLI's --community-repo) could not load the pack at all. Restore this
// line together with the publisher-array + registry entries once dagre is
// vendored. Source + tests stay in-tree (`./mermaid/index.test.ts` imports
// the pack directly).
__exportStar(require("./music"), exports);
__exportStar(require("./print"), exports);
__exportStar(require("./science"), exports);
