import { type HelloWorldMarkImage, type HelloWorldProps } from "@m0saic/template-utils";
import type { MosaicTemplate } from "@m0saic/types";
/** The one asset, replaced on every release by the mint step. */
export declare const COMMUNITY_M_ASSET = "community-m.png";
/** Absolute, asar-translated path to the baked Community M. */
export declare const COMMUNITY_M_PATH: string;
/** Present only when the mint actually baked one — else the brand M. */
export declare const COMMUNITY_M_AVAILABLE: boolean;
/** The mark override, or undefined to fall back to the brand M. */
export declare const communityMark: HelloWorldMarkImage | undefined;
export declare const CommunityHelloWorld: MosaicTemplate<HelloWorldProps>;
