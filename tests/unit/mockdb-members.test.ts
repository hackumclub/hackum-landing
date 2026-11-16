// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { applyForMembership, completeOnboarding, grantRole, mergeProfiles, reviewMembership, setMemberStatus, updatePrefs, upsertSeason } from "@/lib/mockdb/members";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, queued } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "admin", "admin"); addStaff(db, "org", "organizer");
  addProfile(db, { id: "g" }); addProfile(db, { id: "fresh", onboarded_at: null, name: { mn: "", en: "" }, school: null, grad_year: null });
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
});
const motivation = "Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.";

describe("onboarding and preferences", () => {
  it("completes onboarding once and queues a single welcome email", () => {
    const input = { name: { mn: "Анужин", en: "Anujin" }, school: "МУИС", grad_year: 2028, locale: "mn" as const };
    expect(completeOnboarding(ctx(db, "fresh"), input).ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "fresh")).toMatchObject({ school: "МУИС", grad_year: 2028 });
    expect(db.profiles.find((p) => p.id === "fresh")!.onboarded_at).not.toBeNull();
    completeOnboarding(ctx(db, "fresh"), input);
    expect(queued(db, "welcome")).toHaveLength(1);
  });
  it.each([
    ["graduation year before 2000", { grad_year: 1999 }],
    ["graduation year after 2040", { grad_year: 2041 }],
    ["blank Mongolian name", { name: { mn: "  ", en: "A" } }],
    ["empty school", { school: "" }],
  ])("rejects %s", (_n, over) => {
    expect(completeOnboarding(ctx(db, "fresh"), { name: { mn: "А", en: "A" }, school: "МУИС", grad_year: 2028, locale: "mn", ...over }).ok).toBe(false);
  });
  it("requires a signed-in user", () => {
    expect(completeOnboarding(ctx(db, null), { name: { mn: "А", en: "" }, school: "x", grad_year: 2028, locale: "mn" })).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("saves notification preferences, language and visibility", () => {
    updatePrefs(ctx(db, "g"), { notif_prefs: { reminders: false, updates: true, announcements: false }, locale: "en", visibility: "members" });
    expect(db.profiles.find((p) => p.id === "g")).toMatchObject({ locale: "en", visibility: "members", notif_prefs: { reminders: false, announcements: false } });
  });
});

describe("membership applications", () => {
  it("accepts an application while the season window is open", () => {
    expect(applyForMembership(ctx(db, "g"), { motivation, team_interest: ["Dev"] }).ok).toBe(true);
    expect(db.membership_applications[0]).toMatchObject({ profile_id: "g", season: 2027, status: "pending" });
  });
  it("closes when no season window is open, and refuses duplicates, members and thin motivation", () => {
    expect(applyForMembership(ctx(db, "g"), { motivation: "short", team_interest: [] })).toEqual({ ok: false, error: "invalid" });
    applyForMembership(ctx(db, "g"), { motivation, team_interest: [] });
    expect(applyForMembership(ctx(db, "g"), { motivation, team_interest: [] })).toEqual({ ok: false, error: "conflict" });
    db.profiles.find((p) => p.id === "fresh")!.onboarded_at = at(-1);
    db.profiles.find((p) => p.id === "fresh")!.status = "member";
    expect(applyForMembership(ctx(db, "fresh"), { motivation, team_interest: [] })).toEqual({ ok: false, error: "conflict" });
    db.seasons[0].application_closes_at = at(-1);
    addProfile(db, { id: "late" });
    expect(applyForMembership(ctx(db, "late"), { motivation, team_interest: [] })).toEqual({ ok: false, error: "closed" });
  });
  it("approval creates the roster entry, promotes the person and emails them, all at once", () => {
    applyForMembership(ctx(db, "g"), { motivation, team_interest: ["Design", "Dev"] });
    const id = db.membership_applications[0].id;
    expect(reviewMembership(ctx(db, "g"), { id, approve: true, note: "" })).toEqual({ ok: false, error: "forbidden" });
    expect(reviewMembership(ctx(db, "org"), { id, approve: true, note: "Сайн" }).ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "g")!.status).toBe("member");
    expect(db.memberships).toEqual([{ profile_id: "g", season: 2027, team: "Design", role_title: null }]);
    expect(db.membership_applications[0]).toMatchObject({ status: "approved", reviewed_by: "org", review_note: "Сайн" });
    expect(queued(db, "membership_approved")).toHaveLength(1);
    expect(db.audit_log.at(-1)).toMatchObject({ action: "membership.approve" });
    expect(reviewMembership(ctx(db, "org"), { id, approve: false, note: "" })).toEqual({ ok: false, error: "conflict" });
  });
  it("rejection keeps the staff note private", () => {
    applyForMembership(ctx(db, "g"), { motivation, team_interest: [] });
    reviewMembership(ctx(db, "org"), { id: db.membership_applications[0].id, approve: false, note: "private reason" });
    expect(db.profiles.find((p) => p.id === "g")!.status).toBe("guest");
    const mail = queued(db, "membership_rejected");
    expect(mail).toHaveLength(1);
    expect(JSON.stringify(mail[0].payload)).not.toContain("private reason");
  });
});

describe("staff tools", () => {
  it("changes member status in bulk, staff only", () => {
    addProfile(db, { id: "h" });
    expect(setMemberStatus(ctx(db, "g"), { ids: ["g", "h"], status: "alumni" })).toEqual({ ok: false, error: "forbidden" });
    expect(setMemberStatus(ctx(db, "org"), { ids: ["g", "h"], status: "alumni" })).toEqual({ ok: true, data: { changed: 2 } });
    expect(setMemberStatus(ctx(db, "org"), { ids: ["g"], status: "alumni" })).toEqual({ ok: true, data: { changed: 0 } });
  });
  it("merges a duplicate into the profile to keep, admin only", () => {
    addProfile(db, { id: "dup", clerk_user_id: null, email: null });
    addEvent(db, { id: "e1" }); addEvent(db, { id: "e2" });
    db.memberships.push({ profile_id: "g", season: 2025, team: "Dev", role_title: null }, { profile_id: "dup", season: 2025, team: "Design", role_title: null }, { profile_id: "dup", season: 2026, team: "Dev", role_title: null });
    const reg = (event: string, profile: string, status: "going" | "cancelled") => db.registrations.push({ id: `${event}${profile}`, event_id: event, profile_id: profile, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-1), cancelled_at: null });
    reg("e1", "g", "going"); reg("e1", "dup", "going"); reg("e2", "dup", "going");
    expect(mergeProfiles(ctx(db, "org"), { keep: "g", drop: "dup" })).toEqual({ ok: false, error: "forbidden" });
    expect(mergeProfiles(ctx(db, "admin"), { keep: "g", drop: "g" })).toEqual({ ok: false, error: "invalid" });
    expect(mergeProfiles(ctx(db, "admin"), { keep: "g", drop: "dup" }).ok).toBe(true);
    expect(db.memberships.map((m) => `${m.profile_id}:${m.season}:${m.team}`).sort()).toEqual(["g:2025:Dev", "g:2026:Dev"]);
    expect(db.registrations.filter((r) => r.profile_id === "g").map((r) => r.event_id).sort()).toEqual(["e1", "e2"]);
    expect(db.registrations.some((r) => r.profile_id === "dup")).toBe(false);
    expect(db.profiles.find((p) => p.id === "dup")!.deleted_at).not.toBeNull();
  });
  it("only admins grant roles, and an admin cannot remove their own admin role", () => {
    expect(grantRole(ctx(db, "org"), { profileId: "g", role: "organizer" })).toEqual({ ok: false, error: "forbidden" });
    expect(grantRole(ctx(db, "admin"), { profileId: "g", role: "organizer" }).ok).toBe(true);
    expect(db.staff_roles.some((r) => r.profile_id === "g" && r.role === "organizer")).toBe(true);
    expect(grantRole(ctx(db, "admin"), { profileId: "admin", role: null })).toEqual({ ok: false, error: "conflict" });
    expect(grantRole(ctx(db, "admin"), { profileId: "g", role: null }).ok).toBe(true);
  });
  it("keeps exactly one current season", () => {
    const season = (year: number, is_current: boolean) => ({ year, label: { mn: `${year}`, en: `${year}` }, application_opens_at: null, application_closes_at: null, is_current });
    expect(upsertSeason(ctx(db, "org"), season(2026, true))).toEqual({ ok: false, error: "forbidden" });
    upsertSeason(ctx(db, "admin"), season(2026, true));
    upsertSeason(ctx(db, "admin"), season(2027, true));
    expect(db.seasons.filter((s) => s.is_current).map((s) => s.year)).toEqual([2027]);
    expect(upsertSeason(ctx(db, "admin"), { ...season(2028, false), application_opens_at: at(10), application_closes_at: at(1) })).toEqual({ ok: false, error: "invalid" });
  });
});
