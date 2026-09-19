/**
 * Announce platforms — WHAT the story announces (a YouTube upload, a Short,
 * a TikTok, a Reel, a stream, a podcast episode …), not where the story is
 * posted: the output is always a 9:16 story. Each preset fills the copy a
 * creator would otherwise type every time — the two-line sticker headline,
 * the boxed call-to-action, the link-pill text — plus the badge glyph and
 * the accent colour that reads as that platform. Every field is a prop
 * override away; the preset is the zero-typing default.
 *
 * Brand marks: the badges are DRAWN generic glyphs (a play button, a music
 * note, a camera ring, a live dot), never the platforms' trademarked icons.
 * YouTube / Meta / TikTok each publish brand resources that let a creator
 * use the official icon to point at their own channel; the `badgeImage`
 * prop is where that downloaded file goes.
 */

export type AnnouncePlatformId =
  | "youtube"
  | "youtube-shorts"
  | "tiktok"
  | "instagram-reel"
  | "instagram-post"
  | "twitch"
  | "podcast"
  | "x"
  | "custom";

/** Drawn badge glyphs (all polygon, arc-free — they animate). */
export type BadgeGlyph = "play" | "note" | "camera" | "live" | "none";

export const BADGE_GLYPHS: BadgeGlyph[] = ["play", "note", "camera", "live", "none"];

export type AnnouncePlatform = {
  id: AnnouncePlatformId;
  /** Option label in the props panel. */
  label: string;
  /** Sticker headline; the LAST word is the big line ("NEW VIDEO" → NEW / VIDEO). */
  headline: string;
  /** Boxed call-to-action under the headline. */
  cta: string;
  /** Link-pill text — the domain the Instagram link sticker will carry. */
  linkText: string;
  badge: BadgeGlyph;
  /** Badge colour (and the platform's accent). */
  accent: string;
};

export const DEFAULT_ANNOUNCE_PLATFORM: AnnouncePlatformId = "youtube";

export const ANNOUNCE_PLATFORMS: readonly AnnouncePlatform[] = [
  { id: "youtube", label: "YouTube · Video", headline: "NEW VIDEO", cta: "WATCH FULL VIDEO HERE", linkText: "YOUTU.BE", badge: "play", accent: "#FF0000" },
  { id: "youtube-shorts", label: "YouTube · Short", headline: "NEW SHORT", cta: "WATCH IT HERE", linkText: "YOUTUBE.COM/SHORTS", badge: "play", accent: "#FF0000" },
  { id: "tiktok", label: "TikTok · Video", headline: "NEW TIKTOK", cta: "WATCH IT HERE", linkText: "TIKTOK.COM", badge: "note", accent: "#FE2C55" },
  { id: "instagram-reel", label: "Instagram · Reel", headline: "NEW REEL", cta: "WATCH IT HERE", linkText: "INSTAGRAM.COM", badge: "camera", accent: "#E1306C" },
  { id: "instagram-post", label: "Instagram · Post", headline: "NEW POST", cta: "SEE IT HERE", linkText: "INSTAGRAM.COM", badge: "camera", accent: "#E1306C" },
  { id: "twitch", label: "Twitch · Stream", headline: "LIVE NOW", cta: "WATCH THE STREAM", linkText: "TWITCH.TV", badge: "live", accent: "#9146FF" },
  { id: "podcast", label: "Podcast · Episode", headline: "NEW EPISODE", cta: "LISTEN TO THE FULL EPISODE", linkText: "OPEN.SPOTIFY.COM", badge: "note", accent: "#1DB954" },
  { id: "x", label: "X · Post", headline: "NEW POST", cta: "READ IT HERE", linkText: "X.COM", badge: "none", accent: "#FFFFFF" },
  { id: "custom", label: "Custom", headline: "NEW DROP", cta: "CHECK IT OUT", linkText: "LINK BELOW", badge: "none", accent: "#FF0000" },
];

export const ANNOUNCE_PLATFORM_IDS: AnnouncePlatformId[] = ANNOUNCE_PLATFORMS.map((p) => p.id);

export const ANNOUNCE_PLATFORM_OPTIONS = ANNOUNCE_PLATFORMS.map((p) => ({
  value: p.id,
  label: p.label,
}));

export function isAnnouncePlatformId(v: unknown): v is AnnouncePlatformId {
  return typeof v === "string" && (ANNOUNCE_PLATFORM_IDS as string[]).includes(v);
}

/** Unknown / unset → the default platform (never throws — a render must land). */
export function resolveAnnouncePlatform(v: unknown): AnnouncePlatform {
  const id = isAnnouncePlatformId(v) ? v : DEFAULT_ANNOUNCE_PLATFORM;
  return ANNOUNCE_PLATFORMS.find((p) => p.id === id) as AnnouncePlatform;
}

export function isBadgeGlyph(v: unknown): v is BadgeGlyph {
  return typeof v === "string" && (BADGE_GLYPHS as string[]).includes(v);
}

/**
 * Split a headline into the sticker's two lines: everything before the last
 * space is the small top line, the last word the big line. A single word is
 * one big line. Whitespace is collapsed; the result is upper-cased (the
 * sticker is all caps by design).
 */
export function splitHeadline(text: string): { top: string; main: string } {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { top: "", main: "" };
  if (words.length === 1) return { top: "", main: words[0] };
  return { top: words.slice(0, -1).join(" "), main: words[words.length - 1] };
}
