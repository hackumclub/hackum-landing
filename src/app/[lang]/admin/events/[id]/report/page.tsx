import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-reports";
import { isLocale, type Locale } from "@/i18n/config";
import { requireStaffPage } from "@/lib/server/session";
import { loadEvent } from "@/components/admin/events/load";
import { AnalyticsSkeleton } from "@/components/admin/events/Skeletons";
import EventReportBody from "@/components/admin/reports/EventReportBody";

type Params = Promise<{ lang: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].event.title} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang, params }: { lang: Locale; params: Params }) {
  const { id } = await params;
  await requireStaffPage();
  await connection(); // "generated on" and every number are per request
  const { db, event, now } = loadEvent(id);
  return <EventReportBody db={db} event={event} now={now} lang={lang} />;
}

export default async function EventReportPage({ params }: { params: Params }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<AnalyticsSkeleton label={copy[lang].event.loading} />}>
      <Body lang={lang} params={params} />
    </Suspense>
  );
}
