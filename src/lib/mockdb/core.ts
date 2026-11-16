import { err, type ErrorCode, type Result } from "@/lib/result";
import type { AuditEntry, Ctx, Db, EventRow, InboxKind, Notification, Profile, TemplateName } from "./types";

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

/** Which notification preference silences a template (others are always delivered). Shared by the dispatcher and the inbox. */
export const PREF_OF: Partial<Record<TemplateName, "reminders" | "updates" | "announcements">> = { reminder_24h: "reminders", event_updated: "updates", announcement: "announcements" };

/** In-app notification. A repeated dedupe key is a no-op, like the outbox. Returns whether a row was added. */
export function pushInbox(db: Db, now: Date, n: { profileId: string; kind: InboxKind; payload: Notification["payload"]; dedupe: string }): boolean {
  if (db.inbox.some((x) => x.dedupe_key === n.dedupe)) return false;
  db.inbox.push({ id: nextId(db, "in"), profile_id: n.profileId, kind: n.kind, payload: n.payload, created_at: iso(now), read_at: null, dedupe_key: n.dedupe });
  return true;
}
/** Every staff member gets the item (new application, mail that gave up). */
export function notifyStaff(db: Db, now: Date, n: { kind: InboxKind; payload: Notification["payload"]; dedupe: string }) {
  for (const r of db.staff_roles) if (profileOf(db, r.profile_id)) pushInbox(db, now, { profileId: r.profile_id, kind: n.kind, payload: n.payload, dedupe: `${n.dedupe}:${r.profile_id}` });
}

/** Outbox insert; a repeated dedupe key is a no-op (same contract as `on conflict (dedupe_key) do nothing`). */
export function enqueue(ctx: Ctx, n: { profileId: string; template: TemplateName; payload: Notification["payload"]; priority: 0 | 1 | 2; dedupe: string; at?: Date }) {
  if (ctx.db.notifications.some((x) => x.dedupe_key === n.dedupe)) return false;
  ctx.db.notifications.push({
    id: nextId(ctx.db, "n"), profile_id: n.profileId, to_email: null, channel: "email", template: n.template, payload: n.payload, priority: n.priority,
    scheduled_at: iso(n.at ?? ctx.now), status: "queued", attempts: 0, last_error: null, dedupe_key: n.dedupe, sent_at: null,
  });
  // The same message also lands in the person's in-app list, unless they switched that kind off.
  const pref = PREF_OF[n.template];
  const who = profileOf(ctx.db, n.profileId);
  if (who && !(pref && !who.notif_prefs[pref])) pushInbox(ctx.db, ctx.now, { profileId: who.id, kind: n.template, payload: n.payload, dedupe: n.dedupe });
  return true;
}

/** Ulaanbaatar calendar day (UTC+8) as YYYY-MM-DD, the key of `email_daily_usage`. */
export const ubDay = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

export const goingCount = (db: Db, eventId: string) => db.registrations.filter((r) => r.event_id === eventId && (r.status === "going" || r.status === "attended")).length;
