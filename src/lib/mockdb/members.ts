import { err, ok, type Result } from "@/lib/result";
import { type Answers, parseAnswers } from "@/lib/events/questions";
import type { L, Locale } from "@/i18n/config";
import type { MemberStatus } from "@/lib/status";
import { audit, enqueue, iso, nextId, notifyStaff, profileOf, requireProfile, requireStaff } from "./core";
import type { Ctx, NotifPrefs, Season, StaffRoleName, Visibility } from "./types";

export function completeOnboarding(ctx: Ctx, input: { name: L; school: string; grad_year: number; locale: Locale }): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const school = input.school.trim();
  if (!input.name.mn.trim() || school.length < 1 || school.length > 80) return err("invalid");
  if (!Number.isInteger(input.grad_year) || input.grad_year < 2000 || input.grad_year > 2040) return err("invalid");
  const first = !me.data.onboarded_at;
  Object.assign(me.data, { name: { mn: input.name.mn.trim(), en: input.name.en.trim() }, school, grad_year: input.grad_year, locale: input.locale });
  if (first) {
    me.data.onboarded_at = iso(ctx.now);
    enqueue(ctx, { profileId: me.data.id, template: "welcome", priority: 0, payload: { to_name: me.data.name.mn }, dedupe: `welcome:${me.data.id}` });
  }
  return ok(undefined);
}

export function updatePrefs(ctx: Ctx, input: { notif_prefs: NotifPrefs; locale: Locale; visibility: Visibility }): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  Object.assign(me.data, { notif_prefs: { ...input.notif_prefs }, locale: input.locale, visibility: input.visibility });
  return ok(undefined);
}

/** The season whose application window contains `now` (the one people can apply to). */
export const openSeason = (ctx: Ctx) =>
  ctx.db.seasons.find((s) => s.application_opens_at && s.application_closes_at && new Date(s.application_opens_at) <= ctx.now && ctx.now <= new Date(s.application_closes_at)) ?? null;

export function applyForMembership(ctx: Ctx, input: { motivation: string; team_interest: string[]; answers?: Answers }): Result<{ id: string }> {
  const me = requireProfile(ctx, { onboarded: true });
  if (!me.ok) return me;
  const motivation = input.motivation.trim();
  if (motivation.length < 10 || motivation.length > 1000) return err("invalid");
  // The club's own questions (staff edit them under Forms); answers to unknown ones are dropped.
  const answers = parseAnswers(ctx.db.forms.find((f) => f.id === "membership_application")?.questions ?? [], input.answers ?? {});
  if (!answers.ok) return err("invalid");
  if (me.data.status === "member") return err("conflict");
  // Membership is for National University of Mongolia students who have chosen a major; everyone else stays a guest.
  if (me.data.school_id !== "num" || !me.data.major_track) return err("ineligible");
  const season = openSeason(ctx);
  if (!season) return err("closed");
  if (ctx.db.membership_applications.some((a) => a.profile_id === me.data.id && a.season === season.year)) return err("conflict");
  const row = { id: nextId(ctx.db, "a"), profile_id: me.data.id, season: season.year, motivation, team_interest: input.team_interest.slice(0, 6), answers: answers.data, status: "pending" as const, reviewed_by: null, reviewed_at: null, review_note: null, created_at: iso(ctx.now) };
  ctx.db.membership_applications.push(row);
  audit(ctx, "membership.apply", "membership_applications", row.id, { season: season.year });
  notifyStaff(ctx.db, ctx.now, { kind: "staff_application", payload: { application_id: row.id, profile_id: me.data.id, name: me.data.name.mn || me.data.name.en }, dedupe: `staffapp:${row.id}` });
  return ok({ id: row.id });
}

export function reviewMembership(ctx: Ctx, input: { id: string; approve: boolean; note: string }): Result<void> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const app = ctx.db.membership_applications.find((a) => a.id === input.id);
  const person = app && profileOf(ctx.db, app.profile_id);
  if (!app || !person) return err("not_found");
  if (app.status !== "pending") return err("conflict");
  // Same rule as applying: only NUM students with a major become members (rejecting stays possible).
  if (input.approve && (person.school_id !== "num" || !person.major_track)) return err("ineligible");
  Object.assign(app, { status: input.approve ? "approved" : "rejected", reviewed_by: staff.data.id, reviewed_at: iso(ctx.now), review_note: input.note.trim() || null });
  if (input.approve) {
    if (!ctx.db.memberships.some((m) => m.profile_id === person.id && m.season === app.season)) {
      ctx.db.memberships.push({ profile_id: person.id, season: app.season, team: app.team_interest[0] ?? null, role_title: null });
    }
    person.status = "member";
  }
  // The staff note is never part of the email payload.
  enqueue(ctx, { profileId: person.id, template: input.approve ? "membership_approved" : "membership_rejected", priority: 0, payload: { to_name: person.name.mn || person.name.en, season: app.season }, dedupe: `membership:${app.id}:${app.status}` });
  audit(ctx, input.approve ? "membership.approve" : "membership.reject", "membership_applications", app.id, { season: app.season });
  return ok(undefined);
}

export function setMemberStatus(ctx: Ctx, input: { ids: string[]; status: MemberStatus }): Result<{ changed: number }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  let changed = 0;
  for (const p of ctx.db.profiles.filter((x) => input.ids.includes(x.id) && !x.deleted_at && x.status !== input.status)) {
    audit(ctx, "member.status", "profiles", p.id, { status: [p.status, input.status] });
    p.status = input.status;
    changed++;
  }
  return ok({ changed });
}

export function mergeProfiles(ctx: Ctx, input: { keep: string; drop: string }): Result<void> {
  const admin = requireStaff(ctx, "admin");
  if (!admin.ok) return admin;
  if (input.keep === input.drop) return err("invalid");
  const { db } = ctx;
  const keep = profileOf(db, input.keep), drop = profileOf(db, input.drop);
  if (!keep || !drop) return err("not_found");
  db.memberships = db.memberships.filter((m) => m.profile_id !== drop.id || !db.memberships.some((k) => k.profile_id === keep.id && k.season === m.season));
  for (const m of db.memberships) if (m.profile_id === drop.id) m.profile_id = keep.id;
  db.registrations = db.registrations.filter((r) => r.profile_id !== drop.id || !db.registrations.some((k) => k.profile_id === keep.id && k.event_id === r.event_id));
  for (const r of db.registrations) if (r.profile_id === drop.id) r.profile_id = keep.id;
  db.membership_applications = db.membership_applications.filter((a) => a.profile_id !== drop.id || !db.membership_applications.some((k) => k.profile_id === keep.id && k.season === a.season));
  for (const a of db.membership_applications) if (a.profile_id === drop.id) a.profile_id = keep.id;
  for (const t of db.teams) if (t.captain_profile_id === drop.id) t.captain_profile_id = keep.id;
  for (const n of db.notifications) if (n.profile_id === drop.id) n.profile_id = keep.id;
  for (const i of db.inbox) if (i.profile_id === drop.id) i.profile_id = keep.id;
  Object.assign(drop, { deleted_at: iso(ctx.now), email: null, clerk_user_id: null, handle: `${drop.handle}-merged-${++db.seq}` });
  audit(ctx, "profile.merge", "profiles", keep.id, { merged: drop.id });
  return ok(undefined);
}

export function grantRole(ctx: Ctx, input: { profileId: string; role: StaffRoleName | null }): Result<void> {
  const admin = requireStaff(ctx, "admin");
  if (!admin.ok) return admin;
  const { db } = ctx;
  if (!profileOf(db, input.profileId)) return err("not_found");
  // Whoever is an admin may be demoted or removed, but never by themselves and never the last one (the club must keep an admin).
  const current = db.staff_roles.find((r) => r.profile_id === input.profileId);
  const demoting = current?.role === "admin" && input.role !== "admin";
  if (demoting && (input.profileId === admin.data.id || db.staff_roles.filter((r) => r.role === "admin").length <= 1)) return err("conflict");
  if (input.role === null) {
    db.staff_roles = db.staff_roles.filter((r) => r.profile_id !== input.profileId);
  } else {
    db.staff_roles = db.staff_roles.filter((r) => r.profile_id !== input.profileId);
    db.staff_roles.push({ profile_id: input.profileId, role: input.role, granted_by: admin.data.id, granted_at: iso(ctx.now) });
  }
  audit(ctx, "staff.role", "staff_roles", input.profileId, { role: input.role });
  return ok(undefined);
}

export function upsertSeason(ctx: Ctx, input: Season): Result<void> {
  const admin = requireStaff(ctx, "admin");
  if (!admin.ok) return admin;
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) return err("invalid");
  if (input.application_opens_at && input.application_closes_at && new Date(input.application_opens_at) >= new Date(input.application_closes_at)) return err("invalid");
  const { db } = ctx;
  // Un-marking the only current season would leave the club with none: make another season current instead.
  if (db.seasons.find((x) => x.year === input.year)?.is_current && !input.is_current) return err("conflict");
  if (input.is_current) for (const s of db.seasons) s.is_current = false;
  const i = db.seasons.findIndex((s) => s.year === input.year);
  if (i >= 0) db.seasons[i] = { ...input }; else db.seasons.push({ ...input });
  audit(ctx, "season.upsert", "seasons", String(input.year), { is_current: input.is_current });
  return ok(undefined);
}
