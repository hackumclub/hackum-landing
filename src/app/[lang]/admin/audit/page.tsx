import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { href, isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import AuditFilters from "@/components/admin/audit/AuditFilters";
import AuditPager from "@/components/admin/audit/AuditPager";
import AuditTable from "@/components/admin/audit/AuditTable";
import { loadAudit } from "@/components/admin/audit/data";
import { parseAuditFilter } from "@/components/admin/audit/filter";
import { previewState } from "@/components/admin/members/preview";
import { PageHeader, SectionSkeleton } from "@/components/admin/members/shared";
import { withQuery } from "@/lib/members/format";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // relative times and the 24h/7d/30d ranges are per-request
  await previewState(searchParams);
  const filter = parseAuditFilter(await searchParams);
  const c = copy[lang];
  const d = getDictionary(lang);
  const data = loadAudit(filter, lang, c, d.status);
  const path = href(lang, "/admin/audit");
  const filtered = filter.groups.length > 0 || filter.actor !== null || filter.range !== null;
  const hrefFor = (page: number) => withQuery(path, { group: filter.groups, actor: filter.actor, range: filter.range, page: page > 1 ? page : null });
  return (
    <>
      <AuditFilters filter={filter} actors={data.actors} path={path} c={c.audit} />
      <AuditTable rows={data.rows} total={data.total} now={data.now} lang={lang} c={c.audit} common={c.common} closeLabel={d.ui.close} clearHref={path} filtered={filtered} />
      <AuditPager page={data.page} pages={data.pages} from={data.from} to={data.to} total={data.total} hrefFor={hrefFor} c={c.audit} />
    </>
  );
}

export default async function AuditPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.audit.title} lead={c.audit.lead} icon="clock" />
      <Suspense fallback={<SectionSkeleton label={c.audit.loading} rows={8} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
