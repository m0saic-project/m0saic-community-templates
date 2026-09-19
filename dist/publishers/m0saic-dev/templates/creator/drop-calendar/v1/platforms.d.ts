/**
 * Creator platforms — the first-class output selection of the calendar.
 *
 * Picking a platform does two things: the template AUTHORS that platform's
 * canvas (the doc's own `size` — L1 in the output tree — so the host's
 * device box follows or letterboxes), and the layout keeps the CARD inside
 * the platform's safe area: the top/bottom chrome every app draws over a
 * vertical video, and the action rail (avatar, like, comment, share) that
 * Shorts, TikTok and Reels run up the right edge. Footage is exempt — a
 * facecam may run under chrome, a letterboxed short reads as a repost — but
 * the calendar is text and has to stay inside.
 *
 * Chrome insets are what the apps actually cover, measured tightly rather
 * than generously (founder call 2026-09-15: the earlier union — top 8 %,
 * bottom 14 %, rail 20 % from 45 % — gave away too much of the screen).
 * Short-form: top 5 %, bottom 10 %, sides 4 %, an action rail 16 % wide
 * from 52 % down to the bottom inset. Stories: top 7 %, bottom 9 %. The
 * `safeArea` prop turns all of this off for a creator who wants the whole
 * canvas.
 *
 * `canvas` follows whatever size the host asks for and reserves nothing —
 * the pre-platform behaviour, kept as the escape hatch. The canvas reaches
 * hosts through the template's `resolveOutputHints` (they seed the render
 * target from it); an explicit user size (`-w/-h`, the unlocked Device box)
 * wins at the host, and the safe area still applies at that size.
 */
import type { Rect } from "./layout";
export type CreatorPlatformId = "canvas" | "youtube" | "youtube-shorts" | "tiktok" | "instagram-reel" | "instagram-story" | "instagram-post" | "instagram-portrait" | "twitch" | "x";
export type CreatorPlatform = {
    id: CreatorPlatformId;
    /** Option label in the props panel. */
    label: string;
    /** The canvas the platform wants; undefined = follow the host. */
    canvas?: {
        width: number;
        height: number;
    };
    /** Chrome insets as fractions of the canvas. */
    chrome: {
        top: number;
        bottom: number;
        side: number;
    };
    /** The action rail up the right edge, as canvas fractions; absent = none. */
    rail?: {
        width: number;
        top: number;
        bottom: number;
    };
};
/** Default platform — the 16:9 the template's static hint already declares. */
export declare const DEFAULT_CREATOR_PLATFORM: CreatorPlatformId;
export declare const CREATOR_PLATFORMS: readonly CreatorPlatform[];
export declare const CREATOR_PLATFORM_IDS: CreatorPlatformId[];
export declare const CREATOR_PLATFORM_OPTIONS: {
    value: CreatorPlatformId;
    label: string;
}[];
export declare function isCreatorPlatformId(v: unknown): v is CreatorPlatformId;
/** Unknown / unset → the default platform (never throws — a render must land). */
export declare function resolveCreatorPlatform(v: unknown): CreatorPlatform;
export type StageArea = {
    /** Inside the chrome — the card lives here. */
    safe: Rect;
    /** Reserved for the platform's buttons; the card never overlaps it. */
    rail?: Rect;
};
/** The platform's safe area (and rail) at a concrete canvas. */
export declare function platformStage(platform: CreatorPlatform, W: number, H: number): StageArea;
