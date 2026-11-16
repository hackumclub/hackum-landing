import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { homeData } from "@/lib/me/queries";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import EventCard from "@/components/me/EventCard";
import { AttentionList, MembershipCta, NextEventCard } from "@/components/me/HomeParts";
import { PageHeader, PageSkeleton, Section } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].home.title } : {};
}

async function Body({ params }: Props) {
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me`);
  const h = c.home;
  const me = db.profiles.find((p) => p.id === session.profileId);
  const data = homeData(db, session.profileId, now);
  // Mongolian names are "patronymic Given" (the given name is last); English names are "Given Family".
  const parts = me ? tf(me.name, lang).split(/\s+/).filter(Boolean) : [];
  const first = (lang === "mn" ? parts.at(-1) : parts[0]) ?? "";
  const quiet = !data.next && data.live.length === 0 && data.attention.length === 0;

  return (
    <div className="grid gap-7">
      <PageHeader title={first ? fill(h.hi, { name: first }) : h.hiNoName} />

      {data.live.length > 0 && (
        <Section title={h.liveTitle} id="live">
          <div className="grid gap-3">{data.live.map((vm) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} mode={vm.reg ? "going" : "home"} />)}</div>
        </Section>
      )}

      {data.next && <Section title={h.nextTitle} id="next"><NextEventCard vm={data.next} lang={lang} c={c} now={now} /></Section>}

      {data.attention.length > 0 && <Section title={h.attentionTitle} id="attention"><AttentionList items={data.attention} lang={lang} c={c} /></Section>}

      <MembershipCta m={data.membership} lang={lang} c={c} d={d} />

      {data.brandNew && quiet && (
        <EmptyState sticker="wave" title={h.emptyTitle} line={h.emptyLine} action={<ButtonLink href={`/${lang}/me/events`} size="lg">{h.emptyAction}</ButtonLink>} />
      )}

      <Section title={h.nextUpTitle} id="whats-next" aside={<Link href={`/${lang}/me/events`} className={buttonClass("ghost", "md")}>{h.allEvents}</Link>}>
        {data.whatsNext.length > 0
          ? <div className="grid gap-3">{data.whatsNext.map((vm) => <EventCard key={vm.id} vm={vm} lang={lang} d={d} c={c} mode="home" />)}</div>
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
