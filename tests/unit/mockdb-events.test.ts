// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { createEvent, previewEventChange, setEventStatus, updateEvent, type EventInput } from "@/lib/mockdb/events";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, queued } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  for (const id of ["a", "b", "c"]) addProfile(db, { id });
});
const input = (over: Partial<EventInput> = {}): EventInput => ({
  slug: "knowledge-day-7", kind: "knowledge_day", title: { mn: "Knowledge Day #7", en: "" }, tagline: { mn: "", en: "" }, description: { mn: "", en: "" },
  starts_at: at(100), ends_at: at(102), mode: "offline", venue_name: "МУИС 305", venue_address: null, online_url: null, audience: "open", school_scope: "all", capacity: 60, waitlist: true,
  reg_opens_at: null, reg_closes_at: null, cover_path: null, poster_path: null, themes: [], external_url: null, reg_mode: "rsvp", questions: [], team_mode: "none",
  team_size_min: 1, team_size_max: 1, decision_deadline: null, ...over,
});
const rsvp = (actor: string, eventId: string) => registerForEvent(ctx(db, actor), { eventId, answers: {} });

describe("createEvent", () => {
  it("creates a draft and records who created it", () => {
    const r = createEvent(ctx(db, "org"), input());
    expect(r.ok).toBe(true);
    expect(db.events[0]).toMatchObject({ slug: "knowledge-day-7", status: "draft", created_by: "org", ics_sequence: 0, tz: "Asia/Ulaanbaatar" });
    expect(db.audit_log.at(-1)).toMatchObject({ action: "event.create" });
  });
  it("is staff only and keeps slugs unique", () => {
    expect(createEvent(ctx(db, "a"), input())).toEqual({ ok: false, error: "forbidden" });
    createEvent(ctx(db, "org"), input());
    expect(createEvent(ctx(db, "org"), input())).toEqual({ ok: false, error: "conflict" });
  });
  it.each([
    ["a slug with capitals", { slug: "Bad Slug" }],
    ["a slug that is too short", { slug: "ab" }],
    ["no Mongolian title", { title: { mn: " ", en: "x" } }],
    ["an end before the start", { ends_at: at(99) }],
    ["zero capacity", { capacity: 0 }],
    ["capacity above 5000", { capacity: 5001 }],
    ["registration closing after the start", { reg_closes_at: at(101) }],
    ["an application event without a decision deadline", { reg_mode: "application" as const, decision_deadline: null }],
    ["teams with a minimum above the maximum", { team_mode: "optional" as const, team_size_min: 4, team_size_max: 2 }],
    ["an online event without an https link", { mode: "online" as const, online_url: "http://insecure.example.com" }],
    ["a duplicate question id", { questions: [{ id: "q", type: "short" as const, label: { mn: "a", en: "a" }, required: true }, { id: "q", type: "short" as const, label: { mn: "b", en: "b" }, required: false }] }],
  ])("rejects %s", (_n, over) => {
    expect(createEvent(ctx(db, "org"), input(over))).toEqual({ ok: false, error: "invalid" });
    expect(db.events).toHaveLength(0);
  });
});

describe("editing a published event", () => {
  beforeEach(() => {
    addEvent(db, { id: "e1", capacity: 10 });
    rsvp("a", "e1"); rsvp("b", "e1");
    db.notifications.length = 0;
  });
  it("re-invites everyone going when the time changes, and bumps the invite sequence", () => {
    const r = updateEvent(ctx(db, "org"), "e1", input({ slug: "e1-slug", starts_at: at(80), ends_at: at(82) }));
    expect(r).toEqual({ ok: true, data: { notified: 2 } });
    expect(db.events[0].ics_sequence).toBe(1);
    expect(queued(db, "event_updated").map((n) => n.profile_id).sort()).toEqual(["a", "b"]);
    expect(queued(db, "event_updated")[0].payload).toMatchObject({ ics_sequence: 1, changed: "starts_at,ends_at" });
  });
  it("stays quiet for changes people do not need to hear about", () => {
    const base = input({ slug: "e1-slug", starts_at: db.events[0].starts_at, ends_at: db.events[0].ends_at, venue_name: "МУИС 305", capacity: 10 });
    expect(updateEvent(ctx(db, "org"), "e1", { ...base, description: { mn: "Шинэ тайлбар", en: "" } })).toEqual({ ok: true, data: { notified: 0 } });
    expect(db.events[0].ics_sequence).toBe(0);
    expect(queued(db, "event_updated")).toHaveLength(0);
  });
  it("previews who would be told before anything is saved", () => {
    const r = previewEventChange(ctx(db, "org"), "e1", input({ slug: "e1-slug", starts_at: at(80), ends_at: at(82), venue_name: "Шинэ танхим" }));
    expect(r).toEqual({ ok: true, data: { changed: ["starts_at", "ends_at", "venue_name"], willNotify: 2, nonNumRegistrants: 0 } });
    expect(db.events[0].venue_name).toBe("МУИС 305");
  });
  it("does not notify anyone when a draft is edited", () => {
    addEvent(db, { id: "d1", status: "draft" });
    expect(updateEvent(ctx(db, "org"), "d1", input({ slug: "d1-slug", starts_at: at(90), ends_at: at(92) }))).toEqual({ ok: true, data: { notified: 0 } });
  });
  it("skips already-queued reminders that now point at the old time", () => {
    db.notifications.push({ id: "n1", profile_id: "a", to_email: null, channel: "email", template: "reminder_24h", payload: { event_id: "e1", starts_at: db.events[0].starts_at }, priority: 1, scheduled_at: at(0), status: "queued", attempts: 0, last_error: null, dedupe_key: "r1", sent_at: null });
    updateEvent(ctx(db, "org"), "e1", input({ slug: "e1-slug", starts_at: at(80), ends_at: at(82) }));
    expect(db.notifications.find((n) => n.id === "n1")!.status).toBe("skipped");
  });
});

describe("event status", () => {
  it("publishes a draft and walks the normal lifecycle", () => {
    addEvent(db, { id: "e1", status: "draft" });
    for (const s of ["published", "completed", "archived"] as const) expect(setEventStatus(ctx(db, "org"), "e1", s).ok).toBe(true);
    expect(db.events[0].status).toBe("archived");
  });
  it("refuses transitions that make no sense", () => {
    addEvent(db, { id: "e1", status: "archived" });
    expect(setEventStatus(ctx(db, "org"), "e1", "published")).toEqual({ ok: false, error: "conflict" });
    expect(setEventStatus(ctx(db, "a"), "e1", "draft")).toEqual({ ok: false, error: "forbidden" });
  });
  it("cancelling tells everyone with a seat, application or waitlist spot and drops queued reminders", () => {
    addEvent(db, { id: "e1", capacity: 1 });
    rsvp("a", "e1"); rsvp("b", "e1");
    db.notifications.push({ id: "n9", profile_id: "a", to_email: null, channel: "email", template: "reminder_24h", payload: { event_id: "e1" }, priority: 1, scheduled_at: at(0), status: "queued", attempts: 0, last_error: null, dedupe_key: "r9", sent_at: null });
    expect(setEventStatus(ctx(db, "org"), "e1", "cancelled").ok).toBe(true);
    expect(queued(db, "event_cancelled").map((n) => n.profile_id).sort()).toEqual(["a", "b"]);
    expect(db.notifications.find((n) => n.id === "n9")!.status).toBe("skipped");
  });
  it("won't send a draft back to draft once people have registered", () => {
    addEvent(db, { id: "e1" }); rsvp("a", "e1");
    expect(setEventStatus(ctx(db, "org"), "e1", "draft")).toEqual({ ok: false, error: "conflict" });
  });
});
