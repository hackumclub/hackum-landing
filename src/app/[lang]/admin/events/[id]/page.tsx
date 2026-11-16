import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { CheckCircle2 } from "lucide-react";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { requireStaffPage } from "@/lib/server/session";
import EventForm from "@/components/admin/events/EventForm";
import { FormSkeleton } from "@/components/admin/events/Skeletons";
import { loadEvent } from "@/components/admin/events/load";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "event");

type Params = Promise<{ lang: string; id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

async function Body({ lang, params, searchParams }: { lang: Locale; params: Params; searchParams: Search }) {
  const { id } = await params;
  await requireStaffPage();
  await connection();
  const created = (await searchParams).created === "1";
  const { db, event, now } = loadEvent(id);
  const answered = db.registrations.filter((r) => r.event_id === id && Object.keys(r.answers).length > 0).length;
  return (
    <div className="grid grid-cols-1 gap-4">
      {created && (
        <p role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-ok-soft px-4 py-3 text-sm font-semibold text-ok-fg">
          <CheckCircle2 aria-hidden="true" size={18} />{copy[lang].form.created}
        </p>
      )}
      <EventForm
        key={event.id} lang={lang} event={event} answered={answered} nowIso={now.toISOString()}
        takenSlugs={db.events.filter((e) => e.id !== id).map((e) => e.slug)}
      />
    </div>
  );
}

export default async function EventOverviewPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<FormSkeleton label={copy[lang].list.loading} />}>
      <Body lang={lang} params={params} searchParams={searchParams} />
    </Suspense>
  );
}
