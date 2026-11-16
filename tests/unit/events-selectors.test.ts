// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db, Registration } from "@/lib/mockdb/types";
import type { RegStatus } from "@/lib/status";
import { enqueue } from "@/lib/mockdb/core";
import { acceptImpact, buildRegistrations, filterRows, pendingDecisions, segmentCounts } from "@/lib/events/admin-registrations";
import { eventAnalytics } from "@/lib/events/admin-analytics";
import { outboxForEvent } from "@/lib/events/admin-outbox";
import { addEvent, addProfile, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
let seq = 0;
const reg = (eventId: string, profileId: string, status: RegStatus, over: Partial<Registration> = {}) => {
  const r: Registration = {
    id: `r${++seq}`, event_id: eventId, profile_id: profileId, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null,
    decision_notified_at: null, created_at: at(-24), cancelled_at: null, ...over,
  };
  db.registrations.push(r);
  return r;
};

beforeEach(() => {
  db = emptyDb();
  seq = 0;
  for (const id of ["a", "b", "c", "d", "e", "f"]) addProfile(db, { id, school: id < "d" ? "МУИС" : id === "d" ? "ШУТИС" : null });
  addEvent(db, { id: "ev", reg_mode: "application", capacity: 3, team_mode: "optional", team_size_min: 2, team_size_max: 3, questions: [{ id: "lvl", type: "select", label: { mn: "Түвшин", en: "Level" }, required: false, options: [{ mn: "A", en: "A" }, { mn: "B", en: "B" }] }] });
  db.teams.push({ id: "t1", event_id: "ev", name: "Нохой", invite_code: "HK-0001", captain_profile_id: "a", looking_for: [], locked: false });
});

describe("buildRegistrations", () => {
  it("joins registration + profile + team and counts earlier attendance; skips deleted profiles", () => {
    reg("ev", "a", "applied", { team_id: "t1" });
    reg("ev", "b", "going");
    addEvent(db, { id: "old", status: "completed" });
    reg("old", "a", "attended");
    db.profiles.find((p) => p.id === "b")!.deleted_at = at(-1);
    const { rows, teams } = buildRegistrations(db, "ev");
    expect(rows.map((r) => r.profileId)).toEqual(["a"]);
    expect(rows[0]).toMatchObject({ status: "applied", teamId: "t1", attended: 1, school: "МУИС" });
    expect(teams).toEqual([expect.objectContaining({ id: "t1", name: "Нохой", memberIds: [rows[0].id] })]);
  });
});

const rowsOf = () => buildRegistrations(db, "ev").rows;

describe("segmentCounts / filterRows", () => {
  beforeEach(() => {
    reg("ev", "a", "applied", { team_id: "t1", answers: { lvl: "0" } });
    reg("ev", "b", "applied", { team_id: "t1", answers: { lvl: "1" } });
    reg("ev", "c", "going");
    reg("ev", "d", "waitlisted");
    reg("ev", "e", "rejected");
    reg("ev", "f", "cancelled");
  });
  const base = { segment: "all", team: "any", q: "", answers: {} } as const;

  it("All excludes cancelled; each status has its own count", () => {
    expect(segmentCounts(rowsOf())).toMatchObject({ all: 5, applied: 2, going: 1, waitlisted: 1, rejected: 1, cancelled: 1 });
  });
  it("segment, team/solo", () => {
    expect(filterRows(rowsOf(), { ...base, segment: "applied" }).map((r) => r.profileId)).toEqual(["a", "b"]);
    expect(filterRows(rowsOf(), { ...base, team: "team" })).toHaveLength(2);
    expect(filterRows(rowsOf(), { ...base, team: "solo" })).toHaveLength(3);
  });
  it("search by name (mn or en) and school, case-insensitive", () => {
    expect(filterRows(rowsOf(), { ...base, q: "name b" }).map((r) => r.profileId)).toEqual(["b"]);
    expect(filterRows(rowsOf(), { ...base, q: "НЭР C" }).map((r) => r.profileId)).toEqual(["c"]);
    expect(filterRows(rowsOf(), { ...base, q: "шутис" }).map((r) => r.profileId)).toEqual(["d"]);
  });
  it("answer chips: any selected option of a question matches; questions combine with AND", () => {
    expect(filterRows(rowsOf(), { ...base, answers: { lvl: ["1"] } }).map((r) => r.profileId)).toEqual(["b"]);
    expect(filterRows(rowsOf(), { ...base, answers: { lvl: ["0", "1"] } })).toHaveLength(2);
    expect(filterRows(rowsOf(), { ...base, answers: { lvl: [] } })).toHaveLength(5);
  });
});

describe("pendingDecisions", () => {
  it("counts decided-but-not-emailed registrations by outcome", () => {
    reg("ev", "a", "going", { decided_at: at(-2) });
    reg("ev", "b", "going", { decided_at: at(-2), decision_notified_at: at(-1) });
    reg("ev", "c", "rejected", { decided_at: at(-2) });
    reg("ev", "d", "waitlisted", { decided_at: at(-2) });
    reg("ev", "e", "applied");
    expect(pendingDecisions(rowsOf())).toEqual({ accepted: 1, rejected: 1, waitlisted: 1, total: 3 });
  });
});

describe("acceptImpact (client mirror of the capacity rule)", () => {
  beforeEach(() => {
    reg("ev", "a", "applied", { team_id: "t1" });
    reg("ev", "b", "applied", { team_id: "t1" });
    reg("ev", "c", "applied");
    reg("ev", "d", "going");
    reg("ev", "e", "attended");
  });
  const id = (p: string) => rowsOf().find((r) => r.profileId === p)!.id;

  it("going + attended already hold seats", () => expect(acceptImpact(rowsOf(), [id("c")], "individual", 3)).toMatchObject({ adding: 1, taken: 2, over: 0 }));
  it("detects exceeding, and how many seats short", () => expect(acceptImpact(rowsOf(), [id("a"), id("c")], "individual", 3)).toMatchObject({ adding: 2, over: 1 }));
  it("team scope pulls in teammates that are applied or waitlisted", () => {
    const r = acceptImpact(rowsOf(), [id("a")], "team", 5);
    expect(r).toMatchObject({ adding: 2, ids: expect.arrayContaining([id("a"), id("b")]), over: 0 });
    expect(acceptImpact(rowsOf(), [id("a")], "team", 3).over).toBe(1);
  });
  it("people who already have a seat are not counted twice; unlimited never exceeds", () => {
    expect(acceptImpact(rowsOf(), [id("d")], "individual", 3).adding).toBe(0);
    expect(acceptImpact(rowsOf(), [id("a"), id("b"), id("c")], "individual", null)).toMatchObject({ adding: 3, over: 0 });
  });
});

describe("eventAnalytics", () => {
  it("honest zeros for an event nobody registered for", () => {
    const a = eventAnalytics(db, "ev", NOW);
    expect(a.hasData).toBe(false);
    expect(a.funnel.map((f) => f.value)).toEqual([0, 0, 0]);
    expect(a.showRate).toBeNull();
    expect(a.perDay).toHaveLength(30);
    expect(a.bySchool).toEqual([]);
  });
  it("funnel registered → going → attended and show rate only once someone attended", () => {
    reg("ev", "a", "going"); reg("ev", "b", "attended"); reg("ev", "c", "applied"); reg("ev", "d", "cancelled");
    const a = eventAnalytics(db, "ev", NOW);
    expect(a.funnel.map((f) => f.value)).toEqual([3, 2, 1]);
    expect(a.showRate).toBeCloseTo(0.5);
    expect(a.hasData).toBe(true);
  });
  it("by school: unknown school is its own label; top 6 + other when there are more than 7", () => {
    for (let i = 0; i < 9; i++) { addProfile(db, { id: `s${i}`, school: `School ${i}` }); reg("ev", `s${i}`, "going"); }
    addProfile(db, { id: "s0b", school: "School 0" }); reg("ev", "s0b", "going");
    reg("ev", "f", "going"); // school null
    const a = eventAnalytics(db, "ev", NOW);
    expect(a.bySchool).toHaveLength(7);
    expect(a.bySchool[0]).toEqual({ school: "School 0", n: 2 });
    expect(a.bySchool.at(-1)).toMatchObject({ other: true });
    expect(a.bySchool.reduce((s, x) => s + x.n, 0)).toBe(11);
  });
  it("registrations per day: last 30 UB days including today, cancelled excluded, older ignored", () => {
    reg("ev", "a", "going", { created_at: NOW.toISOString() });
    reg("ev", "b", "going", { created_at: new Date(NOW.getTime() - 86_400_000).toISOString() });
    reg("ev", "c", "going", { created_at: new Date(NOW.getTime() - 40 * 86_400_000).toISOString() });
    reg("ev", "d", "cancelled", { created_at: NOW.toISOString() });
    const { perDay } = eventAnalytics(db, "ev", NOW);
    expect(perDay.at(-1)).toEqual({ day: "2026-11-16", n: 1 });
    expect(perDay.at(-2)).toEqual({ day: "2026-11-15", n: 1 });
    expect(perDay.reduce((s, d) => s + d.n, 0)).toBe(2);
  });
});

describe("outboxForEvent", () => {
  it("rows for this event only, newest first, with the person's name and never an address", () => {
    const e1 = db.events[0];
    addEvent(db, { id: "other" });
    const mk = (eventId: string, p: string, key: string) => enqueue(ctx(db, null), { profileId: p, template: "rsvp_confirmed", priority: 0, payload: { event_id: eventId, event_slug: eventId === "ev" ? e1.slug : "other-slug" }, dedupe: key });
    mk("ev", "a", "k1"); mk("other", "b", "k2"); mk("ev", "c", "k3");
    db.notifications.push({ ...db.notifications[0], id: "legacy", dedupe_key: "k4", payload: { event_slug: e1.slug }, scheduled_at: at(-100) }); // seed-style row: slug only
    db.notifications[0].scheduled_at = at(-5);
    const rows = outboxForEvent(db, e1);
    expect(rows.map((r) => r.id)).toHaveLength(3);
    expect(rows.at(-1)?.id).toBe("legacy");
    expect(JSON.stringify(rows)).not.toContain("@example.com");
    expect(rows[0].recipient?.mn).toMatch(/Нэр/);
  });
});
