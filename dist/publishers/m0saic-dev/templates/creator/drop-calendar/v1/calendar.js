"use strict";
/**
 * Pure month math for the drop-calendar template.
 *
 * Deterministic by construction: no `Date` objects anywhere (not even with
 * explicit args) — weekday-of-date is Sakamoto's algorithm, month lengths are
 * table + leap rule. Same inputs → same grid, byte-identical (CLAUDE.md
 * §Determinism).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEEKDAY_KEYS = exports.WEEKDAY_ABBREV = exports.WEEKDAY_NAMES = exports.MONTH_NAMES = void 0;
exports.isLeapYear = isLeapYear;
exports.daysInMonth = daysInMonth;
exports.dayOfWeek = dayOfWeek;
exports.buildMonthGrid = buildMonthGrid;
exports.parseCueDay = parseCueDay;
exports.MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
exports.WEEKDAY_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
exports.WEEKDAY_ABBREV = [
    "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
];
/** Prop-key spelling of each weekday (the `weekdays` group's field names). */
exports.WEEKDAY_KEYS = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Days in a month. `month` is 1-12. */
function daysInMonth(year, month) {
    if (month === 2 && isLeapYear(year))
        return 29;
    return MONTH_DAYS[month - 1];
}
/**
 * Day of week for a date (0 = Sunday … 6 = Saturday), Sakamoto's algorithm.
 * Valid for the Gregorian calendar; `month` is 1-12.
 */
function dayOfWeek(year, month, day) {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const y = month < 3 ? year - 1 : year;
    return ((y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7);
}
/**
 * Build the month grid: leading cells carry the previous month's trailing
 * days, trailing cells the next month's first days (both `inMonth: false`).
 * Row count is exactly what the month needs (4-6).
 */
function buildMonthGrid(year, month, weekStart) {
    const startOffset = weekStart === "monday" ? 1 : 0;
    const weekdayOfColumn = Array.from({ length: 7 }, (_, c) => (c + startOffset) % 7);
    const columnOfWeekday = Array.from({ length: 7 }, (_, w) => (w - startOffset + 7) % 7);
    const first = dayOfWeek(year, month, 1);
    const lead = columnOfWeekday[first];
    const count = daysInMonth(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevCount = daysInMonth(prevYear, prevMonth);
    const rows = Math.ceil((lead + count) / 7);
    const weeks = [];
    let cursor = 1 - lead;
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < 7; c++, cursor++) {
            if (cursor < 1) {
                row.push({ day: prevCount + cursor, inMonth: false });
            }
            else if (cursor > count) {
                row.push({ day: cursor - count, inMonth: false });
            }
            else {
                row.push({ day: cursor, inMonth: true });
            }
        }
        weeks.push(row);
    }
    return { weeks, columnOfWeekday, weekdayOfColumn };
}
/**
 * Pull a day-of-month out of a cue's text: the FIRST integer run in the
 * string ("13", "day 13", "Oct 13 — teaser"). Returns undefined when no
 * number (or an out-of-range one) is present.
 */
function parseCueDay(text, monthDayCount) {
    if (typeof text !== "string")
        return undefined;
    const m = text.match(/\d{1,2}/);
    if (!m)
        return undefined;
    const d = Number(m[0]);
    if (!Number.isInteger(d) || d < 1 || d > monthDayCount)
        return undefined;
    return d;
}
