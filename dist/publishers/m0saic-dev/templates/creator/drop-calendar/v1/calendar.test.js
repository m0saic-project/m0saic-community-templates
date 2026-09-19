"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const calendar_1 = require("./calendar");
describe("dayOfWeek (Sakamoto)", () => {
    // Anchored against the client's reference calendars (2019) + known dates.
    it("matches the 2019 reference months", () => {
        expect((0, calendar_1.dayOfWeek)(2019, 5, 1)).toBe(3); // May 1 2019 — Wednesday
        expect((0, calendar_1.dayOfWeek)(2019, 7, 1)).toBe(1); // Jul 1 2019 — Monday
        expect((0, calendar_1.dayOfWeek)(2019, 9, 1)).toBe(0); // Sep 1 2019 — Sunday
        expect((0, calendar_1.dayOfWeek)(2019, 10, 1)).toBe(2); // Oct 1 2019 — Tuesday
    });
    it("handles leap-day math", () => {
        expect((0, calendar_1.dayOfWeek)(2024, 2, 29)).toBe(4); // Feb 29 2024 — Thursday
        expect((0, calendar_1.dayOfWeek)(2000, 1, 1)).toBe(6); // Jan 1 2000 — Saturday
    });
});
describe("daysInMonth / leap years", () => {
    it("month lengths", () => {
        expect((0, calendar_1.daysInMonth)(2026, 1)).toBe(31);
        expect((0, calendar_1.daysInMonth)(2026, 4)).toBe(30);
        expect((0, calendar_1.daysInMonth)(2026, 2)).toBe(28);
        expect((0, calendar_1.daysInMonth)(2024, 2)).toBe(29);
    });
    it("century rules", () => {
        expect((0, calendar_1.isLeapYear)(1900)).toBe(false);
        expect((0, calendar_1.isLeapYear)(2000)).toBe(true);
        expect((0, calendar_1.isLeapYear)(2024)).toBe(true);
        expect((0, calendar_1.isLeapYear)(2026)).toBe(false);
    });
});
describe("buildMonthGrid", () => {
    it("September 2019 (sunday start): 5 rows, no leading blanks", () => {
        const g = (0, calendar_1.buildMonthGrid)(2019, 9, "sunday");
        expect(g.weeks).toHaveLength(5);
        expect(g.weeks[0][0]).toEqual({ day: 1, inMonth: true });
        // Trailing cells carry October's first days, dimmed.
        expect(g.weeks[4][6]).toEqual({ day: 5, inMonth: false });
    });
    it("May 2019 (sunday start): leading cells carry April 28-30", () => {
        const g = (0, calendar_1.buildMonthGrid)(2019, 5, "sunday");
        expect(g.weeks[0].slice(0, 3).map((c) => c.day)).toEqual([28, 29, 30]);
        expect(g.weeks[0].slice(0, 3).every((c) => !c.inMonth)).toBe(true);
        expect(g.weeks[0][3]).toEqual({ day: 1, inMonth: true });
    });
    it("February 2026 (sunday start) is a perfect 4-row month", () => {
        const g = (0, calendar_1.buildMonthGrid)(2026, 2, "sunday");
        expect(g.weeks).toHaveLength(4);
        expect(g.weeks[0][0]).toEqual({ day: 1, inMonth: true });
        expect(g.weeks[3][6]).toEqual({ day: 28, inMonth: true });
    });
    it("monday start rotates the columns", () => {
        const g = (0, calendar_1.buildMonthGrid)(2019, 9, "monday");
        // Sep 1 2019 is a Sunday — last column under a monday start.
        expect(g.weeks[0][6]).toEqual({ day: 1, inMonth: true });
        expect(g.weekdayOfColumn[0]).toBe(1); // Monday leads
        expect(g.weekdayOfColumn[6]).toBe(0); // Sunday trails
        expect(g.weeks).toHaveLength(6); // 6 leading cells push 30 days to 6 rows
    });
    it("every row has exactly 7 cells and days are continuous", () => {
        const g = (0, calendar_1.buildMonthGrid)(2026, 10, "sunday");
        for (const week of g.weeks)
            expect(week).toHaveLength(7);
        const inMonth = g.weeks.flat().filter((c) => c.inMonth);
        expect(inMonth).toHaveLength(31);
        expect(inMonth[0].day).toBe(1);
        expect(inMonth[30].day).toBe(31);
    });
});
describe("parseCueDay", () => {
    it("finds the first number and range-checks it", () => {
        expect((0, calendar_1.parseCueDay)("13", 31)).toBe(13);
        expect((0, calendar_1.parseCueDay)("day 5 — teaser", 31)).toBe(5);
        expect((0, calendar_1.parseCueDay)("Oct 31!", 31)).toBe(31);
        expect((0, calendar_1.parseCueDay)("31", 30)).toBeUndefined();
        expect((0, calendar_1.parseCueDay)("0", 31)).toBeUndefined();
        expect((0, calendar_1.parseCueDay)("no digits", 31)).toBeUndefined();
        expect((0, calendar_1.parseCueDay)(undefined, 31)).toBeUndefined();
    });
});
