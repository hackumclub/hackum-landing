import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { ArrowLeft } from "lucide-react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { phaseTone } from "@/components/admin/polls/phase";
import PollEditor from "@/components/admin/polls/PollEditor";
import PollResults from "@/components/admin/polls/PollResults";
import PollStatusActions from "@/components/admin/polls/PollStatusActions";
import { PollBodySkeleton } from "@/components/admin/polls/Skeletons";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import StatusPill from "@/components/ui/StatusPill";
import Tag from "@/components/ui/Tag";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-polls";
import { href, isLocale, tf, type Locale } from "@/i18n/config";
import { pollResults } from "@/lib/mockdb/polls";
import { getStore } from "@/lib/mockdb/store";
import { draftFromPoll } from "@/lib/polls/form";
import { audienceCounts, notifyCount, pollPhase } from "@/lib/polls/rows";
import { requireStaffPage } from "@/lib/server/session";

type Params = Promise<{ lang: string; id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].title} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang, params, searchParams }: { lang: Locale; params: Params; searchParams: Search }) {
  const { id } = await params;
  const who = await requireStaffPage();
  await connection(); // phase, turnout and counts are per request
  const sp = await searchParams;
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const poll = db.polls.find((p) => p.id === id);
  if (!poll) notFound();
  const view = pollResults(db, id, who.profileId, now);
  if (!view) notFound();
  const t = copy[lang];
  const phase = pollPhase(poll, now);
  const tab = sp.tab === "results" || sp.tab === "settings" ? sp.tab : poll.status === "draft" ? "settings" : "results";
  const base = href(lang, `/admin/polls/${id}`);
  return (
    <>
      <Link href={href(lang, "/admin/polls")} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" size={16} />{t.back}
      </Link>
      <Stage
        compact
        title={<span className="max-md:block max-md:pr-4">{tf(poll.title, lang)}</span>}
        lead={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2 max-md:pr-6">
            <StatusPill status={phaseTone(phase)} label={t.phase[phase]} />
            <Tag>{t.audience[poll.audience]}</Tag>
          </span>
        }
        actions={<PollStatusActions lang={lang} pollId={id} title={poll.title} status={poll.status} audience={poll.audience} people={notifyCount(db, poll)} voters={view.voters} />}
        art={<Icon3D name="clipboard" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-40" />}
      />
      {sp.created === "1" && <p role="status" className="rounded-[var(--radius-sm)] border border-line bg-ok-soft px-4 py-3 text-sm font-semibold text-ok-fg">{t.editor.created}</p>}
      <SegmentedTabs
        ariaLabel={t.tabs.label} value={tab}
        items={[{ key: "results", label: t.tabs.results }, { key: "settings", label: t.tabs.settings }]}
        hrefs={{ results: `${base}?tab=results`, settings: `${base}?tab=settings` }}
      />
      {tab === "results"
        ? <PollResults view={view} lang={lang} />
        : <PollEditor lang={lang} pollId={id} initial={draftFromPoll(poll)} counts={audienceCounts(db)} voters={view.voters} />}
    </>
  );
}

export default async function PollPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <div className="grid grid-cols-1 gap-6">
      <Suspense fallback={<PollBodySkeleton label={copy[lang].loading} />}>
        <Body lang={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
