import { err, ok, type Result } from "@/lib/result";
import type { Ctx, Db, Notification } from "./types";
import { audit, enqueue, eventOf, eventPayload, goingCount, iso, notifyStaff, PREF_OF, profileOf, requireStaff, ubDay } from "./core";

export const DAILY_LIMIT = 100; // Resend free tier
export const RESERVED_FOR_TRANSACTIONAL = 20;

/** Queue reminder_24h for everyone going to a published event that starts 23–25h from now. Idempotent per start time. */
export function enqueueDueReminders(db: Db, now: Date): number {
  const ctx: Ctx = { db, actor: null, now };
  const lo = now.getTime() + 23 * 3_600_000, hi = now.getTime() + 25 * 3_600_000;
  let queued = 0;
  for (const ev of db.events) {
    const start = new Date(ev.starts_at).getTime();
    if (ev.status !== "published" || start <= lo || start > hi) continue;
    for (const r of db.registrations.filter((x) => x.event_id === ev.id && x.status === "going")) {
      const p = profileOf(db, r.profile_id);
      if (p && enqueue(ctx, { profileId: p.id, template: "reminder_24h", priority: 1, payload: eventPayload(ev, p), dedupe: `reminder24:${ev.id}:${p.id}:${Math.floor(start / 1000)}` })) queued++;
    }
  }
  return queued;
}

export type SendFn = (n: Notification, to: string) => "ok" | "fail";
/** Stands in for Resend: any address containing "bounce" fails, so the failure UI can be exercised locally. */
const simulatedSend: SendFn = (_n, to) => (to.includes("bounce") ? "fail" : "ok");

/** Why a queued message should not go out any more (null = fine to send). */
function skipReason(db: Db, n: Notification, to: string | null): string | null {
  const p = n.profile_id ? profileOf(db, n.profile_id) : null;
  if (n.profile_id && !p) return "recipient_gone";
  if (!to) return "no_address";
  if (db.email_suppressions.some((s) => s.email.toLowerCase() === to.toLowerCase())) return "suppressed";
  const pref = PREF_OF[n.template];
  if (p && pref && !p.notif_prefs[pref]) return "opted_out";
  const eventId = typeof n.payload.event_id === "string" ? n.payload.event_id : null;
  const ev = eventId ? eventOf(db, eventId) : null;
  if (ev && ev.status === "cancelled" && n.template !== "event_cancelled") return "event_cancelled";
  if (n.template === "reminder_24h" && ev) {
    if (n.payload.starts_at !== ev.starts_at) return "event_moved";
    if (!db.registrations.some((r) => r.event_id === ev.id && r.profile_id === n.profile_id && r.status === "going")) return "not_going";
  }
  return null;
}

export function dispatchOutbox(db: Db, now: Date, opts: { send?: SendFn; limit?: number } = {}) {
  const send = opts.send ?? simulatedSend;
  const day = ubDay(now);
  const out = { sent: 0, skipped: 0, failed: 0, deferred: 0 };
  const due = db.notifications
    .filter((n) => n.status === "queued" && new Date(n.scheduled_at) <= now)
    .sort((a, b) => a.priority - b.priority || a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, opts.limit ?? 50);
  for (const n of due) {
    const p = n.profile_id ? profileOf(db, n.profile_id) : null;
    const to = p?.email ?? n.to_email;
    const reason = skipReason(db, n, to);
    if (reason) { n.status = "skipped"; n.last_error = reason; out.skipped++; continue; }
    const cap = n.priority === 0 ? DAILY_LIMIT : DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL;
    if ((db.email_daily_usage[day] ?? 0) >= cap) { out.deferred++; continue; }
    if (send(n, to!) === "ok") {
      Object.assign(n, { status: "sent", sent_at: iso(now), last_error: null });
      db.email_daily_usage[day] = (db.email_daily_usage[day] ?? 0) + 1;
      out.sent++;
    } else {
      n.attempts += 1; n.last_error = "mailbox_unavailable"; out.failed++;
      if (n.attempts >= 5) { n.status = "failed"; notifyStaff(db, now, { kind: "staff_failed_email", payload: { notification_id: n.id, template: n.template }, dedupe: `failed:${n.id}` }); }
      else n.scheduled_at = iso(new Date(now.getTime() + 2 ** n.attempts * 60_000));
    }
  }
  return out;
}

/** Staff: put a failed message back in the queue (the Comms page "Retry" button). */
export function retryNotification(ctx: Ctx, input: { id: string }): Result<void> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const n = ctx.db.notifications.find((x) => x.id === input.id);
  if (!n) return err("not_found");
  if (n.status !== "failed") return err("conflict");
  Object.assign(n, { status: "queued", attempts: 0, last_error: null, scheduled_at: iso(ctx.now) });
  audit(ctx, "notification.retry", "notifications", n.id, { template: n.template });
  return ok(undefined);
}

/** One cron beat: what pg_cron + the dispatch route do in production. */
export function tick(db: Db, now: Date) {
  const reminders = enqueueDueReminders(db, now);
  return { reminders, ...dispatchOutbox(db, now) };
}

export { goingCount };
