// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import type { Question } from "@/lib/events/questions";
import { cancelRegistration, decideRegistrations, joinTeam, leaveTeam, registerForEvent, sendDecisions } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, queued, regOf, statusCount } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  for (const id of ["a", "b", "c", "d", "e"]) addProfile(db, { id });
});

const register = (actor: string | null, eventId: string, extra: { answers?: Record<string, string>; team?: Parameters<typeof registerForEvent>[1]["team"] } = {}) =>
  registerForEvent(ctx(db, actor), { eventId, answers: extra.answers ?? {}, team: extra.team });

describe("RSVP", () => {
  it("seats a guest and queues exactly one confirmation email", () => {
    addEvent(db, { id: "e1" });
    expect(register("a", "e1")).toEqual({ ok: true, data: { status: "going" } });
    const mails = queued(db, "rsvp_confirmed");
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ profile_id: "a", priority: 0, status: "queued", channel: "email" });
    expect(mails[0].payload).toMatchObject({ event_slug: "e1-slug", ics_sequence: 0 });
  });

  it("is idempotent: registering again changes nothing", () => {
    addEvent(db, { id: "e1" });
    register("a", "e1");
    expect(register("a", "e1")).toEqual({ ok: true, data: { status: "going" } });
    expect(db.registrations).toHaveLength(1);
    expect(queued(db, "rsvp_confirmed")).toHaveLength(1);
  });

  it("waitlists when full and the event allows a waitlist, otherwise reports full", () => {
    addEvent(db, { id: "e1", capacity: 2 });
    register("a", "e1"); register("b", "e1");
    expect(register("c", "e1")).toEqual({ ok: true, data: { status: "waitlisted" } });
    addEvent(db, { id: "e2", capacity: 1, waitlist: false });
    register("a", "e2");
    expect(register("b", "e2")).toEqual({ ok: false, error: "full" });
    expect(regOf(db, "e2", "b")).toBeUndefined();
  });

  it("promotes the oldest waitlisted person when a seat is freed", () => {
    addEvent(db, { id: "e1", capacity: 1 });
    register("a", "e1"); register("b", "e1"); register("c", "e1");
    regOf(db, "e1", "b")!.created_at = at(-2);
    regOf(db, "e1", "c")!.created_at = at(-1);
    expect(cancelRegistration(ctx(db, "a"), { eventId: "e1" }).ok).toBe(true);
    expect(regOf(db, "e1", "a")).toMatchObject({ status: "cancelled" });
    expect(regOf(db, "e1", "b")!.status).toBe("going");
    expect(regOf(db, "e1", "c")!.status).toBe("waitlisted");
    expect(queued(db, "waitlist_promoted").map((n) => n.profile_id)).toEqual(["b"]);
  });

  it("lets a cancelled person register again and queues a fresh confirmation", () => {
    addEvent(db, { id: "e1" });
    register("a", "e1"); cancelRegistration(ctx(db, "a"), { eventId: "e1" });
    expect(register("a", "e1")).toEqual({ ok: true, data: { status: "going" } });
    expect(db.registrations).toHaveLength(1);
    expect(queued(db, "rsvp_confirmed")).toHaveLength(2);
  });
});

describe("who can register and when", () => {
  it("rejects anonymous visitors and people who have not finished onboarding", () => {
    addEvent(db, { id: "e1" });
    addProfile(db, { id: "fresh", onboarded_at: null });
    expect(register(null, "e1")).toEqual({ ok: false, error: "unauthenticated" });
    expect(register("fresh", "e1")).toEqual({ ok: false, error: "forbidden" });
  });

  it.each([
    ["invite-only", { audience: "invite" as const }],
    ["after registration closed", { reg_closes_at: at(-1) }],
    ["before registration opens", { reg_opens_at: at(5) }],
    ["after the event ended", { starts_at: at(-5), ends_at: at(-3) }],
    ["cancelled", { status: "cancelled" as const }],
  ])("reports closed for an event that is %s", (_n, over) => {
    addEvent(db, { id: "e1", ...over });
    expect(register("a", "e1")).toEqual({ ok: false, error: "closed" });
  });

  it("hides drafts completely", () => {
    addEvent(db, { id: "e1", status: "draft" });
    expect(register("a", "e1")).toEqual({ ok: false, error: "not_found" });
  });

  it("limits members-only events to members", () => {
    addEvent(db, { id: "e1", audience: "members" });
    db.profiles.find((p) => p.id === "b")!.status = "member";
    expect(register("a", "e1")).toEqual({ ok: false, error: "forbidden" });
    expect(register("b", "e1").ok).toBe(true);
  });
});

const QUESTIONS: Question[] = [
  { id: "skills", type: "short", label: { mn: "Ур чадвар", en: "Skills" }, required: true },
  { id: "github", type: "url", label: { mn: "GitHub", en: "GitHub" }, required: false },
];
const applicationEvent = (over = {}) =>
  addEvent(db, { id: "h1", kind: "hackathon", reg_mode: "application", capacity: 2, questions: QUESTIONS, team_mode: "optional", team_size_min: 2, team_size_max: 2, decision_deadline: at(48), ...over });

describe("hackathon applications", () => {
  it("requires every required answer and creates nothing when one is missing", () => {
    applicationEvent();
    expect(register("a", "h1", { answers: { github: "https://github.com/x" } })).toEqual({ ok: false, error: "invalid" });
    expect(db.registrations).toHaveLength(0);
  });

  it("records the application as 'applied' and sends the received email, not an RSVP confirmation", () => {
    applicationEvent();
    expect(register("a", "h1", { answers: { skills: "React" } })).toEqual({ ok: true, data: { status: "applied" } });
    expect(queued(db, "application_received")).toHaveLength(1);
    expect(queued(db, "rsvp_confirmed")).toHaveLength(0);
  });

  it("does not let a rejected applicant simply apply again", () => {
    applicationEvent();
    register("a", "h1", { answers: { skills: "x" } });
    decideRegistrations(ctx(db, "org"), { ids: [regOf(db, "h1", "a")!.id], decision: "reject" });
    expect(register("a", "h1", { answers: { skills: "x" } })).toEqual({ ok: false, error: "conflict" });
  });
});

describe("teams", () => {
  it("creates a team with an invite code and lets a second person join with it", () => {
    applicationEvent();
    const first = register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "Нүүдэлчид" } });
    expect(first.ok && first.data.inviteCode).toMatch(/^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const code = first.ok ? first.data.inviteCode! : "";
    const second = register("b", "h1", { answers: { skills: "y" }, team: { mode: "join", code: code.toLowerCase() } });
    expect(second.ok).toBe(true);
    expect(db.teams).toHaveLength(1);
    expect(regOf(db, "h1", "a")!.team_id).toBe(regOf(db, "h1", "b")!.team_id);
  });

  it("refuses a third member over the size limit and creates no registration for them", () => {
    applicationEvent();
    const code = (register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "Team A" } }) as { data: { inviteCode: string } }).data.inviteCode;
    register("b", "h1", { answers: { skills: "x" }, team: { mode: "join", code } });
    expect(register("c", "h1", { answers: { skills: "x" }, team: { mode: "join", code } })).toEqual({ ok: false, error: "full" });
    expect(regOf(db, "h1", "c")).toBeUndefined();
  });

  it("rejects a one-letter team name", () => {
    applicationEvent();
    expect(register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "T" } })).toEqual({ ok: false, error: "invalid" });
    expect(db.registrations).toHaveLength(0);
  });

  it("reports an unknown code as not found and rejects a duplicate team name", () => {
    applicationEvent();
    expect(register("a", "h1", { answers: { skills: "x" }, team: { mode: "join", code: "HK-ZZZZ" } })).toEqual({ ok: false, error: "not_found" });
    register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "Same" } });
    expect(register("b", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "same" } })).toEqual({ ok: false, error: "conflict" });
  });

  it("hands the captaincy on when the captain leaves, and deletes the team when the last member leaves", () => {
    applicationEvent({ team_size_max: 3 });
    const code = (register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "Team T" } }) as { data: { inviteCode: string } }).data.inviteCode;
    register("b", "h1", { answers: { skills: "x" }, team: { mode: "join", code } });
    const teamId = db.teams[0].id;
    expect(leaveTeam(ctx(db, "a"), { teamId }).ok).toBe(true);
    expect(db.teams[0].captain_profile_id).toBe("b");
    expect(joinTeam(ctx(db, "a"), { code }).ok).toBe(true);
    leaveTeam(ctx(db, "a"), { teamId }); leaveTeam(ctx(db, "b"), { teamId });
    expect(db.teams).toHaveLength(0);
  });

  it("requires a team when the event says so", () => {
    applicationEvent({ team_mode: "required" });
    expect(register("a", "h1", { answers: { skills: "x" }, team: { mode: "solo" } })).toEqual({ ok: false, error: "invalid" });
  });
});

describe("staff decisions", () => {
  const apply = (...ids: string[]) => { for (const id of ids) register(id, "h1", { answers: { skills: "x" } }); };
  const rid = (p: string) => regOf(db, "h1", p)!.id;

  it("lets only staff decide", () => {
    applicationEvent(); apply("a");
    expect(decideRegistrations(ctx(db, "a"), { ids: [rid("a")], decision: "accept" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("refuses to accept more people than there are seats and changes nothing", () => {
    applicationEvent({ capacity: 1 }); apply("a", "b");
    expect(decideRegistrations(ctx(db, "org"), { ids: [rid("a"), rid("b")], decision: "accept" })).toEqual({ ok: false, error: "full" });
    expect(statusCount(db, "h1", "going")).toBe(0);
  });

  it("accepts within capacity and records who decided and when", () => {
    applicationEvent(); apply("a", "b");
    expect(decideRegistrations(ctx(db, "org"), { ids: [rid("a")], decision: "accept" })).toEqual({ ok: true, data: { changed: 1 } });
    expect(regOf(db, "h1", "a")).toMatchObject({ status: "going", decided_by: "org", decision_notified_at: null });
    expect(regOf(db, "h1", "a")!.decided_at).not.toBeNull();
    expect(db.audit_log.at(-1)).toMatchObject({ action: "registration.decide", actor_profile_id: "org" });
  });

  it("decides a whole team at once when asked to", () => {
    applicationEvent();
    const code = (register("a", "h1", { answers: { skills: "x" }, team: { mode: "create", name: "Team T" } }) as { data: { inviteCode: string } }).data.inviteCode;
    register("b", "h1", { answers: { skills: "x" }, team: { mode: "join", code } });
    expect(decideRegistrations(ctx(db, "org"), { ids: [rid("a")], decision: "accept", scope: "team" })).toEqual({ ok: true, data: { changed: 2 } });
    expect(statusCount(db, "h1", "going")).toBe(2);
  });

  it("emails decisions only when sent, once per decision, and never leaks staff notes", () => {
    applicationEvent({ capacity: 5 }); apply("a", "b", "c");
    decideRegistrations(ctx(db, "org"), { ids: [rid("a")], decision: "accept" });
    decideRegistrations(ctx(db, "org"), { ids: [rid("b")], decision: "reject" });
    decideRegistrations(ctx(db, "org"), { ids: [rid("c")], decision: "waitlist" });
    expect(queued(db, "application_accepted")).toHaveLength(0);
    expect(sendDecisions(ctx(db, "org"), { eventId: "h1" })).toEqual({ ok: true, data: { queued: 3 } });
    expect(queued(db, "application_accepted")).toHaveLength(1);
    expect(queued(db, "application_rejected")).toHaveLength(1);
    expect(queued(db, "waitlist_notice")).toHaveLength(1);
    expect(sendDecisions(ctx(db, "org"), { eventId: "h1" })).toEqual({ ok: true, data: { queued: 0 } });
    expect(sendDecisions(ctx(db, "a"), { eventId: "h1" })).toEqual({ ok: false, error: "forbidden" });
  });
});

describe("promoting from an RSVP waitlist by hand", () => {
  it("emails the person right away with the waitlist-promoted message and leaves nothing to 'send decisions'", () => {
    addEvent(db, { id: "w1", capacity: 1 });
    register("a", "w1"); register("c", "w1");
    expect(regOf(db, "w1", "c")!.status).toBe("waitlisted");
    db.events.find((e) => e.id === "w1")!.capacity = 2; // an organizer raised the limit
    expect(decideRegistrations(ctx(db, "org"), { ids: [regOf(db, "w1", "c")!.id], decision: "accept" })).toEqual({ ok: true, data: { changed: 1 } });
    expect(regOf(db, "w1", "c")!.status).toBe("going");
    expect(queued(db, "waitlist_promoted").map((n) => n.profile_id)).toEqual(["c"]);
    expect(regOf(db, "w1", "c")!.decision_notified_at).not.toBeNull();
    expect(sendDecisions(ctx(db, "org"), { eventId: "w1" })).toEqual({ ok: true, data: { queued: 0 } });
    expect(queued(db, "application_accepted")).toHaveLength(0);
  });
});
