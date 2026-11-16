import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { ButtonLink } from "@/components/ui/Button";
import { copy as reportCopy } from "@/i18n/areas/admin-reports";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/analytics";
import { isLocale, type Locale } from "@/i18n/config";
import { parseTab } from "@/lib/admin/analytics-href";
import { showRate } from "@/lib/admin/analytics-view";
import { parseRangeParams, previousRange } from "@/lib/date-range";
import { analytics } from "@/lib/mockdb/analytics";
import { getStore } from "@/lib/mockdb/store";
import { previousSemester, semesterOf, semesterRange } from "@/lib/semester";
import Controls from "./Controls";
import { AnalyticsSkeleton, EventsTab, MembersTab, Overview, SemestersTab, type View } from "./Sections";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].page.title } : {};
}

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await connection(); // "this semester" and every number are per request
  const sp = await searchParams;
  // ?state=error previews the error boundary in development; ignored in production.
  if (process.env.NODE_ENV !== "production" && sp.state === "error") throw new Error("analytics_preview_error");
  const c = copy[lang];
  const tab = parseTab(sp.tab);
  const store = getStore();
  const db = store.read();
  const cur = semesterOf(store.now());
  // Semesters compares autumn with spring, so its default spans the last and the current semester.
  const defaultRange = tab === "semesters" ? { from: semesterRange(previousSemester(cur)).from, to: semesterRange(cur).to } : semesterRange(cur);
  const { range, custom } = parseRangeParams(sp, defaultRange);
  const prev = previousRange(range);
  const v: View = {
    lang, d: getDictionary(lang), c: c, range, prev, db, a: analytics(db, range), p: analytics(db, prev), rate: showRate(db, range), prevRate: showRate(db, prev),
  };
  return (
    <div className="grid gap-6">
      <Controls
        lang={lang} tab={tab} range={range} custom={custom} defaultRange={defaultRange} tabLabels={c.page.tabs} tabsLabel={c.page.tabsLabel}
        defaultLabel={tab === "semesters" ? c.page.rangeDefaultSemesters : c.page.rangeDefault}
      />
      {tab === "overview" && <Overview v={v} />}
      {tab === "events" && <EventsTab v={v} />}
      {tab === "members" && <MembersTab v={v} />}
      {tab === "semesters" && <SemestersTab v={v} />}
    </div>
  );
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage compact title={c.page.title} lead={c.page.lead} actions={<ButtonLink href={`/${lang}/admin/reports`} variant="white">{reportCopy[lang].period.openReport}</ButtonLink>} art={<Icon3D name="chart" sizes="224px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-52" />} />
      <Suspense fallback={<AnalyticsSkeleton label={c.page.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
