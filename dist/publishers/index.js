"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLISHER_IDS = exports.PUBLISHER_ENTRIES = void 0;
/**
 * Publisher table. Each entry lazily requires its publisher module so hosts
 * can load a SUBSET of publishers without evaluating the rest — the
 * selective-loading seam behind `getTemplates({ publishers })` in
 * `../index.ts`.
 *
 * Adding a publisher: copy `src/_PUBLISHER_STARTER/` to
 * `src/publishers/<your-handle>/` and add one line here.
 */
exports.PUBLISHER_ENTRIES = {
    // Inline require is deliberate: lazy per-publisher evaluation IS the point —
    // a top-of-file import would evaluate every publisher on entry load.
    "m0saic-dev": () => require("./m0saic-dev"),
    // The repo's OWN handle — the front door, which lives top-level at
    // `src/front-door.ts` rather than under a publisher folder. See its
    // docblock: the greeting belongs to the repo, not to a contributor.
    "m0saic-community": () => require("../front-door"),
};
/** All publisher handles shipped by this repo, in registration order. */
exports.PUBLISHER_IDS = Object.keys(exports.PUBLISHER_ENTRIES);
