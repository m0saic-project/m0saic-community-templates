/**
 * Pure month math for the drop-calendar template.
 *
 * Deterministic by construction: no `Date` objects anywhere (not even with
 * explicit args) — weekday-of-date is Sakamoto's algorithm, month lengths are
 * table + leap rule. Same inputs → same grid, byte-identical (CLAUDE.md
 * §Determinism).
 */
export declare const MONTH_NAMES: readonly ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export declare const WEEKDAY_NAMES: readonly ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export declare const WEEKDAY_ABBREV: readonly ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Prop-key spelling of each weekday (the `weekdays` group's field names). */
export declare const WEEKDAY_KEYS: readonly ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export type WeekStart = "sunday" | "monday";
export declare function isLeapYear(year: number): boolean;
/** Days in a month. `month` is 1-12. */
export declare function daysInMonth(year: number, month: number): number;
/**
 * Day of week for a date (0 = Sunday … 6 = Saturday), Sakamoto's algorithm.
 * Valid for the Gregorian calendar; `month` is 1-12.
 */
export declare function dayOfWeek(year: number, month: number, day: number): number;
/** One grid cell: a day number plus whether it belongs to the shown month. */
export type MonthCell = {
    /** Day-of-month number shown in the cell (of this, prev, or next month). */
    day: number;
    /** True when the cell is a day of the displayed month. */
    inMonth: boolean;
};
export type MonthGrid = {
    /** Row-major weeks; every row has exactly 7 cells. */
    weeks: MonthCell[][];
    /** Column index (0-6) for each weekday 0=Sun..6=Sat, given the week start. */
    columnOfWeekday: number[];
    /** Weekday (0=Sun..6=Sat) shown in each column 0-6. */
    weekdayOfColumn: number[];
};
/**
 * Build the month grid: leading cells carry the previous month's trailing
 * days, trailing cells the next month's first days (both `inMonth: false`).
 * Row count is exactly what the month needs (4-6).
 */
export declare function buildMonthGrid(year: number, month: number, weekStart: WeekStart): MonthGrid;
/**
 * Pull a day-of-month out of a cue's text: the FIRST integer run in the
 * string ("13", "day 13", "Oct 13 — teaser"). Returns undefined when no
 * number (or an out-of-range one) is present.
 */
export declare function parseCueDay(text: unknown, monthDayCount: number): number | undefined;
