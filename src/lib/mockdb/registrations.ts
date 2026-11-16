import { err, ok, type Result } from "@/lib/result";
import type { Answers, Question } from "@/lib/events/questions";
import type { RegStatus } from "@/lib/status";
import { audit, enqueue, eventOf, eventPayload, goingCount, iso, nextId, profileOf, requireProfile, requireStaff } from "./core";
import type { Ctx, Db, EventRow, Registration, Team } from "./types";

export type TeamChoice = { mode: "create"; name: string } | { mode: "join"; code: string } | { mode: "solo" };
const LIVE: RegStatus[] = ["going", "waitlisted", "applied", "attended"];

/** Required questions must be present and non-empty. (Full typing/length rules live in zod: answersSchema.) */
function answersComplete(qs: Question[], a: Answers) {
  return qs.every((q) => {
    if (!q.required) return true;
    const v = a[q.id];
    return q.type === "checkbox" ? v === true : Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
  });
}

const codeFrom = (db: Db) => {
  for (let n = db.seq * 7919; ; n += 1) {
    const c = `HK-${(n % 1_679_616).toString(36).toUpperCase().padStart(4, "0")}`;
    if (!db.teams.some((t) => t.invite_code === c)) return c;
  }
};
const findTeamByCode = (db: Db, code: string) => db.teams.find((t) => t.invite_code === code.trim().toUpperCase());
const members = (db: Db, teamId: string) => db.registrations.filter((r) => r.team_id === teamId && r.status !== "cancelled");

function checkTeam(ev: EventRow, db: Db, team: TeamChoice | undefined): Result<null> {
  if (ev.reg_mode !== "application" || ev.team_mode === "none") return ok(null);
  if (!team || (team.mode === "solo" && ev.team_mode === "required")) return ev.team_mode === "required" ? err("invalid") : ok(null);
  if (team.mode === "create") {
    const name = team.name.trim();
    if (name.length < 2 || name.length > 40) return err("invalid");
    if (db.teams.some((t) => t.event_id === ev.id && t.name.toLowerCase() === name.toLowerCase())) return err("conflict");
  }
  if (team.mode === "join") {
    const t = findTeamByCode(db, team.code);
    if (!t || t.event_id !== ev.id) return err("not_found");
    if (t.locked) return err("closed");
    if (members(db, t.id).length >= ev.team_size_max) return err("full");
  }
  return ok(null);
}

export function registerForEvent(ctx: Ctx, input: { eventId: string; answers: Answers; team?: TeamChoice }): Result<{ status: RegStatus; teamId?: string; inviteCode?: string }> {
  const { db, now } = ctx;
  const me = requireProfile(ctx, { onboarded: true });
  if (!me.ok) return me;
  const ev = eventOf(db, input.eventId);
  if (!ev || ev.status === "draft") return err("not_found");
  if (ev.status !== "published") return err("closed");
  if (ev.audience === "invite") return err("closed");
  if (ev.audience === "members" && me.data.status !== "member") return err("forbidden");
  if (ev.audience === "alumni" && me.data.status !== "alumni") return err("forbidden");
  if ((ev.reg_opens_at && now < new Date(ev.reg_opens_at)) || (ev.reg_closes_at && now > new Date(ev.reg_closes_at)) || now > new Date(ev.ends_at)) return err("closed");

  const existing = db.registrations.find((r) => r.event_id === ev.id && r.profile_id === me.data.id);
  if (existing && LIVE.includes(existing.status)) return ok({ status: existing.status, teamId: existing.team_id ?? undefined });
  if (existing?.status === "rejected") return err("conflict");

  if (!answersComplete(ev.questions, input.answers)) return err("invalid");
  const teamCheck = checkTeam(ev, db, input.team);
  if (!teamCheck.ok) return teamCheck;

  let status: RegStatus;
  if (ev.reg_mode === "application") status = "applied";
  else if (ev.capacity !== null && goingCount(db, ev.id) >= ev.capacity) {
    if (!ev.waitlist) return err("full");
    status = "waitlisted";
  } else status = "going";

  let reg: Registration;
  if (existing) {
    Object.assign(existing, { status, answers: input.answers, cancelled_at: null, created_at: iso(now), decided_by: null, decided_at: null, decision_notified_at: null });
    reg = existing;
  } else {
    reg = { id: nextId(db, "r"), event_id: ev.id, profile_id: me.data.id, status, source: "web", answers: input.answers, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: iso(now), cancelled_at: null };
    db.registrations.push(reg);
  }

  const out: { status: RegStatus; teamId?: string; inviteCode?: string } = { status };
  if (input.team && ev.reg_mode === "application" && ev.team_mode !== "none") {
    if (input.team.mode === "create") {
      const t: Team = { id: nextId(db, "t"), event_id: ev.id, name: input.team.name.trim(), invite_code: codeFrom(db), captain_profile_id: me.data.id, looking_for: [], locked: false };
      db.teams.push(t); reg.team_id = t.id; out.teamId = t.id; out.inviteCode = t.invite_code;
    } else if (input.team.mode === "join") {
      const t = findTeamByCode(db, input.team.code)!;
      reg.team_id = t.id; out.teamId = t.id; out.inviteCode = t.invite_code;
    }
  }

  enqueue(ctx, {
    profileId: me.data.id, priority: 0, template: status === "applied" ? "application_received" : status === "going" ? "rsvp_confirmed" : "waitlist_notice",
    payload: { ...eventPayload(ev, me.data), ...(out.teamId ? { team_name: db.teams.find((t) => t.id === out.teamId)?.name ?? null, invite_code: out.inviteCode ?? null } : {}) },
    dedupe: `${status === "applied" ? "application_received" : status === "going" ? "rsvp_confirmed" : "waitlist_notice"}:${ev.id}:${me.data.id}:${db.seq}`,
  });
  return ok(out);
}

function detachFromTeam(db: Db, reg: Registration) {
  const teamId = reg.team_id;
  if (!teamId) return;
  reg.team_id = null;
  const team = db.teams.find((t) => t.id === teamId);
  if (!team) return;
  const rest = members(db, teamId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (rest.length === 0) db.teams.splice(db.teams.indexOf(team), 1);
  else if (team.captain_profile_id === reg.profile_id) team.captain_profile_id = rest[0].profile_id;
}

export function cancelRegistration(ctx: Ctx, input: { eventId: string }): Result<void> {
  const { db, now } = ctx;
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const reg = db.registrations.find((r) => r.event_id === input.eventId && r.profile_id === me.data.id);
  if (!reg || !LIVE.includes(reg.status)) return err("not_found");
  const hadSeat = reg.status === "going";
  reg.status = "cancelled"; reg.cancelled_at = iso(now);
  detachFromTeam(db, reg);
  const ev = eventOf(db, input.eventId);
  if (hadSeat && ev) {
    const next = db.registrations.filter((r) => r.event_id === ev.id && r.status === "waitlisted").sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const person = next && profileOf(db, next.profile_id);
    if (next && person && (ev.capacity === null || goingCount(db, ev.id) < ev.capacity)) {
      next.status = "going";
      enqueue(ctx, { profileId: person.id, priority: 0, template: "waitlist_promoted", payload: eventPayload(ev, person), dedupe: `waitlist_promoted:${ev.id}:${person.id}:${db.seq}` });
    }
  }
  return ok(undefined);
}

export function joinTeam(ctx: Ctx, input: { code: string }): Result<{ teamId: string }> {
  const me = requireProfile(ctx, { onboarded: true });
  if (!me.ok) return me;
  const team = findTeamByCode(ctx.db, input.code);
  if (!team) return err("not_found");
  const ev = eventOf(ctx.db, team.event_id);
  const reg = ctx.db.registrations.find((r) => r.event_id === team.event_id && r.profile_id === me.data.id && LIVE.includes(r.status));
  if (!ev || !reg) return err("forbidden");
  if (reg.team_id) return err("conflict");
  if (team.locked) return err("closed");
  if (members(ctx.db, team.id).length >= ev.team_size_max) return err("full");
  reg.team_id = team.id;
  return ok({ teamId: team.id });
}

export function leaveTeam(ctx: Ctx, input: { teamId: string }): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const reg = ctx.db.registrations.find((r) => r.team_id === input.teamId && r.profile_id === me.data.id);
  if (!reg) return err("not_found");
  detachFromTeam(ctx.db, reg);
  return ok(undefined);
}

export function decideRegistrations(ctx: Ctx, input: { ids: string[]; decision: "accept" | "reject" | "waitlist"; scope?: "individual" | "team" }): Result<{ changed: number }> {
  const { db, now } = ctx;
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  let regs = db.registrations.filter((r) => input.ids.includes(r.id));
  if (regs.length === 0) return err("not_found");
  if (input.scope === "team") {
    const teamIds = new Set(regs.map((r) => r.team_id).filter((t): t is string => !!t));
    regs = [...new Set([...regs, ...db.registrations.filter((r) => r.team_id && teamIds.has(r.team_id) && ["applied", "waitlisted"].includes(r.status))])];
  }
  regs = regs.filter((r) => r.status !== "cancelled" && r.status !== "attended" && r.status !== "no_show");
  const target: RegStatus = input.decision === "accept" ? "going" : input.decision === "reject" ? "rejected" : "waitlisted";

  if (target === "going") {
    for (const evId of new Set(regs.map((r) => r.event_id))) {
      const ev = eventOf(db, evId);
      if (!ev || ev.capacity === null) continue;
      const adding = regs.filter((r) => r.event_id === evId && r.status !== "going").length;
      if (goingCount(db, evId) + adding > ev.capacity) return err("full");
    }
  }
  let changed = 0;
  for (const r of regs) {
    if (r.status === target) continue;
    audit(ctx, "registration.decide", "event_registrations", r.id, { status: [r.status, target] });
    Object.assign(r, { status: target, decided_by: staff.data.id, decided_at: iso(now), decision_notified_at: null });
    changed++;
  }
  return ok({ changed });
}

export function sendDecisions(ctx: Ctx, input: { eventId: string }): Result<{ queued: number }> {
  const { db, now } = ctx;
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const ev = eventOf(db, input.eventId);
  if (!ev) return err("not_found");
  let queued = 0;
  for (const r of db.registrations.filter((x) => x.event_id === ev.id && x.decided_at && !x.decision_notified_at)) {
    const person = profileOf(db, r.profile_id);
    const template = r.status === "going" ? "application_accepted" : r.status === "rejected" ? "application_rejected" : r.status === "waitlisted" ? "waitlist_notice" : null;
    r.decision_notified_at = iso(now);
    if (!person || !template) continue;
    const team = r.team_id ? db.teams.find((t) => t.id === r.team_id) : undefined;
    if (enqueue(ctx, { profileId: person.id, priority: 0, template, payload: { ...eventPayload(ev, person), team_name: team?.name ?? null }, dedupe: `decision:${ev.id}:${person.id}:${r.status}:${r.decided_at}` })) queued++;
  }
  audit(ctx, "decisions.send", "events", ev.id, { queued });
  return ok({ queued });
}
