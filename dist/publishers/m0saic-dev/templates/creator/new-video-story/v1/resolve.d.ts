/**
 * Resolve — raw props → one canonical, validated config. The platform preset
 * fills every copy / badge / accent field the user left empty; the drawn
 * screenshot rect is parsed defensively (a bad value warns and falls back to
 * the default slot). Nothing here hard-fails: an announcement card must
 * always land, so unknown enum values fall back to their defaults.
 */
import type { MosaicRegion } from "@m0saic/types";
import { type AnnouncePlatform, type BadgeGlyph } from "./platforms";
import type { NewVideoStoryV1Props } from "./types";
export type MediaKind = "video" | "image";
export type ResolvedConfig = {
    platform: AnnouncePlatform;
    /** Screenshot path; "" = none (the placeholder slot renders). */
    media: string;
    /** The drawn screenshot rect, when one was drawn. */
    mediaRegion?: {
        canvas?: {
            w: number;
            h: number;
        };
        regions: MosaicRegion[];
    };
    /** Sticker lines, upper-cased. `top` may be "" (single-word headline). */
    headlineTop: string;
    headlineMain: string;
    cta: string;
    linkText: string;
    badge: BadgeGlyph;
    /** Badge image path; "" = the drawn glyph. */
    badgeImage: string;
    accent: string;
    background: string;
    mediaFit: "cover" | "contain";
    mediaFocus: number;
    mediaCorner: number;
    mediaAudio: boolean;
    animate: boolean;
};
export type ResolveOutcome = {
    ok: true;
    cfg: ResolvedConfig;
    warnings: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
/** Media kind from the engine probe, else the file extension. */
export declare function classifyMedia(path: string, probeKind: string | undefined): MediaKind;
/** A blank / cleared colour knob falls back (bare `??` keeps ""). */
export declare function resolveColor(v: unknown, fallback: string): string;
export declare function resolveNewVideoStory(props: NewVideoStoryV1Props): ResolveOutcome;
