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
exports.templates = exports.templateRegistry = exports.PUBLISHER_IDS = exports.listRegisteredTemplateIds = exports.getTemplate = exports.requireTemplate = void 0;
exports.getTemplates = getTemplates;
const publishers_1 = require("./publishers");
var template_utils_1 = require("@m0saic/template-utils");
Object.defineProperty(exports, "requireTemplate", { enumerable: true, get: function () { return template_utils_1.requireTemplate; } });
Object.defineProperty(exports, "getTemplate", { enumerable: true, get: function () { return template_utils_1.getTemplate; } });
Object.defineProperty(exports, "listRegisteredTemplateIds", { enumerable: true, get: function () { return template_utils_1.listRegisteredTemplateIds; } });
__exportStar(require("./repo"), exports);
var publishers_2 = require("./publishers");
Object.defineProperty(exports, "PUBLISHER_IDS", { enumerable: true, get: function () { return publishers_2.PUBLISHER_IDS; } });
var template_registry_1 = require("./template-registry");
Object.defineProperty(exports, "templateRegistry", { enumerable: true, get: function () { return template_registry_1.templateRegistry; } });
/**
 * Selective template access — the loader-facing seam. Only the requested
 * publishers' modules are evaluated, so a host can load one publisher out of
 * many without paying for the rest; a publisher exposing per-pack thunks
 * (`PublisherModule.packs`) is evaluated per pack.
 */
function getTemplates(opts) {
    const wantedPublishers = (opts?.publishers ?? []).map((p) => p.replace(/^@/, ""));
    const wantedPacks = (opts?.packs ?? []).map((k) => k.replace(/^@/, ""));
    const selective = wantedPublishers.length > 0 || wantedPacks.length > 0;
    if (!selective) {
        return publishers_1.PUBLISHER_IDS.flatMap((id) => publishers_1.PUBLISHER_ENTRIES[id]().templates);
    }
    const out = [];
    const seen = new Set();
    const push = (templates) => {
        for (const template of templates) {
            const id = String(template.id);
            if (seen.has(id))
                continue;
            seen.add(id);
            out.push(template);
        }
    };
    for (const handle of publishers_1.PUBLISHER_IDS) {
        const packKeys = wantedPacks
            .filter((k) => k.startsWith(`${handle}/`))
            .map((k) => k.slice(handle.length + 1));
        const wholePublisher = wantedPublishers.includes(handle);
        if (!wholePublisher && packKeys.length === 0)
            continue;
        const mod = publishers_1.PUBLISHER_ENTRIES[handle]();
        if (wholePublisher) {
            push(mod.templates);
            continue;
        }
        for (const pack of packKeys) {
            const thunk = mod.packs?.[pack];
            if (thunk) {
                push(thunk());
            }
            else {
                push(mod.templates.filter((t) => String(t.id).startsWith(`@${handle}/${pack}/`)));
            }
        }
    }
    return out;
}
/**
 * `templates` is the named export the platform's template-repo loader
 * picks up (see `loadTemplateRepoFromPath.ts`). Eager full list — hosts
 * that want per-publisher subsets call `getTemplates({ publishers })`.
 *
 * Importing this entry has NO registration side effects: the HOST decides
 * what to register (and under which origin) — the desktop loads this repo
 * through the external-repo pipeline with the community pin.
 */
exports.templates = getTemplates();
