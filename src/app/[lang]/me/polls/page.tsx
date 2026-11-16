import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { pollCards } from "@/lib/me/poll-view";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { pollsCopy } from "@/components/me/polls/copy";
import PollCard from "@/components/me/polls/PollCard";
import { pollTimeLine } from "@/components/me/polls/time";
import { PageHeader, PageSkeleton } from "@/components/me/parts";
import { pill } from "@/components/me/pill";
import { meContext } from "@/components/me/context";
import { copy } from "@/i18n/areas/me";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const TABS = ["open", "closed"] as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: pollsCopy[lang].metaTitle } : {};
}

async function Body({ params, searchParams }: Props) {
  const { lang, session, db, now } = await meContext(params, (l) => `/${l}/me/polls`);
  const raw = (await searchParams).tab;
  const tab = TABS.find((t) => t === raw) ?? "open";
  const c = pollsCopy[lang];
  const all = pollCards(db, session.profileId, now);
  // Not-yet-open polls wait on the Open tab with their opening date; nothing there can be voted on until it opens.
  const lists = { open: all.filter((p) => p.state !== "closed"), closed: all.filter((p) => p.state === "closed") };
  const list = lists[tab];
  const other = tab === "open" ? "closed" : "open";
  const base = `/${lang}/me/polls`;
  return (
    <div className="grid gap-5">
      <PageHeader sticker="team" title={c.title} lead={c.lead} />
      <SegmentedTabs ariaLabel={c.tabsLabel} value={tab} className="[&_a]:min-h-11"
        items={TABS.map((k) => ({ key: k, label: c[k], count: lists[k].length }))}
        hrefs={{ open: `${base}?tab=open`, closed: `${base}?tab=closed` }} />
      {list.length === 0 ? (
        <EmptyState sticker="sleepy" title={tab === "open" ? c.emptyOpenTitle : c.emptyClosedTitle} line={tab === "open" ? c.emptyOpenLine : c.emptyClosedLine}
          action={lists[other].length > 0 ? <Link href={`${base}?tab=${other}`} className={pill.soft}>{tab === "open" ? c.emptyOpenAction : c.emptyClosedAction}</Link> : undefined} />
      ) : (
        <div className="grid gap-4">
          {list.map((vm) => <PollCard key={`${vm.id}:${(vm.myVote ?? []).join(",")}`} vm={vm} lang={lang} timeLine={pollTimeLine(vm, lang, now)} />)}
        </div>
      )}
    </div>
  );
}

export default async function PollsPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} />}>
      <Body {...props} />
    </Suspense>
  );
}
