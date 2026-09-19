"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publisher = void 0;
/**
 * Your publisher descriptor. `id` is your handle: the first segment of every
 * template id you publish (without the leading `@`) and this folder's name
 * under `src/publishers/`. Handles matching /m0saic/i are reserved.
 */
exports.publisher = {
    id: "your-handle",
    displayName: "Your Name",
    description: "One line about what you publish.",
    entryModule: "./dist/publishers/your-handle/index.js",
};
