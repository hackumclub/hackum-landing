import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-reports";
import { fill, href, type Locale } from "@/i18n/config";
import { eventReport } from "@/lib/mockdb/reports";
import { buttonClass } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import type { Db, EventRow } from "@/lib/mockdb/types";
import EventReportView from "./EventReportView";

/** The report for a completed event; for any other status a short note and the way to Analytics. */
export default function EventReportBody({ db, event, now, lang }: { db: Db; event: EventRow; now: Date; lang: Locale }) {
  const e = copy[lang].event;
  const report = event.status === "completed" ? eventReport(db, event.id) : null;
  if (!report) {
    return (
      <EmptyState
        sticker="queue" title={e.notReady.title} line={fill(e.notReady.line, { status: getDictionary(lang).status[event.status] })}
        action={<Link href={href(lang, `/admin/events/${event.id}/analytics`)} className={buttonClass("primary")}>{e.notReady.action}<ArrowRight aria-hidden="true" size={16} /></Link>}
      />
    );
  }
  return <EventReportView report={report} event={event} now={now} lang={lang} />;
}
