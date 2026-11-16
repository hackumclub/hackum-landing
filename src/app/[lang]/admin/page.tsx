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
import Icon3D from "@/components/Icon3D";
import { mockEnabled } from "@/lib/mockdb/store";
import { ButtonLink } from "@/components/ui/Button";
import { isAdminRouteReady } from "@/lib/admin/nav";
import { Plus } from "lucide-react";

const SCENARIOS: Scenario[] = ["default", "empty", "error", "slow"];

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // ?state=empty|error|slow previews each state against sample data; ignored in production.
  await connection(); // sample dates are relative to "now": request-time, never prerendered
  const raw = (await searchParams).state;
  const scenario = process.env.NODE_ENV !== "production" && SCENARIOS.includes(raw as Scenario) ? (raw as Scenario) : "default";
  const data = await getDashboard({ lang, scenario });
  return <Dashboard data={data} lang={lang} d={getDictionary(lang)} />;
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
        art={<Icon3D name="chart" sizes="224px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-52" />}
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
