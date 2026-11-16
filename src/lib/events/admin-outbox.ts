// The outbox rows that belong to one event (payload.event_id, or payload.event_slug on older seeded rows).
// Recipients are names only: email addresses never reach the page.
import type { L } from "@/i18n/config";
import { profileOf } from "@/lib/mockdb/core";
import type { Db, EventRow, NotifStatus, TemplateName } from "@/lib/mockdb/types";

export type OutboxRow = {
  id: string;
  template: TemplateName;
  recipient: L | null;
  status: NotifStatus;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
};

export function outboxForEvent(db: Db, ev: Pick<EventRow, "id" | "slug">): OutboxRow[] {
  return db.notifications
    .filter((n) => n.payload.event_id === ev.id || (n.payload.event_id === undefined && n.payload.event_slug === ev.slug))
    .map((n): OutboxRow => ({
      id: n.id, template: n.template, recipient: profileOf(db, n.profile_id)?.name ?? null, status: n.status,
      scheduledAt: n.scheduled_at, sentAt: n.sent_at, attempts: n.attempts, lastError: n.last_error,
    }))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}
