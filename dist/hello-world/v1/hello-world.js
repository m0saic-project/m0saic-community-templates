"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityHelloWorld = exports.communityMark = exports.COMMUNITY_M_AVAILABLE = exports.COMMUNITY_M_PATH = exports.COMMUNITY_M_ASSET = void 0;
/**
 * `@m0saic-community/hello-world/v1` — the community repo's FRONT DOOR.
 *
 * The canonical Hello, World card (`defineHelloWorldTemplate`) with ONE
 * substitution: the mark is a rendered PNG of the **Community M as it
 * currently stands** rather than the brand M's 26 rectangles.
 *
 * Why this mark (founder, 2026-09-17): the community repo is re-minted on
 * every release, so the front door is the one surface that can honestly show
 * the M filling up. Every time a contributor's tile is accepted, the next
 * release carries a new `assets/community-m.png` and the card changes. One
 * asset, replaced in place — never a per-tile art bundle.
 *
 * FALLBACK IS THE POINT. The asset is an override, not a dependency: when it
 * is missing (a stripped build, a checkout before the first mint) the probe
 * below passes `undefined` and the card renders the brand M exactly as the
 * core template does. The front door is never broken by a missing picture.
 *
 * The `existsSync` probe MUST test the asar-translated path — inside a
 * packaged Electron app `existsSync` returns true for an in-asar path that
 * ffmpeg then cannot open (see `bundledAssetPath`'s docblock, and the same
 * pattern in science/multi-panel-figure's `demo-fixture.ts`).
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const assetPath_1 = require("@m0saic/template-utils/dist/m0saic/assetPath");
const template_utils_1 = require("@m0saic/template-utils");
/** The one asset, replaced on every release by the mint step. */
exports.COMMUNITY_M_ASSET = "community-m.png";
/** Absolute, asar-translated path to the baked Community M. */
exports.COMMUNITY_M_PATH = (0, assetPath_1.bundledAssetPath)((0, node_path_1.resolve)(__dirname, "assets"), exports.COMMUNITY_M_ASSET);
/** Present only when the mint actually baked one — else the brand M. */
exports.COMMUNITY_M_AVAILABLE = (0, node_fs_1.existsSync)(exports.COMMUNITY_M_PATH);
/** The mark override, or undefined to fall back to the brand M. */
exports.communityMark = exports.COMMUNITY_M_AVAILABLE
    ? { path: exports.COMMUNITY_M_PATH, assetId: "community_m" }
    : undefined;
const card = (0, template_utils_1.defineHelloWorldTemplate)({
    id: "@m0saic-community/hello-world/v1",
    label: "Hello, World (Community)",
    description: "The community repo's front door: the Home screen as a greeting, with the Community M in the mark — the 33-tile brand M where each tile belongs to one contributor. The mark is re-baked on every release, so the card fills in as tiles are claimed. Zero inputs.",
    tags: ["hello", "brand", "animated", "intro", "card", "community", "front-door"],
    subline: "Every tile a contributor.",
    ...(exports.communityMark ? { mark: exports.communityMark } : {}),
});
// Through the convention seam like every other template here — the gate's
// definition-time checks run on the factory's output, not around it.
exports.CommunityHelloWorld = (0, template_utils_1.defineMosaicTemplate)({ ...card });
