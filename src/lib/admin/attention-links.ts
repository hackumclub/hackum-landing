import type { L, Locale } from "@/i18n/config";
import { attentionCounts } from "@/lib/mockdb/queries";
import type { Db } from "@/lib/mockdb/types";
import { ATTENTION_ORDER, type AttentionKind } from "@/lib/admin/dashboard";

/** A "Needs attention" row that goes to the object, not to a hidden preset (audit F-17). */
export type AttentionLink = {
  kind: AttentionKind; count: number; href: string;
  /** pending_applications only: the event the link opens, and how many other events also have applications waiting. */
  eventTitle?: L; more: number; moreHref?: string;
};

/**
 * Non-zero counts, most urgent first, each with the deepest useful link:
 * - applications → the registrations of the event with the most pending (earliest event on a tie), filtered to
 *   `status=applied`; other events with pending applications are summarised as "+N more" → the events list;
 * - failed emails → Comms filtered to failed; membership requests → Members › applications;
 * - cover / English gaps → the events list preset (that list shows a removable chip).
 */
export function buildAttention(db: Db, lang: Locale): AttentionLink[] {
  const counts = attentionCounts(db);
  const published = new Map(db.events.filter((e) => e.status === "published").map((e) => [e.id, e]));
  const pendingBy = new Map<string, number>();
  for (const r of db.registrations) if (r.status === "applied" && published.has(r.event_id)) pendingBy.set(r.event_id, (pendingBy.get(r.event_id) ?? 0) + 1);
  const top = [...pendingBy.entries()].sort((a, b) => b[1] - a[1] || published.get(a[0])!.starts_at.localeCompare(published.get(b[0])!.starts_at) || a[0].localeCompare(b[0]))[0];

  const base = `/${lang}/admin`;
  const plain: Record<Exclude<AttentionKind, "pending_applications">, string> = {
    failed_emails: `${base}/comms?status=failed`,
    pending_members: `${base}/members?tab=applications`,
    missing_cover: `${base}/events?filter=missing_cover`,
    needs_en: `${base}/events?filter=needs_en`,
  };
  return ATTENTION_ORDER.filter((k) => counts[k] > 0).map((kind): AttentionLink => {
    if (kind !== "pending_applications") return { kind, count: counts[kind], href: plain[kind], more: 0 };
    const more = pendingBy.size - 1;
    return {
      kind, count: counts[kind], more, ...(more > 0 ? { moreHref: `${base}/events?filter=applications` } : {}),
      href: top ? `${base}/events/${top[0]}/registrations?status=applied` : `${base}/events?filter=applications`,
      eventTitle: top ? published.get(top[0])!.title : undefined,
    };
  });
}
