import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { eventsTabs } from "@/lib/me/queries";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { cx } from "@/components/ui/cx";
import EventCard from "@/components/me/EventCard";
import { PageHeader, PageSkeleton } from "@/components/me/parts";
import { meContext } from "@/components/me/context";
import type { StickerName } from "@/lib/manul";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const TABS = ["upcoming", "going", "applied", "past"] as const;
type Tab = (typeof TABS)[number];
const STICKER: Record<Tab, StickerName> = { upcoming: "sleepy", going: "coffee", applied: "laptop", past: "roll" };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].events.title } : {};
}

async function Body({ params, searchParams }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/events`);
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.find((t) => t === raw) ?? "upcoming";
  const lists = eventsTabs(db, session.profileId, now);
  const t = c.events;
  const list = lists[tab];
  const empty: Record<Tab, { title: string; line: string; action?: { label: string; tab: Tab } }> = {
    upcoming: { title: t.emptyUpcomingTitle, line: t.emptyUpcomingLine },
    going: { title: t.emptyGoingTitle, line: t.emptyGoingLine, action: { label: t.emptyGoingAction, tab: "upcoming" } },
    applied: { title: t.emptyAppliedTitle, line: t.emptyAppliedLine, action: { label: t.emptyAppliedAction, tab: "upcoming" } },
    past: { title: t.emptyPastTitle, line: t.emptyPastLine, action: { label: t.emptyPastAction, tab: "upcoming" } },
  };
  const e = empty[tab];
  return (
    <div className="grid gap-5">
      <PageHeader sticker="rsvp" title={t.title} />
      <nav aria-label={t.tabs} className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
        <ul className="flex gap-1.5">
          {TABS.map((k) => {
            const active = k === tab;
            return (
              <li key={k}>
                <Link href={`/${lang}/me/events?tab=${k}`} aria-current={active ? "page" : undefined}
                  className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap", active ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong bg-panel text-fg")}>
                  {t[k]}<span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{lists[k].length}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="text-sm text-fg-muted tnum" aria-live="polite">{plural(lang as Locale, list.length, t.results)}</p>
      {list.length === 0
        ? <EmptyState sticker={STICKER[tab]} title={e.title} line={e.line} action={e.action && <ButtonLink href={`/${lang}/me/events?tab=${e.action.tab}`} size="lg" variant="secondary">{e.action.label}</ButtonLink>} />
        : <div className="grid gap-3">{list.map((vm) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} mode={tab === "upcoming" ? "upcoming" : tab} />)}</div>}
    </div>
  );
}

export default async function EventsPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} />}>
      <Body {...props} />
    </Suspense>
  );
}
