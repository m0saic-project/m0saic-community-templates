/**
 * Drop-calendar theme tokens — template-local design tokens, one set per
 * named theme. `studio` is the default — a dark stage with a charcoal card
 * and the electric-violet accent the rest of the creator pack uses, the look
 * a YouTuber, streamer or musician posts a schedule in. `classic` mirrors the
 * print-calendar reference (warm paper, near-black ink, deep red accent);
 * holiday sets re-skin the same roles so a seasonal calendar is a one-knob
 * change.
 */
export type CalendarThemeName = "studio" | "classic" | "noir" | "valentine" | "easter" | "halloween" | "thanksgiving" | "christmas";
export declare const CALENDAR_THEME_NAMES: CalendarThemeName[];
export type CalendarTheme = {
    /** Canvas behind the card (and behind the facecam letterbox). */
    surface: string;
    /** The card sheet the table sits on. */
    paper: string;
    /** Cell fill for adjacent-month (dimmed) days and the header shade. */
    paperMuted: string;
    /** Primary text + table lines. */
    ink: string;
    /** Adjacent-month day numbers, secondary text. */
    inkMuted: string;
    /** Table grid lines (usually = ink). */
    line: string;
    /** Special weekdays, drop titles, highlights. */
    accent: string;
    /** Text placed on accent fills. */
    accentInk: string;
    /** Translucent dark scrim behind text over media. */
    scrim: string;
    /** Thin frame around the facecam — a quiet edge that gives it its own area. */
    frame: string;
};
export declare function isCalendarThemeName(v: unknown): v is CalendarThemeName;
/**
 * Resolve theme tokens: named theme, with optional per-role overrides (empty
 * strings mean "keep the theme's value").
 */
export declare function resolveCalendarTheme(name: CalendarThemeName, overrides?: {
    accent?: string;
    surface?: string;
}): CalendarTheme;
