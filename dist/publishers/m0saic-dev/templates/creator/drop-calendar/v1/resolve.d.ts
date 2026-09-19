/**
 * Resolve — raw props → one canonical, validated config. All list props
 * (Drops rows, special weekdays, cues) arrive as untyped JSON; everything is
 * parsed defensively here so compose works on clean data only. Recoverable
 * problems (a day outside the month, an unknown weekday, an untimed cue)
 * are skipped with a warning; only nonsense months/years hard-fail.
 *
 * Cue times arrive as FACECAM-SOURCE ms (that's what the cue studio stamps
 * against) and leave as OUTPUT seconds: with picked facecam clips they are
 * mapped through the reel, and a cue in dropped footage is skipped.
 */
import { type MonthGrid, type WeekStart } from "./calendar";
import { type FacecamReel, type FacecamReelOutcome } from "./facecamReel";
import { type CalendarTheme } from "./themes";
import type { MosaicRegion } from "@m0saic/types";
import { type DropCalendarV1Props } from "./types";
import { type CreatorPlatform } from "./platforms";
export type MediaKind = "video" | "image";
/** One resolved drop: a valid in-month day, with optional title/teaser. */
export type ResolvedDrop = {
    day: number;
    title: string;
    /** Index into cfg.teasers, or undefined for a text-only drop. */
    teaserIndex?: number;
    /** ORIGINAL index of this row in props.days — canvas prop bindings route
     *  through it, so it must survive filtering/sorting untouched. */
    rowIndex: number;
};
/** One resolved cue window on the output timeline (seconds). */
export type ResolvedCue = {
    day: number;
    startSec: number;
    endSec: number;
};
export type ResolvedConfig = {
    year: number;
    month: number;
    weekStart: WeekStart;
    grid: MonthGrid;
    monthDayCount: number;
    /** Keyed by day-of-month for O(1) cell lookup. */
    dropsByDay: Map<number, ResolvedDrop>;
    /** ORIGINAL props.days row count — empty-date ADD handles bind the next
     *  free index (`days[dayRowCount]`), which `writeLeaf` pads into being. */
    dayRowCount: number;
    teasers: string[];
    /** Header label per weekday 0=Sun..6=Sat; undefined = plain weekday name. */
    specialLabelByWeekday: (string | undefined)[];
    facecam: string;
    /** Show the facecam area with the included starter while `facecam` is
     *  empty (a drop target on the Make canvas). */
    facecamSlot: boolean;
    /** Portrait picture-in-picture placement (ignored on landscape / square). */
    facecamCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    facecamSize: number;
    /** Frame around the facecam: thickness in px (0 = none) and colour ("" = theme). */
    facecamStrokePx: number;
    facecamStrokeColor: string;
    /**
     * The drawn facecam rect (escape hatch), still in its authored canvas —
     * compose rescales it onto the render canvas. Undefined = automatic
     * placement.
     */
    facecamRegion?: {
        canvas?: {
            w: number;
            h: number;
        };
        regions: MosaicRegion[];
    };
    /** Keep the table inside the platform's safe area (false = whole canvas). */
    safeArea: boolean;
    /** Preview aid: paint the platform's chrome as translucent stand-ins. */
    showChrome: boolean;
    /** Picked facecam regions; undefined = play the whole video. */
    facecamReel?: FacecamReel;
    facecamAudio: boolean;
    muteTeasers: boolean;
    cues: ResolvedCue[];
    holdSec: number;
    spotlight: {
        enabled: boolean;
        sizeFrac: number;
        dim: boolean;
        delaySec: number;
    };
    theme: CalendarTheme;
    /** Where the render is going — canvas + safe area (see platforms.ts). */
    platform: CreatorPlatform;
    fontFamily: string;
    cellMediaFit: "cover" | "contain";
    showTitles: boolean;
    showDayNumbers: boolean;
    dimAdjacent: boolean;
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
/**
 * Classify a media reference as video or image: engine probe first (when the
 * host supplied one), file extension second, image as the safe default (a
 * teaser is most often a thumbnail).
 */
export declare function classifyMedia(path: string, probeKind: string | undefined): MediaKind;
export declare function resolveDropCalendar(props: DropCalendarV1Props, durationSec: number, 
/**
 * The facecam reel, already resolved against the probed source length (the
 * render owns the probe). Omitted = play the whole facecam, and cue times
 * are output times as they always were.
 */
facecam?: FacecamReelOutcome): ResolveOutcome;
