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
exports.WEB_TEMPLATE_IDS_FILE = void 0;
/**
 * Generate web-template-ids.json — the community template ids the BROWSER
 * entry (`./web`) carries.
 *
 * Usage:  node dist/gen-web-template-ids.js   (a build step, after the manifest)
 *
 * Self-contained port of `packages/templates/src/gen-web-template-ids.ts`,
 * kept as a copy on purpose (this package's other life is a standalone public
 * repo). One difference: the official entry REGISTERS at import and the
 * generator reads the registry; this package's entries never register (the
 * host does), so the list is read straight off the entry's `templates[]`.
 *
 * Consumers: the web app's asset copy step
 * (`apps/mosaic/web/scripts/copy-template-assets.js`) — a community id in this
 * file is web-runnable, so its preview assets and browse row are mirrored as
 * a live template rather than a Desktop-only card.
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const web_1 = require("./web");
/** Package-root file the build writes; ships in the tarball and the snapshot. */
exports.WEB_TEMPLATE_IDS_FILE = "web-template-ids.json";
const ROOT = path.resolve(__dirname, "..");
const ids = (0, web_1.listWebTemplateIds)();
if (ids.length === 0) {
    throw new Error("gen-web-template-ids: the browser entry carries no templates");
}
const outPath = path.join(ROOT, exports.WEB_TEMPLATE_IDS_FILE);
fs.writeFileSync(outPath, JSON.stringify({ schemaVersion: 1, entryModule: web_1.WEB_ENTRY_MODULE, ids }, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath} (${ids.length} template ids)`);
