// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { decideRegistrations, sendDecisions } from "@/lib/mockdb/registrations";
import { applyForMembership, reviewMembership } from "@/lib/mockdb/members";
import {
  attentionFor, countdown, eligibility, eventsTabs, homeData, membershipView, ordinal, profileView, safeNextPath, teamView, visibleStatus, waitlistPosition,
} from "@/lib/me/queries";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  for (const id of ["a", "b", "c", "d"]) addProfile(db, { id });
});
const rsvp = (actor: string, eventId: string, extra: Partial<Parameters<typeof registerForEvent>[1]> = {}) =>
  registerForEvent(ctx(db, actor), { eventId, answers: {}, ...extra });
const profile = (id: string) => db.profiles.find((p) => p.id === id)!;

describe("safeNextPath", () => {
  it("keeps same-site locale paths and rejects everything that could leave the site", () => {
    expect(safeNextPath("/en/me/events", "mn")).toBe("/en/me/events");
    expect(safeNextPath("/mn/me", "en")).toBe("/mn/me");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/fr/me", "javascript:alert(1)", "", undefined, "/mn/../admin"]) {
      expect(safeNextPath(bad, "mn")).toBe("/mn/me");
    }
  });
});

describe("ordinal", () => {
  it("English suffixes and Mongolian -р", () => {
    expect([1, 2, 3, 4, 11, 12, 21, 103].map((n) => ordinal("en", n))).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "21st", "103rd"]);
    expect(ordinal("mn", 3)).toBe("3-р");
  });
});

describe("countdown", () => {
  const ev = (startH: number, endH: number) => ({ starts_at: at(startH), ends_at: at(endH) });
  it("says how far away an event is, in the viewer's language", () => {
    expect(countdown(ev(72, 74), NOW, "en")).toEqual({ kind: "in", text: "in 3 days" });
    expect(countdown(ev(5, 6), NOW, "en")).toEqual({ kind: "in", text: "in 5 hours" });
    expect(countdown(ev(0.5, 2), NOW, "en")).toEqual({ kind: "in", text: "in 30 minutes" });
    expect(countdown(ev(72, 74), NOW, "mn").text).toMatch(/3 өдрийн дараа/);
  });
  it("live while running, past once over", () => {
    expect(countdown(ev(-1, 2), NOW, "en").kind).toBe("live");
    expect(countdown(ev(-5, -2), NOW, "en").kind).toBe("past");
  });
  it("uses UB calendar days: 18:00 tomorrow is 'tomorrow' even when only 30 hours away", () => {
    // NOW = 12:00 UB; +30h = 18:00 UB the next day
    expect(countdown(ev(30, 32), NOW, "en").text).toBe("tomorrow");
  });
});

describe("eligibility", () => {
  it("open event → ok; members-only for a guest → reason; closed windows and cancelled events", () => {
    const open = addEvent(db, { id: "o" });
    expect(eligibility(db, open, profile("a"), NOW)).toEqual({ ok: true, waitlist: false });
    const m = addEvent(db, { id: "m", audience: "members" });
    expect(eligibility(db, m, profile("a"), NOW)).toEqual({ ok: false, reason: "members" });
    profile("a").status = "member";
    expect(eligibility(db, m, profile("a"), NOW)).toEqual({ ok: true, waitlist: false });
    const al = addEvent(db, { id: "al", audience: "alumni" });
    expect(eligibility(db, al, profile("a"), NOW)).toEqual({ ok: false, reason: "alumni" });
    const notYet = addEvent(db, { id: "ny", reg_opens_at: at(10) });
    expect(eligibility(db, notYet, profile("a"), NOW)).toEqual({ ok: false, reason: "not_open", at: at(10) });
    const closed = addEvent(db, { id: "c", reg_closes_at: at(-1) });
    expect(eligibility(db, closed, profile("a"), NOW)).toEqual({ ok: false, reason: "closed" });
    const cancelled = addEvent(db, { id: "x", status: "cancelled" });
    expect(eligibility(db, cancelled, profile("a"), NOW)).toEqual({ ok: false, reason: "cancelled" });
    const invite = addEvent(db, { id: "i", audience: "invite" });
    expect(eligibility(db, invite, profile("a"), NOW)).toEqual({ ok: false, reason: "invite" });
  });
  it("full: waitlist on → ok with waitlist flag; waitlist off → full; application events ignore capacity", () => {
    const wl = addEvent(db, { id: "wl", capacity: 1, waitlist: true });
    const nowl = addEvent(db, { id: "nw", capacity: 1, waitlist: false });
    const app = addEvent(db, { id: "ap", capacity: 1, reg_mode: "application" });
    for (const id of ["wl", "nw", "ap"]) db.registrations.push({ id: `r-${id}`, event_id: id, profile_id: "b", status: "going", source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-5), cancelled_at: null });
    expect(eligibility(db, wl, profile("a"), NOW)).toEqual({ ok: true, waitlist: true });
    expect(eligibility(db, nowl, profile("a"), NOW)).toEqual({ ok: false, reason: "full" });
    expect(eligibility(db, app, profile("a"), NOW)).toEqual({ ok: true, waitlist: false });
  });
});

describe("waitlist and visible decisions", () => {
  it("numbers the waitlist by arrival and promotes on cancel", () => {
    addEvent(db, { id: "e", capacity: 1 });
    rsvp("a", "e"); rsvp("b", "e"); rsvp("c", "e");
    const reg = (p: string) => db.registrations.find((r) => r.profile_id === p)!;
    reg("b").created_at = at(-3); reg("c").created_at = at(-2);
    expect(reg("a").status).toBe("going");
    expect(waitlistPosition(db, reg("b"))).toBe(1);
    expect(waitlistPosition(db, reg("c"))).toBe(2);
    expect(waitlistPosition(db, reg("a"))).toBeNull();
  });
  it("a rejection stays hidden as 'applied' until staff sends decisions; acceptance shows at once", () => {
    addEvent(db, { id: "h", reg_mode: "application" });
    rsvp("a", "h"); rsvp("b", "h");
    const [ra, rb] = db.registrations;
    decideRegistrations(ctx(db, "org"), { ids: [ra.id], decision: "accept" });
    decideRegistrations(ctx(db, "org"), { ids: [rb.id], decision: "reject" });
    const ev = db.events[0];
    expect(visibleStatus(ra, ev)).toBe("going");
    expect(visibleStatus(rb, ev)).toBe("applied");
    sendDecisions(ctx(db, "org"), { eventId: "h" });
    expect(visibleStatus(rb, ev)).toBe("rejected");
  });
});

describe("attentionFor", () => {
  it("lists a decision, the waitlist spot, a short team and a membership answer, in that order", () => {
    addEvent(db, { id: "h", reg_mode: "application", team_mode: "optional", team_size_min: 2, team_size_max: 4, starts_at: at(200), ends_at: at(210) });
    addEvent(db, { id: "w", capacity: 1 });
    rsvp("b", "w"); rsvp("a", "w");
    rsvp("a", "h", { team: { mode: "create", name: "Solo Crew" } });
    decideRegistrations(ctx(db, "org"), { ids: [db.registrations.find((r) => r.event_id === "h")!.id], decision: "accept" });
    db.seasons.push({ year: 2027, label: { mn: "", en: "" }, application_opens_at: at(-100), application_closes_at: at(100), is_current: false });
    applyForMembership(ctx(db, "a"), { motivation: "I really want to join the club", team_interest: ["Dev"] });
    reviewMembership(ctx(db, "org"), { id: db.membership_applications[0].id, approve: true, note: "internal staff note" });
    const kinds = attentionFor(db, "a", NOW).map((x) => x.kind);
    expect(kinds).toEqual(["decision", "waitlist", "membership", "team"]);
    const wl = attentionFor(db, "a", NOW).find((x) => x.kind === "waitlist");
    expect(wl).toMatchObject({ position: 1 });
    const team = attentionFor(db, "a", NOW).find((x) => x.kind === "team");
    expect(team).toMatchObject({ have: 1, need: 2 });
    expect(JSON.stringify(attentionFor(db, "a", NOW))).not.toContain("internal staff note");
  });
  it("is empty for someone with nothing going on, and never shows other people's items", () => {
    expect(attentionFor(db, "d", NOW)).toEqual([]);
    addEvent(db, { id: "w", capacity: 1 }); rsvp("b", "w"); rsvp("c", "w");
    expect(attentionFor(db, "d", NOW)).toEqual([]);
  });
});

describe("home and events views", () => {
  it("next event is the soonest one the person is going to; live events are separate; brand-new people are flagged", () => {
    expect(homeData(db, "d", NOW).brandNew).toBe(true);
    addEvent(db, { id: "far", starts_at: at(200), ends_at: at(202) });
    addEvent(db, { id: "near", starts_at: at(30), ends_at: at(32) });
    addEvent(db, { id: "live", starts_at: at(-1), ends_at: at(2) });
    rsvp("a", "far"); rsvp("a", "near"); rsvp("a", "live");
    const h = homeData(db, "a", NOW);
    expect(h.next?.id).toBe("near");
    expect(h.live.map((e) => e.id)).toEqual(["live"]);
    expect(h.brandNew).toBe(false);
    expect(h.whatsNext.map((e) => e.id)).not.toContain("near");
  });
  it("what's next offers only events the person may join; the Events tab keeps the rest with a reason", () => {
    addEvent(db, { id: "open", starts_at: at(10), ends_at: at(11) });
    addEvent(db, { id: "mem", audience: "members", starts_at: at(20), ends_at: at(21) });
    expect(homeData(db, "a", NOW).whatsNext.map((e) => e.id)).toEqual(["open"]);
    const tab = eventsTabs(db, "a", NOW).upcoming;
    expect(tab.map((e) => e.id)).toEqual(["open", "mem"]);
    expect(tab[1].elig).toEqual({ ok: false, reason: "members" });
  });
  it("hides the online link until the person is going", () => {
    addEvent(db, { id: "on", mode: "online", online_url: "https://meet.example.com/x", starts_at: at(10), ends_at: at(11) });
    expect(eventsTabs(db, "a", NOW).upcoming[0].onlineUrl).toBeNull();
    rsvp("a", "on");
    expect(eventsTabs(db, "a", NOW).going[0].onlineUrl).toBe("https://meet.example.com/x");
  });
  it("splits going / applied / past with counts that match the lists", () => {
    addEvent(db, { id: "g", starts_at: at(10), ends_at: at(11) });
    addEvent(db, { id: "h", reg_mode: "application", starts_at: at(20), ends_at: at(21) });
    addEvent(db, { id: "old", starts_at: at(-50), ends_at: at(-48) });
    rsvp("a", "g"); rsvp("a", "h");
    db.registrations.push({ id: "rp", event_id: "old", profile_id: "a", status: "attended", source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-60), cancelled_at: null });
    const t = eventsTabs(db, "a", NOW);
    expect([t.going.length, t.applied.length, t.past.length]).toEqual([1, 1, 1]);
    expect(t.past[0].reg?.status).toBe("attended");
  });
});

describe("teamView", () => {
  it("only team members can see a team; the captain is marked", () => {
    addEvent(db, { id: "h", slug: "hack", reg_mode: "application", team_mode: "optional", team_size_min: 2, team_size_max: 4 });
    const r = rsvp("a", "h", { team: { mode: "create", name: "Rocketeers" } });
    const teamId = r.ok ? r.data.teamId! : "";
    const code = db.teams[0].invite_code;
    rsvp("b", "h", { team: { mode: "join", code } });
    const v = teamView(db, teamId, "b");
    expect(v?.members.map((m) => [m.profileId, m.captain, m.you])).toEqual([["a", true, false], ["b", false, true]]);
    expect(v).toMatchObject({ name: "Rocketeers", max: 4, slug: "hack" });
    expect(teamView(db, teamId, "c")).toBeNull();
    expect(teamView(db, "nope", "a")).toBeNull();
  });
});

describe("membershipView", () => {
  beforeEach(() => {
    db.seasons.push({ year: 2027, label: { mn: "2027", en: "Season 2027" }, application_opens_at: at(-100), application_closes_at: at(100), is_current: false });
  });
  it("open window with a pending application, and the staff note never leaves the server", () => {
    applyForMembership(ctx(db, "a"), { motivation: "I would like to help organise things", team_interest: ["Dev"] });
    db.membership_applications[0].review_note = "secret staff note";
    const v = membershipView(db, "a", NOW);
    expect(v.window.state).toBe("open");
    expect(v.app).toMatchObject({ status: "pending", season: 2027 });
    expect(JSON.stringify(v)).not.toContain("secret staff note");
  });
  it("window states: opens later and closed", () => {
    db.seasons[0].application_opens_at = at(50); db.seasons[0].application_closes_at = at(150);
    expect(membershipView(db, "a", NOW).window).toMatchObject({ state: "opens", from: at(50) });
    db.seasons[0].application_opens_at = at(-150); db.seasons[0].application_closes_at = at(-50);
    expect(membershipView(db, "a", NOW).window.state).toBe("closed");
  });
  it("roster history, newest season first", () => {
    db.memberships.push({ profile_id: "a", season: 2024, team: "Dev", role_title: null }, { profile_id: "a", season: 2026, team: "Design", role_title: { mn: "Ахлагч", en: "Lead" } });
    expect(membershipView(db, "a", NOW).history.map((h) => h.season)).toEqual([2026, 2024]);
  });
});

describe("profileView", () => {
  it("collects seasons, badges and past events", () => {
    db.memberships.push({ profile_id: "a", season: 2025, team: null, role_title: null }, { profile_id: "a", season: 2026, team: null, role_title: null });
    const v = profileView(db, "a", NOW);
    expect(v.seasons).toEqual([2026, 2025]);
    expect(v.badges.find((b) => b.id === "two-seasons")?.earned).toBe(true);
    expect(v.attended).toEqual([]);
  });
});
