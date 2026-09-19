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

export type CreatorPlatformId =
  | "canvas"
  | "youtube"
  | "youtube-shorts"
  | "tiktok"
  | "instagram-reel"
  | "instagram-story"
  | "instagram-post"
  | "instagram-portrait"
  | "twitch"
  | "x";

export type CreatorPlatform = {
  id: CreatorPlatformId;
  /** Option label in the props panel. */
  label: string;
  /** The canvas the platform wants; undefined = follow the host. */
  canvas?: { width: number; height: number };
  /** Chrome insets as fractions of the canvas. */
  chrome: { top: number; bottom: number; side: number };
  /** The action rail up the right edge, as canvas fractions; absent = none. */
  rail?: { width: number; top: number; bottom: number };
};

const NO_CHROME = { top: 0, bottom: 0, side: 0 };
const SHORT_CHROME = { top: 0.05, bottom: 0.1, side: 0.04 };
const SHORT_RAIL = { width: 0.16, top: 0.52, bottom: 0.1 };
const STORY_CHROME = { top: 0.07, bottom: 0.09, side: 0.04 };

/** Default platform — the 16:9 the template's static hint already declares. */
export const DEFAULT_CREATOR_PLATFORM: CreatorPlatformId = "youtube";

export const CREATOR_PLATFORMS: readonly CreatorPlatform[] = [
  { id: "youtube", label: "YouTube · Video · 16:9", canvas: { width: 1920, height: 1080 }, chrome: NO_CHROME },
  { id: "youtube-shorts", label: "YouTube · Shorts · 9:16", canvas: { width: 1080, height: 1920 }, chrome: SHORT_CHROME, rail: SHORT_RAIL },
  { id: "tiktok", label: "TikTok · Video · 9:16", canvas: { width: 1080, height: 1920 }, chrome: SHORT_CHROME, rail: SHORT_RAIL },
  { id: "instagram-reel", label: "Instagram · Reel · 9:16", canvas: { width: 1080, height: 1920 }, chrome: SHORT_CHROME, rail: SHORT_RAIL },
  { id: "instagram-story", label: "Instagram · Story · 9:16", canvas: { width: 1080, height: 1920 }, chrome: STORY_CHROME },
  { id: "instagram-post", label: "Instagram · Post · 1:1", canvas: { width: 1080, height: 1080 }, chrome: NO_CHROME },
  { id: "instagram-portrait", label: "Instagram · Post · 4:5", canvas: { width: 1080, height: 1350 }, chrome: NO_CHROME },
  { id: "twitch", label: "Twitch · Stream / offline screen · 16:9", canvas: { width: 1920, height: 1080 }, chrome: NO_CHROME },
  { id: "x", label: "X · Post · 16:9", canvas: { width: 1600, height: 900 }, chrome: NO_CHROME },
  { id: "canvas", label: "Follow the canvas", chrome: NO_CHROME },
];

export const CREATOR_PLATFORM_IDS: CreatorPlatformId[] = CREATOR_PLATFORMS.map((p) => p.id);

export const CREATOR_PLATFORM_OPTIONS = CREATOR_PLATFORMS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export function isCreatorPlatformId(v: unknown): v is CreatorPlatformId {
  return typeof v === "string" && (CREATOR_PLATFORM_IDS as string[]).includes(v);
}

/** Unknown / unset → the default platform (never throws — a render must land). */
export function resolveCreatorPlatform(v: unknown): CreatorPlatform {
  const id = isCreatorPlatformId(v) ? v : DEFAULT_CREATOR_PLATFORM;
  return CREATOR_PLATFORMS.find((p) => p.id === id) as CreatorPlatform;
}

export type StageArea = {
  /** Inside the chrome — the card lives here. */
  safe: Rect;
  /** Reserved for the platform's buttons; the card never overlaps it. */
  rail?: Rect;
};

/** The platform's safe area (and rail) at a concrete canvas. */
export function platformStage(platform: CreatorPlatform, W: number, H: number): StageArea {
  const top = Math.round(H * platform.chrome.top);
  const bottom = Math.round(H * platform.chrome.bottom);
  const side = Math.round(W * platform.chrome.side);
  const safe: Rect = {
    x: side,
    y: top,
    w: Math.max(1, W - 2 * side),
    h: Math.max(1, H - top - bottom),
  };
  if (!platform.rail) return { safe };
  const railW = Math.round(W * platform.rail.width);
  const railTop = Math.round(H * platform.rail.top);
  const railBottom = Math.round(H * platform.rail.bottom);
  return {
    safe,
    rail: { x: W - railW, y: railTop, w: railW, h: Math.max(1, H - railTop - railBottom) },
  };
}
