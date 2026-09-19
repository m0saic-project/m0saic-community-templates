"use strict";
// Copy this folder to src/publishers/<your-publisher-handle>/ then:
//
//  1. Fill in ./publisher.ts (your handle, display name, entryModule path).
//  2. Author templates under ./templates/<pack>/<slug>/vN/ with ids shaped
//     `@<your-handle>/<pack>/<slug>/vN`, export the template objects (no
//     self-registration — the host decides what to register), and list them
//     in `templates` below.
//  3. Add one line to ../index.ts PUBLISHER_ENTRIES:
//       "<your-handle>": () => require("./<your-handle>") as PublisherModule,
//  4. Add a registry entry per template in ../../template-registry.ts
//     (author = your handle) and rebuild — the manifest generator enforces
//     the rest.
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
exports.templates = exports.publisher = void 0;
var publisher_1 = require("./publisher");
Object.defineProperty(exports, "publisher", { enumerable: true, get: function () { return publisher_1.publisher; } });
__exportStar(require("./templates"), exports);
/** Every template this publisher ships, in stable order. */
exports.templates = [
// MyTemplateV1,
];
