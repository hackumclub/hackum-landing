// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import type { RegStatus } from "@/lib/status";
import { submitFeedback } from "@/lib/mockdb/feedback";
import { createPoll, setPollStatus, vote } from "@/lib/mockdb/polls";
import { eventReport, periodReport } from "@/lib/mockdb/reports";
import { buildSeed } from "@/lib/mockdb/seed";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
const reg = (event_id: string, profile_id: string, status: RegStatus, created = at(-300)) =>
  db.registrations.push({ id: `r${db.registrations.length}`, event_id, profile_id, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: created, cancelled_at: null });
const RANGE = { from: "2026-09-01", to: "2026-12-31" };

beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "a", status: "member", school_id: "num", major_track: "software" });
  addProfile(db, { id: "b", status: "member", school_id: "num", major_track: "cs" });
  addProfile(db, { id: "c", status: "guest", school_id: "must", major_track: "other" });
  addProfile(db, { id: "d", status: "guest", school_id: null, major_track: null });
  addEvent(db, { id: "old", kind: "workshop", status: "completed", starts_at: at(-24 * 20), ends_at: at(-24 * 20 + 2) });
  addEvent(db, { id: "done", kind: "meetup", status: "completed", starts_at: at(-6), ends_at: at(-4) });
  reg("old", "a", "attended");
  reg("done", "a", "attended", at(-24 * 3)); reg("done", "b", "attended", at(-24 * 3 + 5)); reg("done", "c", "attended", at(-24)); reg("done", "d", "no_show"); reg("done", "a", "cancelled");
  db.registrations.pop(); // one row per person and event
  reg("done", "org", "waitlisted");
});

describe("eventReport", () => {
  it("counts the funnel, show rate and who actually came", () => {
    const r = eventReport(db, "done")!;
    expect(r.funnel).toEqual({ registered: 5, going: 3, attended: 3, no_show: 1, waitlisted: 1 });
    expect(r.showRate).toBe(3 / 4);
    expect(r.attendeesBySchool).toEqual([{ school_id: "num", n: 2 }, { school_id: "must", n: 1 }]);
    expect(r.attendeesByTrack).toEqual([{ track: "software", n: 1 }, { track: "cs", n: 1 }, { track: "other", n: 1 }]);
  });
  it("splits attendees into first-timers and people who came to an earlier event", () => {
    expect(eventReport(db, "done")!.newVsReturning).toEqual({ new: 2, returning: 1 });
  });
  it("charts registrations by Ulaanbaatar day up to the event day, zero-filled", () => {
    const days = eventReport(db, "done")!.registrationsByDay;
    expect(days.length).toBeGreaterThanOrEqual(3);
    expect(days.reduce((s, d) => s + d.n, 0)).toBe(5);
    expect(days.every((d, i) => i === 0 || d.day > days[i - 1].day)).toBe(true);
  });
  it("embeds the feedback summary and is null for an unknown event; not-yet-completed events have a null show rate", () => {
    submitFeedback(ctx(db, "a"), { eventId: "done", rating: 4, nps: 9, went_well: "ok", improve: "", anonymous: true });
    expect(eventReport(db, "done")!.feedback).toMatchObject({ n: 1, avgRating: 4 });
    expect(eventReport(db, "nope")).toBeNull();
    addEvent(db, { id: "next", status: "published" });
    expect(eventReport(db, "next")!.showRate).toBeNull();
  });
});

describe("periodReport", () => {
  it("lists events with attendance and feedback, biggest first, and poll turnout", () => {
    submitFeedback(ctx(db, "a"), { eventId: "done", rating: 5, nps: 10, went_well: "", improve: "", anonymous: false });
    const poll = createPoll(ctx(db, "org"), { title: { mn: "Санал", en: "Poll" }, description: { mn: "", en: "" }, options: [{ id: "x", label: { mn: "X", en: "" } }, { id: "y", label: { mn: "Y", en: "" } }], multi: false, max_choices: 1, audience: "members", anonymous: true, results: "after_close", opens_at: null, closes_at: null });
    if (!poll.ok) throw new Error(poll.error);
    setPollStatus(ctx(db, "org"), poll.data.id, "published");
    vote(ctx(db, "a"), { pollId: poll.data.id, optionIds: ["x"] });
    setPollStatus(ctx(db, "org"), poll.data.id, "closed");
    const r = periodReport(db, { from: "2026-10-01", to: "2026-12-31" }, NOW);
    expect(r.events[0]).toMatchObject({ id: "done", attended: 3, responses: 1, rating: 5, nps: 100 });
    expect(r.polls[0]).toMatchObject({ id: poll.data.id, voters: 1, eligible: 2, turnout: 0.5 });
    expect(r.feedback).toMatchObject({ responses: 1, avgRating: 5, nps: 100 });
    expect(r.analytics.funnel.attended).toBeGreaterThan(0);
  });
  it("is finite and empty-safe", () => {
    const empty = periodReport(db, { from: "2030-01-01", to: "2030-12-31" }, NOW);
    expect(empty.events).toEqual([]);
    expect(empty.feedback).toEqual({ responses: 0, avgRating: null, nps: null });
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
  });
  it("works over the demo seed", () => {
    const seed = buildSeed(NOW);
    expect(JSON.stringify(periodReport(seed, { from: "2025-09-01", to: "2027-08-31" }, NOW))).not.toMatch(/NaN|Infinity/);
  });
});
void RANGE;
