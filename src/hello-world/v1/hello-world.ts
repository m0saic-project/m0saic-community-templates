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
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { bundledAssetPath } from "@m0saic/template-utils/dist/m0saic/assetPath";
import {
  defineHelloWorldTemplate,
  defineMosaicTemplate,
  type HelloWorldMarkImage,
  type HelloWorldProps,
} from "@m0saic/template-utils";
import type { MosaicTemplate } from "@m0saic/types";

/** The one asset, replaced on every release by the mint step. */
export const COMMUNITY_M_ASSET = "community-m.png";

/** Absolute, asar-translated path to the baked Community M. */
export const COMMUNITY_M_PATH: string = bundledAssetPath(
  resolve(__dirname, "assets"),
  COMMUNITY_M_ASSET,
);

/** Present only when the mint actually baked one — else the brand M. */
export const COMMUNITY_M_AVAILABLE: boolean = existsSync(COMMUNITY_M_PATH);

/** The mark override, or undefined to fall back to the brand M. */
export const communityMark: HelloWorldMarkImage | undefined = COMMUNITY_M_AVAILABLE
  ? { path: COMMUNITY_M_PATH, assetId: "community_m" }
  : undefined;

const card = defineHelloWorldTemplate({
  id: "@m0saic-community/hello-world/v1",
  label: "Hello, World (Community)",
  description:
    "The community repo's front door: the Home screen as a greeting, with the Community M in the mark — the 33-tile brand M where each tile belongs to one contributor. The mark is re-baked on every release, so the card fills in as tiles are claimed. Zero inputs.",
  tags: ["hello", "brand", "animated", "intro", "card", "community", "front-door"],
  subline: "Every tile a contributor.",
  ...(communityMark ? { mark: communityMark } : {}),
});

// Through the convention seam like every other template here — the gate's
// definition-time checks run on the factory's output, not around it.
export const CommunityHelloWorld: MosaicTemplate<HelloWorldProps> =
  defineMosaicTemplate<HelloWorldProps>({ ...card });
