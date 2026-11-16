import { describe, expect, it } from "vitest";
import { addDays, addMonths, dayName, endOfMonth, isBetween, isIso, monthTitle, monthWeeks, parseTime, shiftTime, startOfWeek, weekday } from "@/lib/calendar";

describe("calendar arithmetic (UB calendar days, Monday first)", () => {
  it("validates real calendar days only", () => {
    expect(isIso("2026-02-28")).toBe(true);
    expect(isIso("2026-02-30")).toBe(false);
    expect(isIso("2026-2-3")).toBe(false);
    expect(isIso("2028-02-29")).toBe(true);
  });
  it("moves by days and clamps month ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("starts the week on Monday", () => {
    expect(weekday("2026-11-16")).toBe(0); // a Monday
    expect(weekday("2026-11-22")).toBe(6);
    expect(startOfWeek("2026-11-19")).toBe("2026-11-16");
  });
  it("lays a month out in Monday-first weeks with null padding", () => {
    const w = monthWeeks("2026-11-10");
    expect(w[0].filter(Boolean)).toEqual(["2026-11-01"]); // Nov 1 2026 is a Sunday
    expect(w[0][6]).toBe("2026-11-01");
    expect(w.at(-1)!.filter(Boolean).at(-1)).toBe(endOfMonth("2026-11-10"));
    expect(w.flat().filter(Boolean)).toHaveLength(30);
    expect(w.every((row) => row.length === 7)).toBe(true);
  });
  it("tells whether a day is inside a range in either order", () => {
    expect(isBetween("2026-11-10", "2026-11-01", "2026-11-30")).toBe(true);
    expect(isBetween("2026-11-10", "2026-11-30", "2026-11-01")).toBe(true);
    expect(isBetween("2026-12-01", "2026-11-01", "2026-11-30")).toBe(false);
    expect(isBetween("2026-11-10", null, "2026-11-30")).toBe(false);
  });
  it("names months and days in both languages", () => {
    expect(monthTitle("2026-11-16", "en")).toBe("November 2026");
    expect(monthTitle("2026-11-16", "mn")).toBe("2026 оны 11-р сар");
    expect(dayName("2026-11-16", "en")).toBe("Monday, November 16, 2026");
    expect(dayName("2026-11-16", "mn")).toBe("2026 оны 11-р сарын 16, Даваа");
  });
  it("parses and shifts HH:mm times", () => {
    expect(parseTime("9:30")).toBe("09:30");
    expect(parseTime("0930")).toBe("09:30");
    expect(parseTime("930")).toBe("09:30");
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(shiftTime("23:50", 15)).toBe("00:05");
    expect(shiftTime("00:05", -15)).toBe("23:50");
  });
});
