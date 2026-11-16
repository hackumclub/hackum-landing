import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { buildRegistrations } from "@/lib/events/admin-registrations";
import { requireStaffPage } from "@/lib/server/session";
import RegistrationsView from "@/components/admin/events/RegistrationsView";
import { RegistrationsSkeleton } from "@/components/admin/events/Skeletons";
import { loadEvent } from "@/components/admin/events/load";

type Params = Promise<{ lang: string; id: string }>;

async function Body({ lang, params }: { lang: Locale; params: Params }) {
  const { id } = await params;
  await requireStaffPage();
  await connection();
  const { db, event } = loadEvent(id);
  const { rows, teams } = buildRegistrations(db, id);
  return (
    <RegistrationsView
      lang={lang} eventId={event.id} slug={event.slug} published={event.status !== "draft"} application={event.reg_mode === "application"} capacity={event.capacity}
      teamMode={event.team_mode} teamMin={event.team_size_min} teamMax={event.team_size_max} questions={event.questions} rows={rows} teams={teams}
    />
  );
}

export default async function RegistrationsPage({ params }: { params: Params }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<RegistrationsSkeleton label={copy[lang].regs.loading} />}>
      <Body lang={lang} params={params} />
    </Suspense>
  );
}
