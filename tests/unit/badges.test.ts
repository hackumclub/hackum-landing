// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { computeBadges } from "@/lib/me/badges";
import { addEvent, addProfile, addStaff, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
let n = 0;
const reg = (profile: string, event: string, status: Db["registrations"][number]["status"], over: Partial<Db["registrations"][number]> = {}) =>
  db.registrations.push({
    id: `r${++n}`, event_id: event, profile_id: profile, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null,
    decision_notified_at: null, created_at: at(-400), cancelled_at: null, ...over,
  });
const badge = (id: string, who = "p") => {
  const b = computeBadges(db, who, NOW).find((x) => x.id === id);
  if (!b) throw new Error(`no badge ${id}`);
  return b;
};
const past = (id: string, over: Partial<Db["events"][number]> = {}) => addEvent(db, { id, starts_at: at(-100), ends_at: at(-98), ...over });

beforeEach(() => {
  db = emptyDb();
  n = 0;
  addProfile(db, { id: "p" });
});

describe("computeBadges", () => {
  it("returns every badge once, with a tier and progress, for someone with no history", () => {
    const all = computeBadges(db, "p", NOW);
    expect(all.map((b) => b.id).sort()).toEqual(
      ["early-bird", "feedback", "first-event", "hackathon", "mentor", "organizer", "regular", "team-player", "two-seasons", "winner"],
    );
    for (const b of all) {
      expect(["bronze", "silver", "gold"]).toContain(b.tier);
      expect(b.earned).toBe(false);
      expect(b.progress.have).toBe(0);
      expect(b.progress.need).toBeGreaterThan(0);
    }
  });

  it("first-event: attended, or going to an event that is already over; a future RSVP does not count", () => {
    addEvent(db, { id: "future" });
    reg("p", "future", "going");
    expect(badge("first-event").earned).toBe(false);
    past("old");
    reg("p", "old", "going");
    expect(badge("first-event")).toMatchObject({ earned: true, progress: { have: 1, need: 1 } });
  });

  it("first-event ignores cancelled and rejected registrations", () => {
    past("old");
    reg("p", "old", "cancelled");
    expect(badge("first-event").earned).toBe(false);
  });

  it("regular: needs five attended events, progress is capped at need", () => {
    for (let i = 0; i < 4; i++) { past(`e${i}`); reg("p", `e${i}`, "attended"); }
    expect(badge("regular")).toMatchObject({ earned: false, progress: { have: 4, need: 5 } });
    past("e4"); reg("p", "e4", "attended");
    past("e5"); reg("p", "e5", "attended");
    expect(badge("regular")).toMatchObject({ earned: true, progress: { have: 5, need: 5 } });
  });

  it("regular counts attended only, not merely going", () => {
    for (let i = 0; i < 5; i++) { past(`e${i}`); reg("p", `e${i}`, "going"); }
    expect(badge("regular").earned).toBe(false);
  });

  it("hackathon: attended or accepted (going) on a hackathon-kind event, not applied and not other kinds", () => {
    addEvent(db, { id: "h1", kind: "hackathon", reg_mode: "application" });
    reg("p", "h1", "applied");
    expect(badge("hackathon").earned).toBe(false);
    db.registrations[0].status = "going";
    expect(badge("hackathon").earned).toBe(true);
    db = emptyDb(); addProfile(db, { id: "p" });
    addEvent(db, { id: "m", kind: "meetup" });
    reg("p", "m", "going");
    expect(badge("hackathon").earned).toBe(false);
  });

  it("feedback and winner are coming soon: never earned, need 1", () => {
    for (const id of ["feedback", "winner"]) {
      expect(badge(id)).toMatchObject({ earned: false, comingSoon: true, progress: { have: 0, need: 1 } });
    }
    expect(computeBadges(db, "p", NOW).filter((b) => b.comingSoon).length).toBe(2);
  });

  it("two-seasons: memberships in two different seasons", () => {
    db.memberships.push({ profile_id: "p", season: 2025, team: null, role_title: null });
    expect(badge("two-seasons")).toMatchObject({ earned: false, progress: { have: 1, need: 2 } });
    db.memberships.push({ profile_id: "p", season: 2025, team: "Dev", role_title: null }); // same season twice is still one season
    expect(badge("two-seasons").earned).toBe(false);
    db.memberships.push({ profile_id: "p", season: 2026, team: null, role_title: null });
    expect(badge("two-seasons")).toMatchObject({ earned: true, progress: { have: 2, need: 2 } });
  });

  it("organizer: any staff role", () => {
    expect(badge("organizer").earned).toBe(false);
    addStaff(db, "s", "organizer");
    expect(badge("organizer", "s").earned).toBe(true);
  });

  it("mentor: alumni with at least one membership; alumni without one and members do not qualify", () => {
    db.profiles[0].status = "alumni";
    expect(badge("mentor").earned).toBe(false);
    db.memberships.push({ profile_id: "p", season: 2024, team: null, role_title: null });
    expect(badge("mentor").earned).toBe(true);
    db.profiles[0].status = "member";
    expect(badge("mentor").earned).toBe(false);
  });

  it("team-player: a live team of at least three people (cancelled members do not count)", () => {
    addEvent(db, { id: "h", reg_mode: "application", team_mode: "optional", team_size_max: 4 });
    db.teams.push({ id: "t1", event_id: "h", name: "T", invite_code: "HK-AAAA", captain_profile_id: "p", looking_for: [], locked: false });
    for (const id of ["q", "r"]) addProfile(db, { id });
    reg("p", "h", "applied", { team_id: "t1" });
    reg("q", "h", "applied", { team_id: "t1" });
    expect(badge("team-player")).toMatchObject({ earned: false, progress: { have: 2, need: 3 } });
    reg("r", "h", "cancelled", { team_id: "t1" });
    expect(badge("team-player").earned).toBe(false);
    db.registrations[2].status = "applied";
    expect(badge("team-player")).toMatchObject({ earned: true, progress: { have: 3, need: 3 } });
  });

  it("early-bird: registered within 24h of registration opening", () => {
    addEvent(db, { id: "e", reg_opens_at: at(-300) });
    reg("p", "e", "going", { created_at: at(-290) });
    expect(badge("early-bird").earned).toBe(true);
  });

  it("early-bird: a late registration on a big event does not qualify, being among the first 10 does", () => {
    addEvent(db, { id: "e", reg_opens_at: at(-300) });
    for (let i = 0; i < 10; i++) { addProfile(db, { id: `x${i}` }); reg(`x${i}`, "e", "going", { created_at: at(-200 + i) }); }
    reg("p", "e", "going", { created_at: at(-100) });
    expect(badge("early-bird").earned).toBe(false);
    addEvent(db, { id: "small" });
    reg("p", "small", "going", { created_at: at(-50) });
    expect(badge("early-bird").earned).toBe(true);
  });

  it("early-bird ignores registrations staff added on someone's behalf", () => {
    addEvent(db, { id: "e", reg_opens_at: at(-300) });
    reg("p", "e", "going", { created_at: at(-299), source: "admin" });
    expect(badge("early-bird").earned).toBe(false);
  });

  it("is a pure function of the data: unknown profile gets all-locked badges and the db is untouched", () => {
    const before = JSON.stringify(db);
    expect(computeBadges(db, "nobody", NOW).every((b) => !b.earned)).toBe(true);
    expect(JSON.stringify(db)).toBe(before);
  });
});
