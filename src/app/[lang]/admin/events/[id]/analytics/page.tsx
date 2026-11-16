import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { eventAnalytics } from "@/lib/events/admin-analytics";
import { requireStaffPage } from "@/lib/server/session";
import AnalyticsView from "@/components/admin/events/AnalyticsView";
import { AnalyticsSkeleton } from "@/components/admin/events/Skeletons";
import { loadEvent } from "@/components/admin/events/load";

type Params = Promise<{ lang: string; id: string }>;

async function Body({ lang, params }: { lang: Locale; params: Params }) {
  const { id } = await params;
  await requireStaffPage();
  await connection(); // "last 30 days" is relative to now
  const { db, event, now } = loadEvent(id);
  return (
    <AnalyticsView
      a={eventAnalytics(db, id, now)} lang={lang} eventId={event.id} slug={event.slug} published={event.status !== "draft"} application={event.reg_mode === "application"}
    />
  );
}

export default async function AnalyticsPage({ params }: { params: Params }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<AnalyticsSkeleton label={copy[lang].analytics.loading} />}>
      <Body lang={lang} params={params} />
    </Suspense>
  );
}
