import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { homeData } from "@/lib/me/queries";
import { feedbackDue } from "@/lib/me/feedback-due";
import { openPollToAnswer } from "@/lib/me/poll-view";
import { FeedbackDueList } from "@/components/me/feedback/FeedbackDue";
import { feedbackCopy } from "@/components/me/feedback/copy";
import OpenPollCard from "@/components/me/polls/OpenPollCard";
import { pollsCopy } from "@/components/me/polls/copy";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import EventCard, { EventGrid } from "@/components/me/EventCard";
import { AttentionList, MembershipCta, NextEventCard } from "@/components/me/HomeParts";
import { PageHeader, PageSkeleton, Section } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  // Absolute: the layout's title template does not apply to the page of its own segment (F-19).
  return isLocale(lang) ? { title: { absolute: `${copy[lang].home.title} | ${copy[lang].meta.title}` } } : {};
}

async function Body({ params }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me`);
  const h = c.home;
  const me = db.profiles.find((p) => p.id === session.profileId);
  const data = homeData(db, session.profileId, now);
  // Mongolian names are "patronymic Given" (the given name is last); English names are "Given Family".
  const parts = me ? tf(me.name, lang).split(/\s+/).filter(Boolean) : [];
  const first = (lang === "mn" ? parts.at(-1) : parts[0]) ?? "";
  const due = feedbackDue(db, session.profileId, now);
  const poll = openPollToAnswer(db, session.profileId, now);
  const quiet = !data.next && data.live.length === 0 && data.attention.length === 0;

  return (
    <div className="grid gap-7">
      <PageHeader sticker="wave" title={first ? fill(h.hi, { name: first }) : h.hiNoName} />

      {data.live.length > 0 && (
        <Section title={h.liveTitle} id="live">
          <EventGrid>{data.live.map((vm, i) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} now={now} eager={i === 0} mode={vm.reg ? "going" : "home"} />)}</EventGrid>
        </Section>
      )}

      {data.next && <Section title={h.nextTitle} id="next"><NextEventCard vm={data.next} lang={lang} c={c} d={d} now={now} eager={data.live.length === 0} /></Section>}

      {data.attention.length > 0 && <Section title={h.attentionTitle} id="attention"><AttentionList items={data.attention} lang={lang} c={c} /></Section>}

      {due.length > 0 && <Section title={feedbackCopy[lang].dueTitle} id="feedback"><FeedbackDueList items={due} lang={lang} now={now} /></Section>}

      {poll && <Section title={pollsCopy[lang].homeTitle} id="open-poll"><OpenPollCard vm={poll} lang={lang} now={now} /></Section>}

      <MembershipCta m={data.membership} lang={lang} c={c} d={d} />

      {data.brandNew && quiet && (
        <EmptyState sticker="wave" title={h.emptyTitle} line={h.emptyLine} action={<ButtonLink href={`/${lang}/me/events`} size="lg">{h.emptyAction}</ButtonLink>} />
      )}

      <Section title={h.nextUpTitle} id="whats-next" aside={<Link href={`/${lang}/me/events`} className={buttonClass("ghost", "lg")}>{h.allEvents}</Link>}>
        {data.whatsNext.length > 0
          ? <EventGrid>{data.whatsNext.map((vm) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} now={now} mode="home" />)}</EventGrid>
          : <EmptyState sticker="sleepy" title={h.nothingNextTitle} line={h.nothingNextLine} />}
      </Section>
    </div>
  );
}

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} />}>
      <Body params={params} />
    </Suspense>
  );
}
