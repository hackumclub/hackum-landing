import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { formatUb } from "@/lib/time";
import { getDashboard, type Scenario } from "@/lib/admin/dashboard";
import Dashboard, { DashboardSkeleton } from "@/components/admin/Dashboard";
import DemoPill from "@/components/admin/DemoPill";
import Stage from "@/components/ops/Stage";
import Sticker from "@/components/Sticker";
import { mockEnabled } from "@/lib/mockdb/store";
import { ButtonLink } from "@/components/ui/Button";
import { isAdminRouteReady } from "@/lib/admin/nav";
import { Plus } from "lucide-react";
import { buildAttention } from "@/lib/admin/attention-links";
import { analytics, type Analytics } from "@/lib/mockdb/analytics";
import { getStore } from "@/lib/mockdb/store";
import { previousSemester, semesterLabel, semesterOf, semesterRange } from "@/lib/semester";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "dashboard");

const SCENARIOS: Scenario[] = ["default", "empty", "error", "slow"];
const EMPTY_ANALYTICS: Analytics = { registrationsByDay: [], funnel: { registered: 0, going: 0, attended: 0 }, showRateByKind: [], membersBySchool: [], membersByTrack: [], bySemester: [], retention: [] };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?state=empty|error|slow previews each state against sample data; ignored in production.
  await connection(); // sample dates are relative to "now": request-time, never prerendered
  const raw = (await searchParams).state;
  const scenario = process.env.NODE_ENV !== "production" && SCENARIOS.includes(raw as Scenario) ? (raw as Scenario) : "default";
  const data = await getDashboard({ lang, scenario });
  // ?sem=last switches the charts to the previous semester; anything else is this one.
  const store = getStore();
  const db = store.read();
  const sem = (await searchParams).sem === "last" ? previousSemester(semesterOf(store.now())) : semesterOf(store.now());
  const key = (await searchParams).sem === "last" ? "last" : "this";
  const empty = scenario === "empty";
  const attention = empty ? [] : buildAttention(db, lang);
  const stats: Analytics = empty ? EMPTY_ANALYTICS : analytics(db, semesterRange(sem));
  return <Dashboard data={data} attention={attention} analytics={stats} semester={{ key, label: semesterLabel(sem, lang) }} lang={lang} d={getDictionary(lang)} />;
}

export default async function DashboardPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).admin.dashboard;
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage
        compact
        title={t.title}
        lead={<Suspense fallback={<span className="inline-block h-5 w-48" />}><Today lang={lang} /></Suspense>}
        actions={(
          <>
            {isAdminRouteReady(lang, "events") && <ButtonLink href={`/${lang}/admin/events/new`} icon={<Plus aria-hidden="true" size={16} />}>{t.createEvent}</ButtonLink>}
            {mockEnabled() && <DemoPill title={getDictionary(lang).admin.sample.title} text={getDictionary(lang).admin.sample.text} />}
          </>
        )}
        art={<Sticker name="laptop" sizes="208px" eager className="w-24 -rotate-3 md:w-48" />}
      />
      <Suspense fallback={<DashboardSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Today({ lang }: { lang: Locale }) {
  await connection(); // "today" is request-time, not build-time
  return <span>{formatUb(new Date(), lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>;
}
