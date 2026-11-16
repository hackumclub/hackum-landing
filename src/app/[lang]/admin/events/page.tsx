import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { copy } from "@/i18n/areas/admin-events";
import { href, isLocale, type Locale } from "@/i18n/config";
import { displayStatus } from "@/lib/events/format";
import { getStore } from "@/lib/mockdb/store";
import { goingCount } from "@/lib/mockdb/core";
import { requireStaffPage } from "@/lib/server/session";
import EventsList, { type ListRow } from "@/components/admin/events/EventsList";
import { ListSkeleton } from "@/components/admin/events/Skeletons";
import { ButtonLink } from "@/components/ui/Button";

type Search = Promise<Record<string, string | string[] | undefined>>;

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Search }) {
  await requireStaffPage();
  await connection(); // "live now" and counts are per request
  // ?state=empty|error|slow previews each state in development; ignored in production.
  const raw = (await searchParams).state;
  const scenario = process.env.NODE_ENV !== "production" && (raw === "empty" || raw === "error" || raw === "slow") ? raw : null;
  if (scenario === "slow") await new Promise((r) => setTimeout(r, 2500));
  if (scenario === "error") throw new Error("events_list_preview_error");

  const store = getStore();
  const db = store.read();
  const now = store.now();
  const rows: ListRow[] = scenario === "empty" ? [] : db.events
    .map((e): ListRow => {
      const regs = db.registrations.filter((r) => r.event_id === e.id);
      return {
        id: e.id, slug: e.slug, title: e.title, kind: e.kind, stored: e.status, shown: displayStatus(e, now), startsAt: e.starts_at, approximate: e.approximate_date,
        regMode: e.reg_mode, capacity: e.capacity, going: goingCount(db, e.id), applied: regs.filter((r) => r.status === "applied").length,
        accepted: regs.filter((r) => r.status === "going" || r.status === "attended").length, legacy: e.legacy_participants,
        needsEn: !e.title.en.trim() || !e.description.en.trim(),
      };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <EventsList rows={rows} lang={lang} />;
}

export default async function EventsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Search }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang].list;
  return (
    <div className="grid grid-cols-1 gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-fg md:text-3xl">{t.title}</h1>
        <ButtonLink href={href(lang, "/admin/events/new")} icon={<Plus aria-hidden="true" size={16} />}>{t.createEvent}</ButtonLink>
      </header>
      <Suspense fallback={<ListSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
