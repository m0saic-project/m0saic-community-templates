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
exports.templates = exports.publisher = void 0;
const v1_1 = require("./hello-world/v1");
/**
 * Publisher descriptor for the repo itself.
 *
 * `id` is the handle: the first segment of the front door's id without the
 * leading `@`. Unlike every other publisher it maps to no
 * `src/publishers/<handle>/` folder — `tools/check-deps.mjs` carves this one
 * handle out of the folder rule for exactly that reason.
 *
 * Member ids here are PACKLESS (`@m0saic-community/<slug>/vN`): the 3-segment
 * community shape `parseTemplateId` documents as first-class, and the shape
 * the built-in front door `@m0saic/hello-world/v1` already carries.
 */
exports.publisher = {
    id: "m0saic-community",
    displayName: "Mosaic Community",
    description: "The community repo itself — the front door card carrying the Community M, re-baked on every release. Contributor templates ship under their own publisher handle.",
    entryModule: "./dist/front-door.js",
};
/** The one card. Deliberately not extensible: this handle owns the door. */
exports.templates = [v1_1.CommunityHelloWorld];
__exportStar(require("./hello-world/v1"), exports);
