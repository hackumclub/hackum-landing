// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_RANGE_DAYS, addDays, parseRangeParams, previousRange, rangeDays } from "@/lib/date-range";
import { semesterRange, semesterOf } from "@/lib/semester";
import { csvCell } from "@/lib/csv-cell";
import { seriesToCsv } from "@/lib/admin/analytics-csv";

const DEFAULT = { from: "2026-09-01", to: "2026-12-31" };

describe("parseRangeParams", () => {
  it("accepts a valid from/to pair", () => {
    expect(parseRangeParams({ from: "2026-01-05", to: "2026-02-10" }, DEFAULT)).toEqual({ range: { from: "2026-01-05", to: "2026-02-10" }, custom: true });
  });
  it("falls back to the default when a date is missing, malformed or impossible", () => {
    for (const p of [{}, { from: "2026-01-05" }, { to: "2026-01-05" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "x", to: "y" }, { from: ["2026-01-01", "2026-01-02"], to: "2026-01-03" }]) {
      expect(parseRangeParams(p, DEFAULT)).toEqual({ range: DEFAULT, custom: false });
    }
  });
  it("falls back when from is after to, or the range is absurdly long", () => {
    expect(parseRangeParams({ from: "2026-05-02", to: "2026-05-01" }, DEFAULT).custom).toBe(false);
    expect(parseRangeParams({ from: "1990-01-01", to: "2026-05-01" }, DEFAULT).custom).toBe(false);
  });
  it("treats a range equal to the default as not custom (the URL stays clean)", () => {
    expect(parseRangeParams(DEFAULT, DEFAULT).custom).toBe(false);
  });
  it("accepts a one-day range", () => {
    expect(parseRangeParams({ from: "2026-11-16", to: "2026-11-16" }, DEFAULT).range).toEqual({ from: "2026-11-16", to: "2026-11-16" });
  });
});

describe("previousRange", () => {
  it("is the equal-length range ending the day before", () => {
    expect(previousRange({ from: "2026-11-10", to: "2026-11-16" })).toEqual({ from: "2026-11-03", to: "2026-11-09" });
  });
  it("handles a one-day range", () => {
    expect(previousRange({ from: "2026-11-16", to: "2026-11-16" })).toEqual({ from: "2026-11-15", to: "2026-11-15" });
  });
  it("crosses a semester boundary: autumn 2026 is followed back into the spring/summer before it, same length", () => {
    const autumn = semesterRange({ year: 2026, term: "autumn" });
    const prev = previousRange(autumn);
    expect(prev.to).toBe("2026-08-31");
    expect(rangeDays(prev)).toBe(rangeDays(autumn));
    expect(semesterOf(new Date(`${prev.to}T04:00:00Z`))).toEqual({ year: 2025, term: "spring" });
  });
  it("crosses a year boundary and a leap day", () => {
    expect(previousRange({ from: "2027-01-01", to: "2027-01-02" })).toEqual({ from: "2026-12-30", to: "2026-12-31" });
    expect(previousRange({ from: "2024-03-01", to: "2024-03-01" })).toEqual({ from: "2024-02-29", to: "2024-02-29" });
  });
});

describe("range helpers", () => {
  it("addDays works across month ends", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("counts inclusive days", () => {
    expect(rangeDays({ from: "2026-11-16", to: "2026-11-16" })).toBe(1);
    expect(rangeDays({ from: "2026-11-01", to: "2026-11-30" })).toBe(30);
    expect(MAX_RANGE_DAYS).toBe(800);
  });
});

describe("CSV export of the registrations series", () => {
  it("starts with a BOM, has a header, CRLF rows, and neutralises formula-looking cells", () => {
    const csv = seriesToCsv([{ day: "2026-11-01", n: 3 }, { day: "2026-11-02", n: 0 }], ["Date", "Registrations"]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split("\r\n")).toEqual(["Date,Registrations", "2026-11-01,3", "2026-11-02,0", ""]);
  });
  it("csvCell quotes and neutralises like the forms export", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("plain")).toBe("plain");
  });
});
