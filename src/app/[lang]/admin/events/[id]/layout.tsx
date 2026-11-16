import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale } from "@/i18n/config";
import { requireStaffPage } from "@/lib/server/session";
import EventHeader from "@/components/admin/events/EventHeader";
import { HeaderSkeleton } from "@/components/admin/events/Skeletons";
import { loadEvent } from "@/components/admin/events/load";

type Params = Promise<{ lang: string; id: string }>;

async function Header({ params }: { params: Params }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  await requireStaffPage();
  await connection();
  const { db, event, now } = loadEvent(id);
  return <EventHeader db={db} event={event} now={now} lang={lang} />;
}

/** Event frame shared by Overview · Registrations · Analytics · Comms. The page below streams in on its own. */
export default async function EventLayout({ children, params }: { children: ReactNode; params: Params }) {
  // `id` is request data, so params is only awaited inside Suspense; the locale is a root param and is known up front.
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <div className="grid grid-cols-1 gap-6">
      <Suspense fallback={<HeaderSkeleton label={copy[lang].header.loading} />}>
        <Header params={params} />
      </Suspense>
      {children}
    </div>
  );
}
