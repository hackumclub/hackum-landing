import { Suspense } from "react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { getStore } from "@/lib/mockdb/store";
import { requireStaffPage } from "@/lib/server/session";
import EventForm from "@/components/admin/events/EventForm";
import { FormSkeleton } from "@/components/admin/events/Skeletons";

async function Body({ lang }: { lang: Locale }) {
  await requireStaffPage();
  await connection(); // the suggested start time is relative to "now"
  const store = getStore();
  return <EventForm lang={lang} event={null} takenSlugs={store.read().events.map((e) => e.slug)} answered={0} nowIso={store.now().toISOString()} />;
}

export default async function NewEventPage() {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = copy[lang].form;
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage compact title={t.newTitle} art={<Icon3D name="flag" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" />} />
      <Suspense fallback={<FormSkeleton label={copy[lang].list.loading} />}>
        <Body lang={lang} />
      </Suspense>
    </div>
  );
}
