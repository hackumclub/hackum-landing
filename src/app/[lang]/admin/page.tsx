import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { formatUb } from "@/lib/time";
import { getDashboard, type Scenario } from "@/lib/admin/dashboard";
import Dashboard, { DashboardSkeleton } from "@/components/admin/Dashboard";
import DemoPill from "@/components/admin/DemoPill";
import { mockEnabled } from "@/lib/mockdb/store";

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
      <header className="grid grid-cols-1 gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-bold text-fg md:text-3xl">{t.title}</h1>
          {mockEnabled() && <DemoPill title={getDictionary(lang).admin.sample.title} text={getDictionary(lang).admin.sample.text} />}
        </div>
        <Suspense fallback={<p className="h-5" />}><Today lang={lang} /></Suspense>
      </header>
      <Suspense fallback={<DashboardSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Today({ lang }: { lang: Locale }) {
  await connection(); // "today" is request-time, not build-time
  return <p className="text-sm text-fg-muted">{formatUb(new Date(), lang, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>;
}
