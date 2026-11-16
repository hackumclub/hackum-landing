import { err, type ErrorCode, type Result } from "@/lib/result";
import type { AuditEntry, Ctx, Db, EventRow, Notification, Profile, TemplateName } from "./types";

export const iso = (d: Date) => d.toISOString();
export const nextId = (db: Db, prefix: string) => `${prefix}_${++db.seq}`;
export const profileOf = (db: Db, id: string | null) => (id ? db.profiles.find((p) => p.id === id && !p.deleted_at) ?? null : null);
export const eventOf = (db: Db, id: string) => db.events.find((e) => e.id === id) ?? null;

export const isStaff = (db: Db, actor: string | null) => !!actor && db.staff_roles.some((r) => r.profile_id === actor);
export const isAdmin = (db: Db, actor: string | null) => !!actor && db.staff_roles.some((r) => r.profile_id === actor && r.role === "admin");

/** Guards shared by every rule: returns the acting profile, or the error to hand straight back. */
export function requireProfile(ctx: Ctx, opts: { onboarded?: boolean } = {}): Result<Profile> {
  const p = profileOf(ctx.db, ctx.actor);
  if (!p) return err("unauthenticated");
  if (opts.onboarded && !p.onboarded_at) return err("forbidden");
  return { ok: true, data: p };
}
export function requireStaff(ctx: Ctx, role?: "admin"): Result<Profile> {
  const p = profileOf(ctx.db, ctx.actor);
  if (!p) return err("unauthenticated");
  if (!(role === "admin" ? isAdmin(ctx.db, ctx.actor) : isStaff(ctx.db, ctx.actor))) return err("forbidden");
  return { ok: true, data: p };
}
export const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error });

export function audit(ctx: Ctx, action: string, entity: string, entityId: string, diff: Record<string, unknown> = {}) {
  const row: AuditEntry = { id: nextId(ctx.db, "au"), actor_profile_id: ctx.actor, action, entity, entity_id: entityId, diff, at: iso(ctx.now) };
  ctx.db.audit_log.push(row);
}

/** `to_name` etc. as the email renderer expects (keys fixed by src/emails/render.ts). */
export function eventPayload(ev: EventRow, p: Profile): Notification["payload"] {
  return {
    to_name: p.name.mn || p.name.en, event_id: ev.id, event_slug: ev.slug, event_title_mn: ev.title.mn, event_title_en: ev.title.en,
    starts_at: ev.starts_at, ends_at: ev.ends_at, venue: ev.venue_name, mode: ev.mode, ics_sequence: ev.ics_sequence,
  };
}

/** Outbox insert; a repeated dedupe key is a no-op (same contract as `on conflict (dedupe_key) do nothing`). */
export function enqueue(ctx: Ctx, n: { profileId: string; template: TemplateName; payload: Notification["payload"]; priority: 0 | 1 | 2; dedupe: string; at?: Date }) {
  if (ctx.db.notifications.some((x) => x.dedupe_key === n.dedupe)) return false;
  ctx.db.notifications.push({
    id: nextId(ctx.db, "n"), profile_id: n.profileId, to_email: null, channel: "email", template: n.template, payload: n.payload, priority: n.priority,
    scheduled_at: iso(n.at ?? ctx.now), status: "queued", attempts: 0, last_error: null, dedupe_key: n.dedupe, sent_at: null,
  });
  return true;
}

/** Ulaanbaatar calendar day (UTC+8) as YYYY-MM-DD, the key of `email_daily_usage`. */
export const ubDay = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

export const goingCount = (db: Db, eventId: string) => db.registrations.filter((r) => r.event_id === eventId && (r.status === "going" || r.status === "attended")).length;
