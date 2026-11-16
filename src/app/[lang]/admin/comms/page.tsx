import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { href, isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import { ALL_TEMPLATES } from "@/emails/render";
import { PageHeader, SectionSkeleton } from "@/components/admin/members/shared";
import { previewState } from "@/components/admin/members/preview";
import { loadComms } from "@/components/admin/comms/data";
import BudgetCard from "@/components/admin/comms/BudgetCard";
import KpiCard from "@/components/ui/KpiCard";
import OutboxTable from "@/components/admin/comms/OutboxTable";
import SendNowButton from "@/components/admin/comms/SendNowButton";
import StatusTabs from "@/components/admin/comms/StatusTabs";
import TemplateFilter from "@/components/admin/comms/TemplateFilter";
import Skeleton from "@/components/ui/Skeleton";
import { requireStaffPage } from "@/lib/server/session";
import type { NotifGroup } from "@/lib/members/format";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const STATUSES = ["all", "queued", "sent", "failed", "skipped"] as const;
type StatusFilter = (typeof STATUSES)[number];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // today's budget and "scheduled/sent" times are per-request
  await previewState(searchParams);
  const sp = await searchParams;
  const c = copy[lang];
  const d = getDictionary(lang);
  const rawStatus = first(sp.status);
  const status: StatusFilter = STATUSES.find((s) => s === rawStatus) ?? "all";
  const templates = (first(sp.template) ?? "").split(",").filter((t): t is (typeof ALL_TEMPLATES)[number] => (ALL_TEMPLATES as readonly string[]).includes(t));

  const data = loadComms(lang, c.comms);
  const rows = data.rows.filter((r) => (status === "all" || r.group === status) && (templates.length === 0 || templates.includes(r.template)));
  const path = href(lang, "/admin/comms");
  const qs = (s: StatusFilter) => {
    const p = new URLSearchParams();
    if (s !== "all") p.set("status", s);
    if (templates.length) p.set("template", templates.join(","));
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  };
  const n = new Intl.NumberFormat(lang === "mn" ? "mn-MN" : "en-US");
  const k = c.comms.kpis;

  return (
    <>
      <section aria-labelledby="comms-kpis">
        <h2 id="comms-kpis" className="sr-only">{k.label}</h2>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5">
          <BudgetCard sent={data.sentToday} limit={data.limit} reserved={data.reserved} label={k.sentToday} c={c.comms.budget} className="min-[480px]:col-span-2" />
          <KpiCard label={k.queued} value={n.format(data.counts.queued)} hint={k.queuedHint} />
          <KpiCard label={k.failed} value={n.format(data.counts.failed)} hint={k.failedHint} />
          <KpiCard label={k.skipped} value={n.format(data.counts.skipped)} hint={k.skippedHint} />
        </div>
      </section>

      <div className="grid gap-3">
        <StatusTabs
          label={c.comms.statusLabel}
          active={status}
          tabs={STATUSES.map((s) => ({ value: s, label: c.comms.tabs[s], count: data.counts[s as NotifGroup | "all"], href: qs(s) }))}
        />
        <TemplateFilter
          label={c.comms.templateFilter}
          options={data.templates.map((t) => ({ value: t.name, label: c.comms.templates[t.name], count: t.count }))}
          value={templates}
          base={{ path, status }}
        />
      </div>

      <OutboxTable rows={rows} now={data.now} lang={lang} c={c.comms} common={c.common} closeLabel={d.ui.close} allHref={path} filtered={data.rows.length > 0} />
    </>
  );
}

export default async function CommsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.comms.title} lead={c.comms.lead} action={<SendNowButton c={c.comms} common={c.common} />} />
      <Suspense fallback={<div className="grid gap-5"><div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5"><Skeleton className="h-[170px] rounded-[var(--radius-md)] min-[480px]:col-span-2" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}</div><SectionSkeleton label={c.comms.loading} rows={8} /></div>}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
