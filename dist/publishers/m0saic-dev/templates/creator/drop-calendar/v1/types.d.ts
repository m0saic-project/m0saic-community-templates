import type { MosaicRegion, MosaicRegionsValue, MosaicTemplatePropDefinition, MosaicTimeRangeMs } from "@m0saic/types";
/**
 * Drop Calendar props — a monthly content-drop calendar for creators: the
 * calendar-on-the-wall look (month + year masthead, weekday header, day
 * grid) driven entirely by data, for YouTubers, streamers and musicians.
 * Pick the month, list the days something goes out (an upload, a stream, a
 * release), and each drop day fills with a teaser image/video or a styled
 * title. Special weekdays ("New Music Friday", "Stream Saturday") brand the
 * header columns. An optional
 * facecam video sits beside the calendar — trimmed to the region(s) you pick
 * on the clip scrubber, played as a reel when you pick more than one — and a
 * cue track timed against it highlights the day being talked about,
 * optionally superimposing that day's teaser over the calendar.
 */
/** One drop row: a day of the shown month, plus optional title and teaser. */
export type DropCalendarDay = {
    /** Day of the month, 1-31. */
    day: number;
    /** Short drop title shown in (or over) the cell. */
    title?: string;
    /**
     * 1-based index into the Teaser media list. 0/absent = auto: unclaimed
     * teasers fill drop days in day order after explicit picks are honored.
     */
    teaser?: number;
};
/**
 * Branded weekday header labels — one optional string per weekday. A set
 * field replaces that column's plain weekday name with the label in the
 * accent style ("Stream Saturday"); empty/unset keeps the plain name.
 * A group of scalars (not rows) so every header cell is a canvas edit
 * target: double-click any weekday to brand it.
 */
export type DropCalendarWeekdays = {
    sunday?: string;
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
};
/** One talk-track cue: `text` names a day of the month ("13", "day 13"). */
export type DropCalendarCue = {
    text: string;
    startMs?: number;
    endMs?: number;
};
export type DropCalendarLook = {
    /** How teaser media fills a day cell. Default "cover". */
    cellMediaFit?: "cover" | "contain";
    /** Show drop titles. Default true. */
    showTitles?: boolean;
    /** Show day numbers. Default true. */
    showDayNumbers?: boolean;
    /** Dim leading/trailing days of adjacent months. Default true. */
    dimAdjacent?: boolean;
};
/**
 * How consecutive facecam clips join. `style` is "cut" or any engine xfade
 * kernel ("fade", "dissolve", "wipeleft", …); only read when two or more
 * clips are picked.
 */
export type DropCalendarClipTransition = {
    /** Default "fade". */
    style?: string;
    /** Overlap length, seconds. Default 0.4. */
    durationSec?: number;
};
export type DropCalendarSpotlight = {
    /** Superimpose the cued day's teaser over the calendar. Default true. */
    enabled?: boolean;
    /** Spotlight size as a fraction of the table's smaller dimension. Default 0.62. */
    sizeFrac?: number;
    /** Dim the calendar behind the spotlight. Default true. */
    dim?: boolean;
    /**
     * Seconds after a cue starts before the spotlight (and the dim) come in —
     * the ring leads, the zoom follows. A cue shorter than the delay still
     * gets a short zoom at its end. Default 1.
     */
    delaySec?: number;
};
export type DropCalendarV1Props = {
    /**
     * Where the render is going (see platforms.ts): picks the canvas and the
     * safe area the card lays out in. "canvas" follows the host. Default
     * "youtube".
     */
    platform?: string;
    /** Month to render, 1-12. */
    month?: number;
    /** Year to render (Gregorian). */
    year?: number;
    /** First column of the week. Default "sunday". */
    weekStart?: "sunday" | "monday";
    /** Drop rows: day + optional title + optional teaser slot. */
    days?: DropCalendarDay[];
    /** Teaser images/videos, assigned to drop days (see DropCalendarDay.teaser). */
    teasers?: string[];
    /** Branded weekday header labels (empty = plain weekday name). */
    weekdays?: DropCalendarWeekdays;
    /**
     * Keep the table inside the platform's safe area (clear of its chrome and
     * action rail). false = use the whole canvas. Default true.
     */
    safeArea?: boolean;
    /**
     * Draw the platform's own UI (top bar, bottom caption area, action rail)
     * as translucent stand-ins over the render, to check nothing important
     * hides under it. Preview aid — off before posting. Default false.
     */
    showChrome?: boolean;
    /** Facecam video (portrait works best); enables the side-by-side layout. */
    facecam?: string;
    /**
     * Show the facecam AREA before there is a facecam: with no `facecam` set,
     * the slot renders a stand-in (the included starter) in the side-by-side
     * layout, bound as a drop target on the Make canvas — toggle it on, then
     * drag your clip in. Off = calendar only until a facecam is set. A still
     * stand-in keeps a no-footage render a poster (PNG). Default false.
     */
    facecamSlot?: boolean;
    /**
     * Corner the facecam sits in on portrait canvases (a picture-in-picture
     * over the calendar). Landscape and square keep the side-by-side layout
     * and ignore this. Default "top-left".
     */
    facecamCorner?: string;
    /** Facecam width on portrait canvases, as a fraction of the canvas width (0.2–0.5). Default 0.34. */
    facecamSize?: number;
    /** Facecam frame thickness in px (0 = no frame). Default 2. */
    facecamStrokePx?: number;
    /** Facecam frame colour. Empty = the theme's frame colour. */
    facecamStrokeColor?: string;
    /**
     * Escape hatch: WHERE the facecam goes, as a rect drawn on the preview
     * (`picker: "regions"`, one rect). When set it overrides the automatic
     * placement (side-by-side / corner) on every platform — the facecam is
     * exactly that rect and the calendar lays out as if there were no
     * facecam, so the user moves and resizes it visually, out of the way of
     * whatever matters to them. Empty = automatic placement.
     */
    facecamRegion?: MosaicRegionsValue | MosaicRegion[] | string;
    /**
     * Picked regions of the facecam, source-relative ms. Empty = the whole
     * video; one = trimmed to that region; several = played as a reel.
     */
    facecamClips?: MosaicTimeRangeMs[];
    /** How consecutive facecam clips join (2+ clips only). */
    facecamTransition?: DropCalendarClipTransition;
    /** Keep the facecam's audio. Default true. */
    facecamAudio?: boolean;
    /** Mute teaser videos playing in cells. Default true. */
    muteTeasers?: boolean;
    /** Talk-track cues timed against the facecam; each names a day to highlight. */
    cues?: DropCalendarCue[];
    /** Highlight hold for a cue with no end and no next cue, seconds. Default 4. */
    holdSec?: number;
    spotlight?: DropCalendarSpotlight;
    /** Named theme. Default "studio". */
    theme?: string;
    /** Accent override; empty = the theme's accent. */
    accentColor?: string;
    /** Canvas background override; empty = the theme's surface. */
    backgroundColor?: string;
    /** Font family. Roboto and JetBrains Mono are bundled (deterministic everywhere); any other name resolves from the system at render time. Default "Roboto". */
    fontFamily?: string;
    look?: DropCalendarLook;
    /** Dev-only layout contract wireframe/assertions. Default false. */
    debugLayout?: boolean;
    /** Dev-only zero-drift geometry contract wireframe. Wins over debugLayout
     *  when both are on (each debug view replaces the doc). Default false. */
    debugGeometry?: boolean;
};
/** Cue cap — one highlight (and possibly a spotlight) per cue. */
export declare const MAX_CUES = 31;
export declare const DropCalendarPropsSchema: Record<keyof DropCalendarV1Props, MosaicTemplatePropDefinition>;
