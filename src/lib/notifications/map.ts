import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/shell";
import type { InboxItem, InboxKind } from "@/lib/mockdb/types";

/** What the bell, the panel and the pages show for one inbox row. Plain data: safe to hand to client components. */
export type InboxView = {
  id: string;
  kind: InboxKind;
  title: string;
  /** One line, the object named in it. */
  line: string;
  /** The object the item is about; null when it names none (the notifications page is the home of such items). */
  href: string | null;
  unread: boolean;
  createdAt: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
// Slugs are lowercase words and dashes; anything else never reaches an href.
const slugOf = (v: unknown): string => { const s = str(v); return /^[a-z0-9][a-z0-9-]{0,80}$/i.test(s) ? s : ""; };

const EVENT_KINDS: ReadonlySet<InboxKind> = new Set(["rsvp_confirmed", "waitlist_notice", "waitlist_promoted", "event_updated", "event_cancelled", "reminder_24h"]);
const APPLICATION_KINDS: ReadonlySet<InboxKind> = new Set(["application_received", "application_accepted", "application_rejected"]);

/** Maps an inbox row (kind + payload) to title, one line and the link to the object. Tolerates missing payload fields. */
export function describeInbox(item: InboxItem, lang: Locale): InboxView {
  const c = copy[lang];
  const kind = c.kinds[item.kind] ?? c.kinds.announcement;
  const p = item.payload;
  const slug = slugOf(p.event_slug);
  const other: Locale = lang === "mn" ? "en" : "mn";
  const event = str(p[`event_title_${lang}`]) || str(p[`event_title_${other}`]) || slug || c.generic.event;
  const name = str(p.name) || c.generic.person;
  const template = str(p.template) || c.generic.template;

  let href: string | null;
  if (EVENT_KINDS.has(item.kind)) href = slug ? `/${lang}/events/${slug}` : `/${lang}/me/events`;
  else if (APPLICATION_KINDS.has(item.kind)) href = slug ? `/${lang}/me/events/${slug}/apply` : `/${lang}/me/events`;
  else if (item.kind === "membership_approved" || item.kind === "membership_rejected") href = `/${lang}/me/membership`;
  else if (item.kind === "staff_application") href = `/${lang}/admin/members?tab=applications`;
  else if (item.kind === "staff_failed_email") href = `/${lang}/admin/comms?status=failed`;
  else if (item.kind === "feedback_request") href = slug ? `/${lang}/me/events/${slug}/feedback` : `/${lang}/me/events?tab=past`;
  else if (item.kind === "poll_opened") href = `/${lang}/me/polls`;
  else if (item.kind === "welcome") href = `/${lang}/me`;
  else href = slug ? `/${lang}/events/${slug}` : null; // announcement

  const own = item.kind === "announcement" ? str(p[`subject_${lang}`]) || str(p[`subject_${other}`]) || str(p.title) : "";
  return {
    id: item.id, kind: item.kind,
    title: own || kind.title,
    line: fill(kind.line, { event, name, template }),
    href, unread: !item.read_at, createdAt: item.created_at,
  };
}
