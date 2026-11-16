import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { outboxForEvent } from "@/lib/events/admin-outbox";
import { requireStaffPage } from "@/lib/server/session";
import CommsView from "@/components/admin/events/CommsView";
import { RegistrationsSkeleton } from "@/components/admin/events/Skeletons";
import { loadEvent } from "@/components/admin/events/load";

type Params = Promise<{ lang: string; id: string }>;

async function Body({ lang, params }: { lang: Locale; params: Params }) {
  const { id } = await params;
  await requireStaffPage();
  await connection();
  const { db, event } = loadEvent(id);
  return <CommsView rows={outboxForEvent(db, event)} lang={lang} eventId={event.id} />;
}

export default async function CommsPage({ params }: { params: Params }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<RegistrationsSkeleton label={copy[lang].comms.loading} />}>
      <Body lang={lang} params={params} />
    </Suspense>
  );
}
