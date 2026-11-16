import "server-only";
import { tf, type Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { notifGroup, type NotifGroup } from "@/lib/members/format";
import { ubDay } from "@/lib/mockdb/core";
import { DAILY_LIMIT, RESERVED_FOR_TRANSACTIONAL } from "@/lib/mockdb/outbox";
import { getStore } from "@/lib/mockdb/store";
import type { NotifStatus, TemplateName } from "@/lib/mockdb/types";

export type OutboxRow = {
  id: string; template: TemplateName; recipient: string; priority: 0 | 1 | 2; status: NotifStatus; group: NotifGroup;
  scheduledAt: string; sentAt: string | null; attempts: number; lastError: string | null;
};
export type CommsData = {
  rows: OutboxRow[];
  counts: Record<NotifGroup | "all", number>;
  templates: { name: TemplateName; count: number }[];
  sentToday: number; limit: number; reserved: number; now: string;
};

/** The whole outbox as display rows. Recipients are shown by name only: no email address ever reaches the list or the client. */
export function loadComms(lang: Locale, c: AreaCopy["comms"]): CommsData {
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const people = new Map(db.profiles.map((p) => [p.id, p]));
  const subscribers = new Map(db.subscribers.map((s) => [s.email.toLowerCase(), s]));
  const rows: OutboxRow[] = db.notifications.map((n) => {
    let recipient: string;
    if (n.profile_id) {
      const p = people.get(n.profile_id);
      recipient = p && !p.deleted_at ? tf(p.name, lang).trim() || p.name.mn || p.handle : c.recipientGone;
    } else {
      const s = n.to_email ? subscribers.get(n.to_email.toLowerCase()) : undefined;
      recipient = s?.name ? c.recipientSubscriber.replace("{name}", s.name) : c.recipientSubscriberUnknown;
    }
    return { id: n.id, template: n.template, recipient, priority: n.priority, status: n.status, group: notifGroup(n.status), scheduledAt: n.scheduled_at, sentAt: n.sent_at, attempts: n.attempts, lastError: n.last_error };
  }).sort((a, b) => (b.sentAt ?? b.scheduledAt).localeCompare(a.sentAt ?? a.scheduledAt));
  const counts = { all: rows.length, queued: 0, sent: 0, failed: 0, skipped: 0 };
  for (const r of rows) counts[r.group]++;
  const byTemplate = new Map<TemplateName, number>();
  for (const r of rows) byTemplate.set(r.template, (byTemplate.get(r.template) ?? 0) + 1);
  return {
    rows, counts,
    templates: [...byTemplate].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    sentToday: db.email_daily_usage[ubDay(now)] ?? 0, limit: DAILY_LIMIT, reserved: RESERVED_FOR_TRANSACTIONAL, now: now.toISOString(),
  };
}
