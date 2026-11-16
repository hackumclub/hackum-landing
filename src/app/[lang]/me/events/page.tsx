import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { eventsTabs } from "@/lib/me/queries";
import { feedbackCardState } from "@/lib/me/feedback-due";
import { FeedbackCardAction } from "@/components/me/feedback/FeedbackDue";
import { pollsCopy } from "@/components/me/polls/copy";
import { ButtonLink } from "@/components/ui/Button";
import { pill } from "@/components/me/pill";
import EmptyState from "@/components/ui/EmptyState";
import { cx } from "@/components/ui/cx";
import EventCard, { EventGrid } from "@/components/me/EventCard";
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
  // ?show=open → only what this person can join (no locked cards); ?show=alumni → alumni events. Both are removable.
  const showRaw = (await searchParams).show;
  const show = showRaw === "open" || showRaw === "alumni" ? showRaw : null;
  const list = lists[tab].filter((vm) => (show === "open" ? vm.reg || vm.elig.ok : show === "alumni" ? vm.audience === "alumni" : true));
  const empty: Record<Tab, { title: string; line: string; action?: { label: string; tab: Tab } }> = {
    upcoming: { title: t.emptyUpcomingTitle, line: t.emptyUpcomingLine },
    going: { title: t.emptyGoingTitle, line: t.emptyGoingLine, action: { label: t.emptyGoingAction, tab: "upcoming" } },
    applied: { title: t.emptyAppliedTitle, line: t.emptyAppliedLine, action: { label: t.emptyAppliedAction, tab: "upcoming" } },
    past: { title: t.emptyPastTitle, line: t.emptyPastLine, action: { label: t.emptyPastAction, tab: "upcoming" } },
  };
  const e = empty[tab];
  return (
    <div className="grid gap-5">
      <PageHeader sticker="rsvp" title={t.title} aside={<ButtonLink href={`/${lang}/me/polls`} variant="white" size="lg">{pollsCopy[lang].clubPolls}</ButtonLink>} />
      <nav aria-label={t.tabs} className="-mx-3 overflow-x-auto px-3 max-md:[mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] md:mx-0 md:px-0">
        <ul className="flex gap-1.5 pr-6 md:pr-0">
          {TABS.map((k) => {
            const active = k === tab;
            return (
              <li key={k}>
                <Link href={`/${lang}/me/events?tab=${k}${show ? `&show=${show}` : ""}`} aria-current={active ? "page" : undefined}
                  className={cx("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap", active ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-panel-2 text-fg hover:bg-neutral-soft")}>
                  {t[k]}<span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{lists[k].length}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {show && (
        <p className="flex flex-wrap items-center gap-x-3 text-sm font-semibold text-fg">
          <span>{show === "open" ? c.event.openOnly : c.membership.alumniEvents}</span>
          <Link href={`/${lang}/me/events?tab=${tab}`} className="inline-flex min-h-11 items-center text-accent-fg hover:underline">{c.event.showAll}</Link>
        </p>
      )}
      <p className="text-sm text-fg-muted tnum" aria-live="polite">{plural(lang as Locale, list.length, t.results)}</p>
      {list.length === 0
        ? <EmptyState sticker={STICKER[tab]} title={e.title} line={e.line} action={e.action && <Link href={`/${lang}/me/events?tab=${e.action.tab}`} className={pill.soft}>{e.action.label}</Link>} />
        : <EventGrid>{list.map((vm, i) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} now={now} eager={i === 0} mode={tab === "upcoming" ? "upcoming" : tab}
            after={tab === "past" ? <FeedbackCardAction state={feedbackCardState(db, vm.id, session.profileId, now)} slug={vm.slug} title={tf(vm.title, lang)} lang={lang} /> : undefined} />)}</EventGrid>}
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
