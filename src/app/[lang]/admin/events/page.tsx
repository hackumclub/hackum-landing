import { Suspense } from "react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
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
import { PRESETS, type Preset } from "@/lib/events/list-presets";
import { ListSkeleton } from "@/components/admin/events/Skeletons";
import { ButtonLink } from "@/components/ui/Button";

type Search = Promise<Record<string, string | string[] | undefined>>;

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Search }) {
  await requireStaffPage();
  await connection(); // "live now" and counts are per request
  // ?state=empty|error|slow previews each state in development; ignored in production.
  const sp = await searchParams;
  const raw = sp.state;
  const preset = PRESETS.find((p): p is Preset => p === sp.filter) ?? null;
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
        needsEn: !e.title.en.trim() || !e.description.en.trim(), cover: e.cover_path, noEnTitle: !e.title.en.trim(),
      };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return <EventsList rows={rows} lang={lang} preset={preset} />;
}

export default async function EventsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Search }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang].list;
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage
        compact title={t.title}
        actions={<ButtonLink href={href(lang, "/admin/events/new")} icon={<Plus aria-hidden="true" size={16} />}>{t.createEvent}</ButtonLink>}
        art={<Icon3D name="ticket" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" />}
      />
      <Suspense fallback={<ListSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
