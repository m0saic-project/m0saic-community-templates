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
export type AnnouncePlatformId = "youtube" | "youtube-shorts" | "tiktok" | "instagram-reel" | "instagram-post" | "twitch" | "podcast" | "x" | "custom";
/** Drawn badge glyphs (all polygon, arc-free — they animate). */
export type BadgeGlyph = "play" | "note" | "camera" | "live" | "none";
export declare const BADGE_GLYPHS: BadgeGlyph[];
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
export declare const DEFAULT_ANNOUNCE_PLATFORM: AnnouncePlatformId;
export declare const ANNOUNCE_PLATFORMS: readonly AnnouncePlatform[];
export declare const ANNOUNCE_PLATFORM_IDS: AnnouncePlatformId[];
export declare const ANNOUNCE_PLATFORM_OPTIONS: {
    value: AnnouncePlatformId;
    label: string;
}[];
export declare function isAnnouncePlatformId(v: unknown): v is AnnouncePlatformId;
/** Unknown / unset → the default platform (never throws — a render must land). */
export declare function resolveAnnouncePlatform(v: unknown): AnnouncePlatform;
export declare function isBadgeGlyph(v: unknown): v is BadgeGlyph;
/**
 * Split a headline into the sticker's two lines: everything before the last
 * space is the small top line, the last word the big line. A single word is
 * one big line. Whitespace is collapsed; the result is upper-cased (the
 * sticker is all caps by design).
 */
export declare function splitHeadline(text: string): {
    top: string;
    main: string;
};
