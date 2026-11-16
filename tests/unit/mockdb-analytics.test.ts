// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import type { RegStatus } from "@/lib/status";
import { analytics } from "@/lib/mockdb/analytics";
import { buildSeed } from "@/lib/mockdb/seed";
import { addEvent, addProfile, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
const reg = (event_id: string, profile_id: string, status: RegStatus, created = NOW.toISOString()) =>
  db.registrations.push({ id: `r${db.registrations.length}`, event_id, profile_id, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: created, cancelled_at: null });
const RANGE = { from: "2026-09-01", to: "2027-08-31" };

beforeEach(() => {
  db = emptyDb();
  addProfile(db, { id: "a", status: "member", school_id: "num", major_track: "software" });
  addProfile(db, { id: "b", status: "member", school_id: "num", major_track: "cs" });
  addProfile(db, { id: "c", status: "guest", school_id: "must", major_track: "other" });
  addProfile(db, { id: "d", status: "guest", school_id: null, major_track: null });
});

describe("funnel and show rate", () => {
  beforeEach(() => {
    addEvent(db, { id: "w1", kind: "workshop", status: "completed", starts_at: "2026-10-10T10:00:00Z", ends_at: "2026-10-10T12:00:00Z" });
    addEvent(db, { id: "m1", kind: "meetup", status: "published", starts_at: "2026-11-30T10:00:00Z", ends_at: "2026-11-30T12:00:00Z" });
    reg("w1", "a", "attended"); reg("w1", "b", "no_show"); reg("w1", "c", "cancelled"); reg("w1", "d", "attended");
    reg("m1", "a", "going"); reg("m1", "b", "waitlisted");
  });
  it("never grows from registered to going to attended, and ignores cancelled", () => {
    const f = analytics(db, RANGE).funnel;
    expect(f).toEqual({ registered: 5, going: 3, attended: 2 });
    expect(f.registered >= f.going && f.going >= f.attended).toBe(true);
  });
  it("show rate is attended over seats of completed events, and null (not 0) with nothing to measure", () => {
    const rows = analytics(db, RANGE).showRateByKind;
    expect(rows.find((r) => r.kind === "workshop")).toEqual({ kind: "workshop", rate: 2 / 3, n: 1 });
    expect(rows.find((r) => r.kind === "meetup")).toEqual({ kind: "meetup", rate: null, n: 0 });
  });
  it("only counts events that start inside the range (UB calendar days, inclusive)", () => {
    expect(analytics(db, { from: "2026-11-30", to: "2026-11-30" }).funnel.registered).toBe(2);
    expect(analytics(db, { from: "2026-12-01", to: "2027-01-01" }).funnel.registered).toBe(0);
  });
});

describe("registrations by day", () => {
  it("fills every day of the range with zero and buckets by Ulaanbaatar day", () => {
    addEvent(db, { id: "e1" });
    reg("e1", "a", "going", "2026-11-15T17:00:00Z"); // 01:00 on the 16th in UB
    reg("e1", "b", "going", "2026-11-16T03:00:00Z");
    const days = analytics(db, { from: "2026-11-15", to: "2026-11-17" }).registrationsByDay;
    expect(days).toEqual([{ day: "2026-11-15", n: 0 }, { day: "2026-11-16", n: 2 }, { day: "2026-11-17", n: 0 }]);
  });
  it("returns an empty list for an inverted range instead of looping", () => {
    expect(analytics(db, { from: "2026-12-01", to: "2026-11-01" }).registrationsByDay).toEqual([]);
  });
});

describe("semesters", () => {
  it("puts an event at 00:30 UB on Jan 1 in spring, and one at 23:30 UB on Dec 31 in autumn", () => {
    addEvent(db, { id: "late", status: "completed", starts_at: "2026-12-31T15:30:00Z", ends_at: "2026-12-31T16:00:00Z" });
    addEvent(db, { id: "new", status: "completed", starts_at: "2026-12-31T16:30:00Z", ends_at: "2026-12-31T17:00:00Z" });
    reg("late", "a", "attended"); reg("new", "a", "attended"); reg("new", "b", "attended");
    expect(analytics(db, RANGE).bySemester).toEqual([
      { year: 2026, term: "autumn", events: 1, registrations: 1, attended: 1 },
      { year: 2026, term: "spring", events: 1, registrations: 2, attended: 2 },
    ]);
  });
  it("retention: share of each first-attendance semester that came back in a later one", () => {
    addEvent(db, { id: "e1", status: "completed", starts_at: "2026-10-10T10:00:00Z", ends_at: "2026-10-10T12:00:00Z" });
    addEvent(db, { id: "e2", status: "completed", starts_at: "2027-03-10T10:00:00Z", ends_at: "2027-03-10T12:00:00Z" });
    reg("e1", "a", "attended"); reg("e1", "b", "attended"); reg("e2", "a", "attended"); reg("e2", "c", "attended");
    expect(analytics(db, RANGE).retention).toEqual([
      { cohort: "2026-autumn", returned: 1, total: 2 },
      { cohort: "2026-spring", returned: 0, total: 1 },
    ]);
  });
});

describe("who the members are", () => {
  it("counts people by school and by major track, biggest first, with unknown kept visible", () => {
    const r = analytics(db, RANGE);
    expect(r.membersBySchool).toEqual([{ school_id: "num", n: 2 }, { school_id: "must", n: 1 }, { school_id: "unknown", n: 1 }]);
    expect(r.membersByTrack).toEqual([{ track: "software", n: 1 }, { track: "cs", n: 1 }, { track: "other", n: 1 }, { track: "unknown", n: 1 }]);
  });
  it("ignores deleted profiles", () => {
    db.profiles.find((p) => p.id === "a")!.deleted_at = NOW.toISOString();
    expect(analytics(db, RANGE).membersBySchool[0]).toEqual({ school_id: "num", n: 1 });
  });
});

describe("over the demo seed", () => {
  it("produces finite numbers and a non-increasing funnel", () => {
    const seed = buildSeed(NOW);
    const r = analytics(seed, { from: "2025-09-01", to: "2027-08-31" });
    expect(r.funnel.registered >= r.funnel.going && r.funnel.going >= r.funnel.attended).toBe(true);
    for (const x of r.showRateByKind) expect(x.rate === null || (x.rate >= 0 && x.rate <= 1)).toBe(true);
    expect(r.bySemester.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
  });
});
