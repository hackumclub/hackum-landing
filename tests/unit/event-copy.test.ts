// @vitest-environment node
import { describe, expect, it } from "vitest";
import { overviewFallback, type OverviewEvent } from "@/lib/events/overview";

const ev = (over: Partial<OverviewEvent> = {}): OverviewEvent => ({
  name: "Spring Hack", year: 2026, mode: "Offline", startsAt: "2026-12-01T06:00:00Z", approximateDate: false, status: "Open", ...over,
});

describe("overviewFallback (public page copy when an event has no description)", () => {
  it("reads in the future tense for an upcoming event (en)", () => {
    const s = overviewFallback("en", ev());
    expect(s).toContain("Spring Hack is an in-person event organised by Hackum");
    expect(s).toContain("December 1, 2026");
    expect(s).not.toMatch(/was a/);
    expect(s).not.toMatch(/Photos and results/);
  });
  it("uses an online mode word and the UB calendar day, not the browser's", () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Ulaanbaatar (UTC+8).
    expect(overviewFallback("en", ev({ mode: "Online", startsAt: "2026-11-30T23:30:00Z" }))).toContain("is an online event");
    expect(overviewFallback("en", ev({ startsAt: "2026-11-30T23:30:00Z" }))).toContain("December 1, 2026");
  });
  it("keeps the past tense for an ended event (en)", () => {
    const s = overviewFallback("en", ev({ status: "Ended" }));
    expect(s).toContain("Spring Hack was an in-person event organised by Hackum");
    expect(s).toContain("in 2026");
    expect(s).toContain("Photos and results");
  });
  it.each(["Soon", "Open", "Full", "Live", "Cancelled"])("treats %s as not past", (status) => {
    expect(overviewFallback("en", ev({ status }))).toContain(" is an ");
  });
  it("Mongolian: future wording differs from the past one", () => {
    const up = overviewFallback("mn", ev());
    const past = overviewFallback("mn", ev({ status: "Ended" }));
    expect(past).toContain("онд зохион байгуулсан");
    expect(up).not.toContain("онд зохион байгуулсан");
    expect(up).toContain("зохион байгуулах");
    expect(up).toContain("Spring Hack");
  });
  it("an approximate date falls back to the year alone", () => {
    expect(overviewFallback("en", ev({ approximateDate: true }))).toContain("in 2026");
    expect(overviewFallback("en", ev({ approximateDate: true }))).not.toContain("December");
  });
});
