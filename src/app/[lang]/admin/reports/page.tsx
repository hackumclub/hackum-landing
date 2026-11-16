import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { ButtonLink } from "@/components/ui/Button";
import { AnalyticsSkeleton } from "@/components/admin/events/Skeletons";
import PeriodReportView from "@/components/admin/reports/PeriodReportView";
import RangeControls from "@/components/admin/reports/RangeControls";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-reports";
import { href, isLocale, type Locale } from "@/i18n/config";
import { parseRangeParams } from "@/lib/date-range";
import { periodReport } from "@/lib/mockdb/reports";
import { getStore } from "@/lib/mockdb/store";
import { semesterOf, semesterRange } from "@/lib/semester";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].period.title} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // "this semester" and every number are per request
  const sp = await searchParams;
  if (process.env.NODE_ENV !== "production" && sp.state === "error") throw new Error("reports_preview_error");
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const defaultRange = semesterRange(semesterOf(now));
  const { range, custom } = parseRangeParams(sp, defaultRange);
  return (
    <>
      <RangeControls lang={lang} range={range} custom={custom} defaultRange={defaultRange} />
      <PeriodReportView report={periodReport(db, range, now)} db={db} now={now} lang={lang} />
    </>
  );
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang].period;
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage
        compact title={t.title} lead={t.lead}
        actions={<ButtonLink href={href(lang, "/admin/analytics")} variant="white">{t.openAnalytics}</ButtonLink>}
        art={<Icon3D name="chart" sizes="224px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-52" />}
      />
      <Suspense fallback={<AnalyticsSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
