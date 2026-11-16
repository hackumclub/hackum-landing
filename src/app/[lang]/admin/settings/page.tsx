import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";
import Icon3D from "@/components/Icon3D";
import { getDictionary } from "@/i18n";
import { fill, isLocale, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import SeasonsManager from "@/components/admin/settings/SeasonsManager";
import { loadSeasons } from "@/components/admin/settings/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";
import { formatUb } from "@/lib/time";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage("admin");
  await connection(); // "open now" depends on the clock
  await previewState(searchParams);
  const c = copy[lang];
  const t = c.settings.seasons;
  const d = getDictionary(lang);
  const { seasons } = loadSeasons();
  const current = seasons.find((s) => s.isCurrent);
  const open = seasons.find((s) => s.window === "open");
  const next = seasons.filter((s) => s.window === "scheduled").sort((a, b) => (a.opensAt ?? "").localeCompare(b.opensAt ?? ""))[0];
  const day = (iso: string | null) => (iso ? formatUb(new Date(iso), lang, { month: "short", day: "numeric" }) : "");
  const appLine = open ? fill(t.appsOpen, { label: tf(open.label, lang), when: day(open.closesAt) })
    : next ? fill(t.appsScheduled, { label: tf(next.label, lang), when: day(next.opensAt) }) : t.appsClosed;
  const AppIcon = open ? CalendarCheck : next ? CalendarClock : CalendarX;
  return (
    <div className="grid gap-5">
      <section aria-label={t.current} className="grid gap-3 md:grid-cols-2">
        <div className="relative grid gap-1 overflow-hidden rounded-[var(--radius-md)] border border-line bg-[radial-gradient(120%_140%_at_100%_0%,var(--ops-accent-soft),var(--ops-panel)_65%)] p-4 shadow-[var(--shadow-card)] md:p-5">
          <Icon3D name="calendar" sizes="80px" className="pointer-events-none absolute -top-1 right-2 size-16 rotate-6 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-20" />
          <p className="pr-16 text-sm font-semibold text-fg-muted">{t.current}</p>
          <p className="pr-16 font-display text-2xl font-black text-fg md:text-3xl">{current ? tf(current.label, lang) : t.none}</p>
        </div>
        <div className={`relative grid gap-1 overflow-hidden rounded-[var(--radius-md)] border border-line p-4 shadow-[var(--shadow-card)] md:p-5 ${open ? "bg-[radial-gradient(120%_140%_at_100%_0%,var(--ops-ok-soft),var(--ops-panel)_65%)]" : "bg-panel"}`}>
          <Icon3D name="clipboard" sizes="80px" className="pointer-events-none absolute -top-1 right-2 size-16 rotate-6 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-20" />
          <p className="pr-16 text-sm font-semibold text-fg-muted">{t.applications}</p>
          <p className="flex items-start gap-2 pr-16 text-sm font-semibold text-fg"><AppIcon aria-hidden="true" size={18} className={open ? "mt-0.5 shrink-0 text-ok-fg" : "mt-0.5 shrink-0 text-fg-muted"} />{appLine}</p>
        </div>
      </section>
      <SeasonsManager seasons={seasons} lang={lang} c={t} common={c.common} tz={d.ui.tz} closeLabel={d.ui.close} />
    </div>
  );
}

export default async function SeasonsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].settings.loading} rows={5} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
