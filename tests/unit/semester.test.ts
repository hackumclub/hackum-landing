import { describe, expect, it } from "vitest";
import { previousSemester, semesterLabel, semesterOf, semesterRange } from "@/lib/semester";

describe("semesterOf (Ulaanbaatar wall clock, academic year starts in September)", () => {
  it.each([
    ["Jan 1 00:30 UB (UTC Dec 31 16:30) is already spring", "2026-12-31T16:30:00Z", { year: 2026, term: "spring" }],
    ["Dec 31 23:30 UB (UTC 15:30) is the last autumn minute", "2026-12-31T15:30:00Z", { year: 2026, term: "autumn" }],
    ["Aug 31 23:59 UB is the last spring minute", "2026-08-31T15:59:00Z", { year: 2025, term: "spring" }],
    ["Sep 1 00:00 UB starts autumn", "2026-08-31T16:00:00Z", { year: 2026, term: "autumn" }],
    ["mid November", "2026-11-16T04:00:00Z", { year: 2026, term: "autumn" }],
    ["mid April", "2027-04-15T04:00:00Z", { year: 2026, term: "spring" }],
  ])("%s", (_n, iso, expected) => {
    expect(semesterOf(new Date(iso))).toEqual(expected);
  });
});

describe("semester helpers", () => {
  it("previousSemester walks back across the year boundary", () => {
    expect(previousSemester({ year: 2026, term: "autumn" })).toEqual({ year: 2025, term: "spring" });
    expect(previousSemester({ year: 2026, term: "spring" })).toEqual({ year: 2026, term: "autumn" });
  });
  it("semesterRange gives UB calendar dates", () => {
    expect(semesterRange({ year: 2026, term: "autumn" })).toEqual({ from: "2026-09-01", to: "2026-12-31" });
    expect(semesterRange({ year: 2026, term: "spring" })).toEqual({ from: "2027-01-01", to: "2027-08-31" });
  });
  it("labels use the calendar year the term mostly falls in, in both languages", () => {
    expect(semesterLabel({ year: 2026, term: "autumn" }, "en")).toBe("Autumn 2026");
    expect(semesterLabel({ year: 2026, term: "spring" }, "en")).toBe("Spring 2027");
    expect(semesterLabel({ year: 2026, term: "autumn" }, "mn")).toBe("2026 оны намар");
    expect(semesterLabel({ year: 2026, term: "spring" }, "mn")).toBe("2027 оны хавар");
  });
});
