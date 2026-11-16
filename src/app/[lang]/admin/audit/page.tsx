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
import { AUDIT_SPEC } from "@/components/admin/audit/filter";
import { previewState } from "@/components/admin/members/preview";
import { PageHeader, SectionSkeleton } from "@/components/admin/members/shared";
import { parseListState, serializeListState } from "@/lib/admin/list-state";
import { requireStaffPage } from "@/lib/server/session";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "audit");

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage({ admin: true }); // admin only: an organizer gets the 404 (F-18)
  await connection(); // relative times and the 24h/7d/30d ranges are per-request
  await previewState(searchParams);
  const filter = parseListState(await searchParams, AUDIT_SPEC);
  const c = copy[lang];
  const d = getDictionary(lang);
  const data = loadAudit(filter, lang, c, d.status);
  const path = href(lang, "/admin/audit");
  const hrefFor = (page: number) => {
    const qs = serializeListState({ ...filter, page }, AUDIT_SPEC).toString();
    return qs ? `${path}?${qs}` : path;
  };
  return (
    <>
      <AuditFilters actors={data.actors} lang={lang} c={c.audit} lists={c.lists} />
      <AuditTable rows={data.rows} total={data.total} now={data.now} lang={lang} c={c.audit} common={c.common} lists={c.lists} closeLabel={d.ui.close} homeHref={href(lang, "/admin")} />
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
