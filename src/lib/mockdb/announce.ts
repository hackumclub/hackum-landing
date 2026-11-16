import { err, ok, type Result } from "@/lib/result";
import type { L, Locale } from "@/i18n/config";
import { audit, enqueue, iso, nextId, profileOf, requireStaff } from "./core";
import { DAILY_LIMIT, RESERVED_FOR_TRANSACTIONAL } from "./outbox";
import type { Ctx, Db, Profile } from "./types";
import type { RegStatus } from "@/lib/status";

export type AnnounceAudience =
  | { kind: "members" } // status member
  | { kind: "community" } // members and alumni
  | { kind: "everyone" } // every account
  | { kind: "subscribers" } // newsletter addresses that have no account
  | { kind: "event"; eventId: string; statuses: Exclude<RegStatus, "cancelled">[] };
export type AnnouncementInput = { /** client-generated id: the same key never mails the same person twice */ key: string; audience: AnnounceAudience; subject: L; body: L };
export type Recipient = { profile_id?: string; email?: string; lang?: Locale; name?: string };

const SUBJECT_MAX = 120, BODY_MAX = 5000, MAX_PER_HOUR = 5;
const HOUR_MS = 3_600_000;
/** Accounts that can be written to: onboarded, not deleted, with an address (unclaimed legacy profiles have none). */
const reachable = (p: Profile) => !p.deleted_at && !!p.onboarded_at && !!p.email;

export function resolveAudience(db: Db, a: AnnounceAudience): Recipient[] {
  const people = (keep: (p: Profile) => boolean): Recipient[] => db.profiles.filter((p) => reachable(p) && keep(p)).map((p) => ({ profile_id: p.id }));
  switch (a.kind) {
    case "members": return people((p) => p.status === "member");
    case "community": return people((p) => p.status === "member" || p.status === "alumni");
    case "everyone": return people(() => true);
    case "subscribers": {
      const accounts = new Set(db.profiles.map((p) => p.email?.toLowerCase()).filter(Boolean));
      return db.subscribers.filter((s) => !accounts.has(s.email.toLowerCase())).map((s) => ({ email: s.email, lang: s.lang, name: s.name }));
    }
    case "event": {
      const ids = new Set(db.registrations.filter((r) => r.event_id === a.eventId && r.status !== "cancelled" && (a.statuses as string[]).includes(r.status)).map((r) => r.profile_id));
      return db.profiles.filter((p) => ids.has(p.id) && !p.deleted_at && !!p.email).map((p) => ({ profile_id: p.id }));
    }
  }
}

const optedOut = (db: Db, r: Recipient) => !!r.profile_id && profileOf(db, r.profile_id)?.notif_prefs.announcements === false;

/** What the composer shows before sending: everyone in the audience, and who will not get it because they opted out. */
export function audienceSize(db: Db, a: AnnounceAudience): { total: number; willReceive: number; optedOut: number } {
  const all = resolveAudience(db, a);
  const out = all.filter((r) => optedOut(db, r)).length;
  return { total: all.length, willReceive: all.length - out, optedOut: out };
}

export function sendAnnouncement(ctx: Ctx, input: AnnouncementInput): Result<{ queued: number; optedOut: number; days: number }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const { db, now } = ctx;
  const key = input.key.trim();
  if (!key || key.length > 64) return err("invalid");
  if (!input.subject.mn.trim() || input.subject.mn.length > SUBJECT_MAX || input.subject.en.length > SUBJECT_MAX) return err("invalid");
  if (!input.body.mn.trim() || input.body.mn.length > BODY_MAX || input.body.en.length > BODY_MAX) return err("invalid");
  const a = input.audience;
  if (a.kind === "event" && (!db.events.some((e) => e.id === a.eventId) || a.statuses.length === 0)) return err("invalid");
  const recent = db.audit_log.filter((x) => x.action === "announcement.send" && x.actor_profile_id === staff.data.id && now.getTime() - new Date(x.at).getTime() < HOUR_MS).length;
  if (recent >= MAX_PER_HOUR) return err("rate_limited");

  const payload = { subject_mn: input.subject.mn.trim(), subject_en: input.subject.en.trim(), body_mn: input.body.mn.trim(), body_en: input.body.en.trim() };
  let queued = 0, skipped = 0;
  for (const r of resolveAudience(db, a)) {
    if (optedOut(db, r)) { skipped++; continue; }
    if (r.profile_id) {
      const p = profileOf(db, r.profile_id)!;
      if (enqueue(ctx, { profileId: p.id, template: "announcement", priority: 2, payload: { ...payload, to_name: p.name.mn || p.name.en }, dedupe: `ann:${key}:${p.id}` })) queued++;
    } else if (r.email) {
      const dedupe = `ann:${key}:${r.email.toLowerCase()}`;
      if (db.notifications.some((n) => n.dedupe_key === dedupe)) continue;
      db.notifications.push({ id: nextId(db, "n"), profile_id: null, to_email: r.email, channel: "email", template: "announcement", payload: { ...payload, to_name: r.name ?? "" }, priority: 2, scheduled_at: iso(now), status: "queued", attempts: 0, last_error: null, dedupe_key: dedupe, sent_at: null });
      queued++;
    }
  }
  audit(ctx, "announcement.send", "announcements", key, { audience: a.kind, queued, opted_out: skipped });
  return ok({ queued, optedOut: skipped, days: Math.max(1, Math.ceil(queued / (DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL))) });
}
