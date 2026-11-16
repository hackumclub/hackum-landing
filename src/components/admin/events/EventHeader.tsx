import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { displayStatus, eventWhen } from "@/lib/events/format";
import { outboxForEvent } from "@/lib/events/admin-outbox";
import { eventStats } from "@/lib/mockdb/queries";
import type { Db, EventRow } from "@/lib/mockdb/types";
import StatusPill from "@/components/ui/StatusPill";
import TabNav from "@/components/ui/TabNav";
import StatusActions from "./StatusActions";

/** Title, status, kind · date, the status actions, and the section tabs. Server-rendered from the store. */
export default function EventHeader({ db, event, now, lang }: { db: Db; event: EventRow; now: Date; lang: Locale }) {
  const t = copy[lang].header;
  const d = getDictionary(lang);
  const title = tf(event.title, lang);
  const stats = eventStats(db, event.id);
  // People who would be told about a cancellation: everyone with a live registration (same set the rule emails).
  const people = stats.going + stats.waitlisted + stats.applied;
  const base = href(lang, `/admin/events/${event.id}`);
  const shown = displayStatus(event, now);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Link href={href(lang, "/admin/events")} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" size={16} />{t.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1.5">
          <h1 className="font-display text-2xl font-bold break-words text-fg md:text-3xl">{title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <StatusPill status={shown} label={d.status[shown]} />
            <span>{fill(t.meta, { kind: d.admin.kinds[event.kind], when: eventWhen(event, lang) })}</span>
          </p>
        </div>
        <StatusActions lang={lang} eventId={event.id} title={title} status={event.status} people={people} />
      </div>
      <TabNav
        label={t.tabsLabel}
        tabs={[
          { href: base, label: t.tabs.overview },
          { href: `${base}/registrations`, label: t.tabs.registrations, count: stats.registered },
          { href: `${base}/analytics`, label: t.tabs.analytics },
          { href: `${base}/comms`, label: t.tabs.comms, count: outboxForEvent(db, event).length },
        ]}
      />
    </div>
  );
}
