import { Suspense } from "react";
import { Megaphone } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { href, isLocale, type Locale } from "@/i18n/config";
import { ButtonLink } from "@/components/ui/Button";
import { copy as announceCopy } from "@/lib/announce/copy";
import { copy } from "@/i18n/areas/admin-members";
import { PageHeader, SectionSkeleton } from "@/components/admin/members/shared";
import { previewState } from "@/components/admin/members/preview";
import { loadComms } from "@/components/admin/comms/data";
import BudgetCard from "@/components/admin/comms/BudgetCard";
import KpiCard from "@/components/ui/KpiCard";
import OutboxTable from "@/components/admin/comms/OutboxTable";
import SendNowButton from "@/components/admin/comms/SendNowButton";
import Skeleton from "@/components/ui/Skeleton";
import { requireStaffPage } from "@/lib/server/session";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "comms");

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // today's budget and "scheduled/sent" times are per-request
  await previewState(searchParams);
  const c = copy[lang];
  const d = getDictionary(lang);
  const data = loadComms(lang, c.comms);
  const n = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
  const k = c.comms.kpis;

  return (
    <>
      <section aria-labelledby="comms-kpis">
        <h2 id="comms-kpis" className="sr-only">{k.label}</h2>
        <div className="grid gap-3 xl:grid-cols-2">
          <BudgetCard sent={data.sentToday} limit={data.limit} reserved={data.reserved} label={k.sentToday} c={c.comms.budget} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2">
            <KpiCard tone="green" icon="mail" label={k.sent} value={n.format(data.counts.sent)} hint={k.sentHint} />
            <KpiCard tone="blue" icon="clock" label={k.queued} value={n.format(data.counts.queued)} hint={k.queuedHint} />
            <KpiCard tone="ember" icon="bell" label={k.failed} value={n.format(data.counts.failed)} hint={k.failedHint} />
            <KpiCard tone="yellow" icon="shield" label={k.skipped} value={n.format(data.counts.skipped)} hint={k.skippedHint} />
          </div>
        </div>
      </section>

      <OutboxTable
        allRows={data.rows} templates={data.templates.map((t) => t.name)} now={data.now} lang={lang} c={c.comms} common={c.common} lists={c.lists}
        closeLabel={d.ui.close} eventsHref={href(lang, "/admin/events")}
      />
    </>
  );
}

// Header actions: "New announcement" is the primary pill, "Send queued now" is the quieter glass pill with its helper text.
export default async function CommsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.comms.title} lead={c.comms.lead} icon="mail" action={<><ButtonLink href={href(lang, "/admin/comms/new")} variant="primary" className="self-start" icon={<Megaphone aria-hidden="true" size={16} />}>{announceCopy[lang].send.another}</ButtonLink><SendNowButton c={c.comms} common={c.common} help={c.lists.comms.sendHelp} /></>} />
      <Suspense fallback={<div className="grid gap-5"><div className="grid gap-3 xl:grid-cols-2"><Skeleton className="h-[200px] rounded-[var(--radius-md)]" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}</div></div><SectionSkeleton label={c.comms.loading} rows={8} /></div>}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
