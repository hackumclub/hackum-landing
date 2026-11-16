import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEvent, getPublicSlugs } from "@/lib/public/readers";
import { copy, ticketDict } from "@/i18n/areas/public";
import { fill, href, isLocale } from "@/i18n/config";
import { overviewFallback } from "@/lib/events/overview";
import { getDictionary } from "@/i18n";
import EventTicket from "@/components/EventTicket";
import EventTabs from "@/components/EventTabs";
import EventFacts from "@/components/public/EventFacts";
import LiveRefresh from "@/components/live/LiveRefresh";
import RsvpSection from "@/components/public/RsvpSection";
import RsvpSkeleton from "@/components/public/RsvpSkeleton";

// Only published/completed/archived events are prerendered; any other slug is rendered on demand and 404s below.
export async function generateStaticParams() {
  const slugs = await getPublicSlugs();
  // Cache Components needs at least one sample param to validate the route.
  return (slugs.length ? slugs : ["knowledge-day-rag"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const e = await getPublicEvent(slug);
  return isLocale(lang) && e ? { title: e.name[lang], description: e.tagline[lang] } : {};
}

// A real HTTP 404 for unknown slugs needs the lookup before the response streams, so this route is allowed to block
// (it is still prerendered for every published slug; only unknown slugs render on demand).
export const instant = false;

// `params` and the event are awaited here, outside any <Suspense>: notFound() therefore runs before the response starts
// streaming and is a real HTTP 404 (inside a boundary it would stream a 200 "soft 404"). Only the per-person
// registration panel is request-time, behind its own boundary.
export default async function Page({ params }: PageProps<"/[lang]/events/[slug]">) {
  const { lang, slug } = await params;
  const e = isLocale(lang) ? await getPublicEvent(slug) : null;
  if (!isLocale(lang) || !e) notFound();
  const d = getDictionary(lang);
  const c = copy[lang];
  const ticket = ticketDict(lang, d.ticket);
  const vars = { name: e.name[lang], year: e.year, mode: e.mode === "Online" ? d.event.online : d.event.offline };
  const description = e.description[lang].trim();
  // Past events keep the original page; the facts + registration card is for everything still ahead (or cancelled).
  const showCard = e.status !== "Ended";
  return (
    <div className="pb-16">
      <div className="relative mx-auto max-w-[1000px] px-6 pt-10">
        <div className="flex items-center justify-between gap-4">
          <Link href={href(lang, "/events")} className="text-sm font-bold text-brand-dark">← {d.event.back}</Link>
          {showCard ? <LiveRefresh /> : null}
        </div>
        <div className="mt-16"><EventTicket e={e} lang={lang} dict={ticket} size="hero" /></div>
        {e.participants || e.url ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {e.participants ? <p className="font-bold">{fill(d.event.participants, { n: e.participants })}</p> : <span />}
            {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" data-cursor-magnetic className="rounded-full bg-brand px-7 py-3.5 font-bold text-white shadow-glow hover:bg-brand-dark">{d.event.view}</a> : null}
          </div>
        ) : null}
        {showCard ? (
          <div className="glass mt-10 grid gap-8 rounded-[22px] p-6 md:grid-cols-[1fr_minmax(0,380px)] md:gap-12 md:p-8">
            <EventFacts e={e} lang={lang} ticket={ticket} />
            <Suspense fallback={<RsvpSkeleton label={c.rsvp.loading} />}><RsvpSection slug={e.slug} lang={lang} /></Suspense>
          </div>
        ) : null}
        <div className="glass mt-10 rounded-[22px] p-6 md:p-8">
          <EventTabs
            labels={d.event.tabs}
            panels={[
              <div key="o" className="space-y-3 text-muted"><p>{e.tagline[lang]}</p><p className="whitespace-pre-line">{description || overviewFallback(lang, { name: e.name[lang], year: e.year, mode: e.mode, startsAt: e.startsAt, approximateDate: e.approximateDate, status: e.status })}</p><p><a className="font-bold text-brand" href="https://www.instagram.com/hackumclub/" target="_blank" rel="noopener noreferrer">@hackumclub</a></p></div>,
              <p key="p" className="text-muted">{d.event.prizes}</p>,
              <p key="s" className="text-muted">{fill(d.event.schedule, vars)}</p>,
            ]}
          />
        </div>
      </div>
    </div>
  );
}
