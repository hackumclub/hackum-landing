// @vitest-environment node
import { describe, expect, it } from "vitest";
import { kpiDelta, toAttention, getDashboard } from "@/lib/admin/dashboard";

describe("toAttention", () => {
  it("drops zero counts and orders by urgency", () => {
    const items = toAttention({ needs_en: 2, missing_cover: 1, failed_emails: 3, pending_members: 0, pending_applications: 5 }, "mn");
    expect(items.map((i) => i.kind)).toEqual(["failed_emails", "pending_applications", "missing_cover", "needs_en"]);
    expect(items[0]).toMatchObject({ count: 3, href: "/mn/admin/comms?status=failed" });
  });
  it("returns an empty list when nothing needs attention", () => {
    expect(toAttention({}, "en")).toEqual([]);
  });
});

describe("kpiDelta", () => {
  it("signs percentage changes with a true minus sign", () => {
    expect(kpiDelta(12, 8)).toEqual({ kind: "pct", text: "+50%", trend: "up" });
    expect(kpiDelta(6, 8)).toEqual({ kind: "pct", text: "−25%", trend: "down" });
    expect(kpiDelta(8, 8)).toEqual({ kind: "pct", text: "0%", trend: "flat" });
  });
  it("reports 'new' instead of Infinity when the previous period was zero", () => {
    expect(kpiDelta(5, 0)).toEqual({ kind: "new", trend: "up" });
    expect(kpiDelta(0, 0)).toEqual({ kind: "pct", text: "0%", trend: "flat" });
  });
});

describe("getDashboard (sample data until Supabase lands)", () => {
  it("serves an empty scenario with no upcoming events and no attention items", async () => {
    const d = await getDashboard({ scenario: "empty" });
    expect(d.upcoming).toEqual([]);
    expect(d.attention).toEqual([]);
    expect(d.sample).toBe(true);
  });
  it("orders upcoming events by start time", async () => {
    const d = await getDashboard({ scenario: "default" });
    const starts = d.upcoming.map((e) => e.startsAt.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
  it("rejects in the error scenario so the route error boundary renders", async () => {
    await expect(getDashboard({ scenario: "error" })).rejects.toThrow("dashboard_unavailable");
  });
});
