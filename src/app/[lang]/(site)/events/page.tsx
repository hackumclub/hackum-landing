import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvents } from "@/lib/public/readers";
import { copy, ticketDict } from "@/i18n/areas/public";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import EventSearch from "@/components/EventSearch";
import LiveRefresh from "@/components/live/LiveRefresh";
import Sticker from "@/components/Sticker";

export async function generateMetadata({ params }: PageProps<"/[lang]/events">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.events } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/events">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const c = copy[lang];
  const { data: events, failed } = await getPublicEvents();
  return (
    <>
      <LiveRefresh />
      {events.length === 0 ? (
        <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-6 pb-16 pt-14">
          <h1 className="font-display text-[clamp(40px,6vw,72px)] font-black leading-none">{d.events.title}</h1>
          <Sticker name="grumpy" sizes="112px" className="mt-6 w-28" />
          <p className="text-lg font-bold">{failed ? c.empty.eventsTitle : c.empty.noEvents}</p>
          {failed ? <p className="max-w-lg text-muted">{c.empty.eventsLine}</p> : null}
        </div>
      ) : (
        <EventSearch items={events} lang={lang} dict={d.events} ticket={ticketDict(lang, d.ticket)} />
      )}
    </>
  );
}
