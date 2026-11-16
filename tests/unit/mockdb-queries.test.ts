// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { attentionCounts, eventForViewer, eventStats, kpis, membersDirectory, myEvents, publicEvents, upcomingEvents } from "@/lib/mockdb/queries";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  for (const id of ["a", "b", "c"]) addProfile(db, { id });
});
const rsvp = (actor: string, eventId: string, when = NOW) => registerForEvent(ctx(db, actor, when), { eventId, answers: {} });

describe("what the public can see", () => {
  it("lists published, completed and archived events but never drafts or cancelled ones", () => {
    for (const status of ["draft", "published", "cancelled", "completed", "archived"] as const) addEvent(db, { id: status, status });
    expect(publicEvents(db).map((e) => e.id).sort()).toEqual(["archived", "completed", "published"]);
  });
  it("hides the online link from everyone except people with a seat and staff", () => {
    addEvent(db, { id: "w", mode: "online", online_url: "https://meet.example.com/x" });
    rsvp("a", "w");
    expect(eventForViewer(db, "w-slug", null)?.online_url).toBeNull();
    expect(eventForViewer(db, "w-slug", "b")?.online_url).toBeNull();
    expect(eventForViewer(db, "w-slug", "a")?.online_url).toBe("https://meet.example.com/x");
    expect(eventForViewer(db, "w-slug", "org")?.online_url).toBe("https://meet.example.com/x");
  });
  it("returns nothing for a draft slug, even to a signed-in guest", () => {
    addEvent(db, { id: "d", status: "draft" });
    expect(eventForViewer(db, "d-slug", "a")).toBeNull();
    expect(eventForViewer(db, "d-slug", "org")).not.toBeNull();
  });
});

describe("event statistics", () => {
  it("counts each status and splits attendees into new and returning", () => {
    addEvent(db, { id: "old", starts_at: at(-500), ends_at: at(-498) });
    addEvent(db, { id: "now", capacity: 2 });
    rsvp("a", "old", new Date(at(-600))); db.registrations[0].status = "attended"; db.events[0].status = "completed";
    rsvp("a", "now"); rsvp("b", "now"); rsvp("c", "now");
    expect(eventStats(db, "now")).toMatchObject({ going: 2, waitlisted: 1, applied: 0, newAttendees: 1, returningAttendees: 1 });
  });
});

describe("dashboard numbers", () => {
  it("compares RSVPs in the last 30 days with the 30 days before", () => {
    addEvent(db, { id: "e1" }); addEvent(db, { id: "e2" });
    rsvp("a", "e1"); rsvp("b", "e1"); rsvp("c", "e2");
    db.registrations[2].created_at = at(-24 * 45);
    expect(kpis(db, NOW)).toMatchObject({ rsvps30d: 2, rsvpsPrev30d: 1, upcomingEvents: 2, guestsTotal: 4, membersTotal: 0 });
  });
  it("counts only members who showed up or were seen in the last 90 days as active", () => {
    db.profiles.find((p) => p.id === "a")!.status = "member"; db.profiles.find((p) => p.id === "a")!.last_seen_at = at(-24 * 10);
    db.profiles.find((p) => p.id === "b")!.status = "member"; db.profiles.find((p) => p.id === "b")!.last_seen_at = at(-24 * 200);
    expect(kpis(db, NOW).activeMembers90d).toBe(1);
  });
  it("flags what needs attention: failed email, applications waiting, missing cover, missing English", () => {
    addEvent(db, { id: "app", reg_mode: "application", decision_deadline: at(48), cover_path: "/x.jpg" });
    addEvent(db, { id: "plain", title: { mn: "Зөвхөн монгол", en: "" } });
    addEvent(db, { id: "past", status: "archived", cover_path: null, title: { mn: "x", en: "" } });
    db.registrations.push({ id: "r1", event_id: "app", profile_id: "a", status: "applied", source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-1), cancelled_at: null });
    db.membership_applications.push({ id: "m1", profile_id: "b", season: 2027, motivation: "x", team_interest: [], answers: {}, status: "pending", reviewed_by: null, reviewed_at: null, review_note: null, created_at: at(-1) });
    db.notifications.push({ id: "n1", profile_id: "a", to_email: null, channel: "email", template: "welcome", payload: {}, priority: 0, scheduled_at: at(-1), status: "failed", attempts: 5, last_error: "x", dedupe_key: "k", sent_at: null });
    expect(attentionCounts(db)).toEqual({ failed_emails: 1, pending_applications: 1, pending_members: 1, missing_cover: 1, needs_en: 1 });
  });
  it("lists upcoming events soonest first, drafts included, past ones excluded", () => {
    addEvent(db, { id: "far", starts_at: at(500), ends_at: at(502) }); addEvent(db, { id: "near", starts_at: at(10), ends_at: at(12), status: "draft" }); addEvent(db, { id: "gone", starts_at: at(-50), ends_at: at(-48) });
    expect(upcomingEvents(db, NOW).map((e) => e.id)).toEqual(["near", "far"]);
  });
});

describe("member views", () => {
  it("shows a person's events grouped by what they need to do next", () => {
    addEvent(db, { id: "soon" }); addEvent(db, { id: "past", starts_at: at(-50), ends_at: at(-48), status: "completed" });
    addEvent(db, { id: "hack", reg_mode: "application", decision_deadline: at(48), capacity: 5 });
    rsvp("a", "soon"); rsvp("a", "hack");
    db.registrations.push({ id: "rp", event_id: "past", profile_id: "a", status: "attended", source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-60), cancelled_at: null });
    const mine = myEvents(db, "a", NOW);
    expect(mine.going.map((x) => x.event.id)).toEqual(["soon"]);
    expect(mine.applied.map((x) => x.event.id)).toEqual(["hack"]);
    expect(mine.past.map((x) => x.event.id)).toEqual(["past"]);
    expect(mine.upcoming.map((x) => x.id)).toEqual([]);
  });
  it("builds the member directory with attendance and the current team", () => {
    db.seasons.push({ year: 2026, label: { mn: "2026", en: "2026" }, application_opens_at: null, application_closes_at: null, is_current: true });
    db.profiles.find((p) => p.id === "a")!.status = "member";
    db.memberships.push({ profile_id: "a", season: 2026, team: "Dev", role_title: null }, { profile_id: "a", season: 2025, team: "Design", role_title: null });
    addEvent(db, { id: "e1" }); rsvp("a", "e1"); db.registrations[0].status = "attended";
    expect(membersDirectory(db).find((r) => r.profile.id === "a")).toMatchObject({ team: "Dev", eventsAttended: 1, seasons: [2025, 2026] });
  });
});
