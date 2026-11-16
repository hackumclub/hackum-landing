// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { enqueue } from "@/lib/mockdb/core";
import { applyForMembership, mergeProfiles } from "@/lib/mockdb/members";
import { dispatchOutbox } from "@/lib/mockdb/outbox";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { inboxFor, markAllRead, markRead, unreadCount } from "@/lib/mockdb/notifications";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "admin", "admin"); addStaff(db, "org", "organizer");
  addProfile(db, { id: "a", school_id: "num", major_track: "software" });
  addProfile(db, { id: "b" });
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
});
const push = (profileId: string, dedupe: string, template: Parameters<typeof enqueue>[1]["template"] = "announcement", now = NOW) =>
  enqueue(ctx(db, null, now), { profileId, template, payload: { title: dedupe }, priority: 2, dedupe });

describe("in-app inbox", () => {
  it("is filled alongside the email, once per dedupe key", () => {
    addEvent(db, { id: "e1" });
    registerForEvent(ctx(db, "a"), { eventId: "e1", answers: {} });
    expect(inboxFor(db, "a", {}).map((i) => i.kind)).toEqual(["rsvp_confirmed"]);
    push("a", "k1"); push("a", "k1");
    expect(inboxFor(db, "a", {}).filter((i) => i.kind === "announcement")).toHaveLength(1);
  });
  it("respects the announcements preference and never leaks to another profile", () => {
    db.profiles.find((p) => p.id === "b")!.notif_prefs.announcements = false;
    push("b", "k2");
    expect(inboxFor(db, "b", {})).toHaveLength(0);
    push("a", "k3");
    expect(inboxFor(db, "b", {})).toHaveLength(0);
  });
  it("lists newest first with a limit and a before-cursor", () => {
    for (let i = 0; i < 5; i++) push("a", `n${i}`, "announcement", new Date(NOW.getTime() + i * 60_000));
    const first = inboxFor(db, "a", { limit: 2 });
    expect(first.map((i) => i.payload.title)).toEqual(["n4", "n3"]);
    expect(inboxFor(db, "a", { limit: 2, before: first[1].id }).map((i) => i.payload.title)).toEqual(["n2", "n1"]);
  });
  it("counts unread and marks read only the actor's own rows", () => {
    push("a", "x1"); push("a", "x2"); push("b", "y1");
    expect(unreadCount(db, "a")).toBe(2);
    const [mine] = inboxFor(db, "a", {});
    const theirs = inboxFor(db, "b", {})[0];
    expect(markRead(ctx(db, "a"), [mine.id, theirs.id])).toEqual({ ok: true, data: { changed: 1 } });
    expect(unreadCount(db, "a")).toBe(1);
    expect(unreadCount(db, "b")).toBe(1);
    expect(markRead(ctx(db, "a"), [mine.id])).toEqual({ ok: true, data: { changed: 0 } });
    expect(markAllRead(ctx(db, "a"))).toEqual({ ok: true, data: { changed: 1 } });
    expect(unreadCount(db, "a")).toBe(0);
    expect(markAllRead(ctx(db, null))).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("tells every staff member about a new membership application, and nobody else", () => {
    expect(applyForMembership(ctx(db, "a"), { motivation: "Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.", team_interest: [] }).ok).toBe(true);
    for (const id of ["admin", "org"]) expect(inboxFor(db, id, {}).map((i) => i.kind)).toEqual(["staff_application"]);
    expect(inboxFor(db, "b", {})).toHaveLength(0);
  });
  it("tells staff once when an email gives up, and never counts toward the email budget", () => {
    push("a", "mail1");
    const n = db.notifications.find((x) => x.dedupe_key === "mail1")!;
    n.attempts = 4;
    const before = JSON.stringify(db.email_daily_usage);
    dispatchOutbox(db, NOW, { send: () => "fail" });
    expect(n.status).toBe("failed");
    expect(inboxFor(db, "admin", {}).filter((i) => i.kind === "staff_failed_email")).toHaveLength(1);
    expect(JSON.stringify(db.email_daily_usage)).toBe(before);
    n.status = "queued"; n.attempts = 4;
    dispatchOutbox(db, NOW, { send: () => "fail" });
    expect(inboxFor(db, "admin", {}).filter((i) => i.kind === "staff_failed_email")).toHaveLength(1);
  });
  it("follows a merged profile", () => {
    push("b", "m1");
    expect(mergeProfiles(ctx(db, "admin"), { keep: "a", drop: "b" }).ok).toBe(true);
    expect(inboxFor(db, "a", {}).map((i) => i.payload.title)).toContain("m1");
  });
});
