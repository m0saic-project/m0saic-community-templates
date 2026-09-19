"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publisher = void 0;
/**
 * Publisher descriptor for `m0saic-dev` — the m0saic founder's personal
 * publisher. Templates here are experiments and niche use cases that live
 * outside the official brand library.
 *
 * The `id` is the publisher handle: the first segment of every member
 * template id without the leading `@` (`@m0saic-dev/<pack>/<slug>/vN`),
 * and the directory name under `src/publishers/`.
 */
exports.publisher = {
    id: "m0saic-dev",
    displayName: "m0saic-dev",
    description: "Personal publisher of the m0saic founder — experiments and niche templates that live outside the official library.",
    entryModule: "./dist/publishers/m0saic-dev/index.js",
};
