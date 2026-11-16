// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { eventDetail, eventPhase, listEvents, publicAttendees, publicMembers, publicSlugs, publicTimeline, seatInfo, waitlistPosition } from "@/lib/public/select";
import { addEvent, addProfile, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => { db = emptyDb(); });
const reg = (eventId: string, profileId: string, status: Db["registrations"][number]["status"], createdAt = at(-10)) =>
  db.registrations.push({ id: `r_${eventId}_${profileId}`, event_id: eventId, profile_id: profileId, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: createdAt, cancelled_at: null });

describe("event list", () => {
  it("shows published, completed and archived events and never drafts or cancelled ones", () => {
    for (const status of ["draft", "published", "completed", "archived", "cancelled"] as const) addEvent(db, { id: status, status, starts_at: at(-100), ends_at: at(-98) });
    expect(listEvents(db, NOW).map((e) => e.slug).sort()).toEqual(["archived-slug", "completed-slug", "published-slug"]);
    expect(publicSlugs(db).sort()).toEqual(["archived-slug", "completed-slug", "published-slug"]);
  });

  it("lists upcoming events soonest first, then past events latest first", () => {
    addEvent(db, { id: "far", starts_at: at(500), ends_at: at(502) });
    addEvent(db, { id: "near", starts_at: at(24), ends_at: at(26) });
    addEvent(db, { id: "old", status: "archived", starts_at: at(-900), ends_at: at(-898) });
    addEvent(db, { id: "recent", status: "archived", starts_at: at(-100), ends_at: at(-98) });
    expect(listEvents(db, NOW).map((e) => e.slug)).toEqual(["near-slug", "far-slug", "recent-slug", "old-slug"]);
  });

  it("maps to the shape the tickets consume, falling back to Mongolian for a missing English title", () => {
    addEvent(db, { id: "x", kind: "knowledge_day", mode: "hybrid", title: { mn: "Мэдлэгийн өдөр", en: "" }, tagline: { mn: "Өгүүлбэр", en: "" }, starts_at: "2026-12-31T17:00:00Z", ends_at: "2026-12-31T19:00:00Z" });
    const [e] = listEvents(db, NOW);
    expect(e).toMatchObject({ slug: "x-slug", name: { mn: "Мэдлэгийн өдөр", en: "Мэдлэгийн өдөр" }, tagline: { en: "Өгүүлбэр" }, mode: "Hybrid", themes: ["Knowledge Day"] });
    expect(e.year).toBe("2027"); // 17:00Z on Dec 31 is already 01:00 on Jan 1 in Ulaanbaatar
  });

  it("never exposes the online link, e-mail-like fields or ids in the list shape", () => {
    addEvent(db, { id: "o", mode: "online", online_url: "https://meet.example.com/secret" });
    expect(JSON.stringify(listEvents(db, NOW))).not.toContain("secret");
    expect(JSON.stringify(eventDetail(db, "o-slug", NOW))).not.toContain("secret");
  });
});

describe("event phase", () => {
  it("covers ended, live, full, open and upcoming", () => {
    const ev = (over: Parameters<typeof addEvent>[1]) => addEvent(db, over);
    expect(eventPhase(db, ev({ id: "a", starts_at: at(-5), ends_at: at(-3) }), NOW)).toBe("ended");
    expect(eventPhase(db, ev({ id: "b", starts_at: at(-1), ends_at: at(1) }), NOW)).toBe("live");
    expect(eventPhase(db, ev({ id: "c", capacity: 1 }), NOW)).toBe("open");
    reg("c", addProfile(db, { id: "p1" }).id, "going");
    expect(eventPhase(db, db.events.find((e) => e.id === "c")!, NOW)).toBe("full");
    expect(eventPhase(db, ev({ id: "d", reg_opens_at: at(10) }), NOW)).toBe("upcoming");
    expect(eventPhase(db, ev({ id: "e", audience: "invite" }), NOW)).toBe("upcoming");
    expect(eventPhase(db, ev({ id: "f", status: "completed" }), NOW)).toBe("ended");
  });
});

describe("event detail", () => {
  it("returns null for drafts and unknown slugs, and flags cancelled events", () => {
    addEvent(db, { id: "d", status: "draft" });
    addEvent(db, { id: "c", status: "cancelled" });
    expect(eventDetail(db, "d-slug", NOW)).toBeNull();
    expect(eventDetail(db, "nope", NOW)).toBeNull();
    expect(eventDetail(db, "c-slug", NOW)?.cancelled).toBe(true);
  });
});

describe("seats and attendees", () => {
  it("counts seats without naming anyone", () => {
    const ev = addEvent(db, { id: "e", capacity: 3 });
    for (const id of ["a", "b"]) reg("e", addProfile(db, { id }).id, "going");
    reg("e", addProfile(db, { id: "c" }).id, "waitlisted");
    reg("e", addProfile(db, { id: "d" }).id, "cancelled");
    expect(seatInfo(db, ev)).toEqual({ going: 2, waitlisted: 1, capacity: 3, left: 1, full: false });
    reg("e", addProfile(db, { id: "f" }).id, "going");
    expect(seatInfo(db, ev)).toMatchObject({ left: 0, full: true });
  });

  it("an event without capacity has no seats left figure", () => {
    expect(seatInfo(db, addEvent(db, { id: "e" }))).toMatchObject({ capacity: null, left: null, full: false });
  });

  it("names only public-visibility attendees, newest first, capped, and counts the rest", () => {
    addEvent(db, { id: "e" });
    ["p1", "p2", "p3", "p4"].forEach((id, i) => { addProfile(db, { id, visibility: "public" }); reg("e", id, "going", at(-40 + i)); });
    addProfile(db, { id: "m", visibility: "members" }); reg("e", "m", "going", at(-1));
    addProfile(db, { id: "x", visibility: "private" }); reg("e", "x", "going", at(-1));
    addProfile(db, { id: "gone", visibility: "public", deleted_at: at(-2) }); reg("e", "gone", "going", at(-1));
    addProfile(db, { id: "w", visibility: "public" }); reg("e", "w", "waitlisted", at(-1));
    expect(publicAttendees(db, "e", 3).shown.map((p) => p.id)).toEqual(["p4", "p3", "p2"]);
    expect(publicAttendees(db, "e", 3).more).toBe(1);
    expect(publicAttendees(db, "e", 10)).toMatchObject({ more: 0 });
    expect(JSON.stringify(publicAttendees(db, "e", 10))).not.toContain("@");
  });

  it("works out the waitlist place by sign-up order", () => {
    addEvent(db, { id: "e" });
    ["a", "b", "c"].forEach((id, i) => { addProfile(db, { id }); reg("e", id, "waitlisted", at(-30 + i * 5)); });
    expect(waitlistPosition(db, "e", "c")).toBe(3);
    expect(waitlistPosition(db, "e", "a")).toBe(1);
    expect(waitlistPosition(db, "e", "nobody")).toBeNull();
  });
});

describe("public members", () => {
  const membership = (profile_id: string, season: number, role_title: Db["memberships"][number]["role_title"] = null, team: string | null = "Dev") => db.memberships.push({ profile_id, season, team, role_title });
  beforeEach(() => { db.seasons.push({ year: 2026, label: { mn: "", en: "" }, application_opens_at: null, application_closes_at: null, is_current: true }); });

  it("lists one card per person per season, only for public profiles, never with an email", () => {
    addProfile(db, { id: "pub", visibility: "public", name: { mn: "Бат", en: "Bat" } });
    addProfile(db, { id: "mem", visibility: "members" });
    addProfile(db, { id: "priv", visibility: "private" });
    addProfile(db, { id: "gone", visibility: "public", deleted_at: at(-1) });
    addProfile(db, { id: "legacy", visibility: "public", clerk_user_id: null, email: null, name: { mn: "Дорж", en: "Dorj" } });
    for (const id of ["pub", "mem", "priv", "gone", "legacy"]) membership(id, 2025);
    membership("pub", 2026, { mn: "Ерөнхийлөгч", en: "President" });
    const { members, seasons } = publicMembers(db);
    expect(members.map((m) => `${m.name.en}:${m.season}`)).toEqual(["Bat:2026", "Bat:2025", "Dorj:2025"]);
    expect(seasons).toEqual([2026, 2025]);
    expect(JSON.stringify(members)).not.toContain("@");
    expect(members[0].role?.en).toBe("President");
  });

  it("hides seasons after the current one and people without a name", () => {
    addProfile(db, { id: "a", visibility: "public" });
    addProfile(db, { id: "blank", visibility: "public", name: { mn: "", en: "" } });
    membership("a", 2027); membership("a", 2026); membership("blank", 2026);
    expect(publicMembers(db).members.map((m) => m.season)).toEqual([2026]);
    expect(publicMembers(db).current).toBe(2026);
  });

  it("only uses local image paths as photos", () => {
    addProfile(db, { id: "a", visibility: "public", avatar_path: "/img/club/a.jpg" });
    addProfile(db, { id: "b", visibility: "public", avatar_path: "https://tracker.example/x.png" });
    membership("a", 2026); membership("b", 2026);
    const photos = publicMembers(db).members.map((m) => m.photo);
    expect(photos.filter(Boolean)).toEqual(["/img/club/a.jpg"]);
  });
});

describe("public timeline", () => {
  const ms = (over: Partial<Db["timeline_milestones"][number]> & { id: string; year: number }) => db.timeline_milestones.push({ title: { mn: "М", en: "M" }, note: null, url: null, front_path: null, back_path: null, sort: 10, ...over });

  it("orders by year then sort and drops empty notes/urls", () => {
    ms({ id: "b", year: 2019, sort: 20 }); ms({ id: "a", year: 2019, sort: 10, note: { mn: "н", en: "n" } }); ms({ id: "c", year: 2017 });
    const { items } = publicTimeline(db);
    expect(items.map((i) => i.year)).toEqual([2017, 2019, 2019]);
    expect(items[1].note).toEqual({ mn: "н", en: "n" });
    expect(items[0]).not.toHaveProperty("note");
    expect(items[0]).not.toHaveProperty("url");
  });

  it("builds front and back cards per year; posters are badged; years without photos get none", () => {
    ms({ id: "a", year: 2021, front_path: "/img/club/a.jpg", back_path: "/img/posters/p.jpg" });
    ms({ id: "b", year: 2021, front_path: "/img/club/b.jpg" });
    ms({ id: "c", year: 2022 });
    const { media } = publicTimeline(db);
    expect(media[2021].front).toMatchObject({ src: "/img/club/a.jpg", kind: "photo" });
    expect(media[2021].back).toMatchObject({ src: "/img/posters/p.jpg", kind: "poster" });
    expect(media[2022]).toBeUndefined();
  });
});
