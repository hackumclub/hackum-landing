// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatUbStable } from "@/lib/time";

// 2026-11-16T10:05:00Z is 18:05 on the Ulaanbaatar clock (UTC+8).
const D = new Date("2026-11-16T10:05:00Z");

describe("formatUbStable", () => {
  it("renders English without ICU", () => {
    expect(formatUbStable(D, "en", "date")).toBe("Nov 16, 2026");
    expect(formatUbStable(D, "en", "short")).toBe("Nov 16");
    expect(formatUbStable(D, "en", "time")).toBe("6:05 PM");
    expect(formatUbStable(D, "en", "datetime")).toBe("Nov 16, 2026, 6:05 PM");
    expect(formatUbStable(D, "en", "datetimeShort")).toBe("Nov 16, 6:05 PM");
    expect(formatUbStable(D, "en", "dayLong")).toBe("Monday, November 16");
    expect(formatUbStable(D, "en", "monthYear")).toBe("Nov 2026");
    expect(formatUbStable(D, "mn", "monthYear")).toBe("2026 оны 11-р сар");
  });
  it("renders Mongolian without ICU", () => {
    expect(formatUbStable(D, "mn", "date")).toBe("2026 оны 11-р сарын 16");
    expect(formatUbStable(D, "mn", "short")).toBe("11-р сарын 16");
    expect(formatUbStable(D, "mn", "time")).toBe("18:05");
    expect(formatUbStable(D, "mn", "datetime")).toBe("2026 оны 11-р сарын 16, 18:05");
    expect(formatUbStable(D, "mn", "dayLong")).toBe("11-р сарын 16, Даваа гараг");
  });
  it("reads the Ulaanbaatar day across midnight and noon edges", () => {
    expect(formatUbStable(new Date("2026-12-31T16:30:00Z"), "en", "datetime")).toBe("Jan 1, 2027, 12:30 AM");
    expect(formatUbStable(new Date("2026-06-01T04:00:00Z"), "en", "time")).toBe("12:00 PM");
    expect(formatUbStable(new Date("2026-06-01T04:00:00Z"), "mn", "time")).toBe("12:00");
  });
  it("does not depend on Intl at all (same output when Intl.DateTimeFormat is broken)", () => {
    const real = Intl.DateTimeFormat;
    // @ts-expect-error simulate a runtime whose mn-MN data differs or is missing
    Intl.DateTimeFormat = function () { throw new Error("ICU differs"); };
    try {
      expect(formatUbStable(D, "mn", "datetime")).toBe("2026 оны 11-р сарын 16, 18:05");
    } finally { Intl.DateTimeFormat = real; }
  });
  it("returns an empty string for an invalid date", () => {
    expect(formatUbStable(new Date("nope"), "en", "date")).toBe("");
  });
});
