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
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "registrations");

type Params = Promise<{ lang: string; id: string }>;

async function Body({ lang, params }: { lang: Locale; params: Params }) {
  const { id } = await params;
  await requireStaffPage();
  await connection();
  const { db, event } = loadEvent(id);
  const built = buildRegistrations(db, id);
  const handles = new Map(db.profiles.map((p) => [p.id, p.handle]));
  const titles = new Map(db.events.map((e) => [e.id, e]));
  // What the drawer links to: the person's handle (→ Members) and their registrations for other events.
  const rows = built.rows.map((r) => ({
    ...r,
    handle: handles.get(r.profileId) ?? "",
    others: db.registrations
      .filter((o) => o.profile_id === r.profileId && o.event_id !== id && titles.has(o.event_id))
      .map((o) => ({ id: o.id, eventId: o.event_id, title: titles.get(o.event_id)!.title, startsAt: titles.get(o.event_id)!.starts_at, status: o.status }))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 6),
  }));
  const { teams } = built;
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
