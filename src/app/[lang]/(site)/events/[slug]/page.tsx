import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENTS, findEvent } from "@/lib/events";
import { fill, href, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import EventTicket from "@/components/EventTicket";
import EventTabs from "@/components/EventTabs";

// Unknown slugs never reach this page: proxy.ts rewrites them to the 404 route so the status code is a real 404.
export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const e = findEvent(slug);
  return isLocale(lang) && e ? { title: e.name[lang], description: e.tagline[lang] } : {};
}

export default function Page({ params }: PageProps<"/[lang]/events/[slug]">) {
  return <Suspense fallback={<div className="min-h-[60vh]" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: Pick<PageProps<"/[lang]/events/[slug]">, "params">) {
  const { lang, slug } = await params;
  const e = findEvent(slug);
  if (!isLocale(lang) || !e) notFound();
  const d = getDictionary(lang);
  const vars = { name: e.name[lang], year: e.year, mode: e.mode === "Online" ? d.event.online : d.event.offline };
  return (
    <div className="pb-16">
      <div className="mx-auto max-w-[1000px] px-6 pt-10">
        <Link href={href(lang, "/events")} className="text-sm font-bold text-brand">← {d.event.back}</Link>
        <h1 className="sr-only">{e.name[lang]}</h1>
        <div className="mt-16"><EventTicket e={e} lang={lang} dict={d.ticket} size="hero" /></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {e.participants ? <p className="font-bold">{fill(d.event.participants, { n: e.participants })}</p> : <span />}
          <a href={e.url} target="_blank" rel="noopener noreferrer" data-cursor-magnetic className="rounded-full bg-brand px-7 py-3.5 font-bold text-white shadow-glow hover:bg-brand-dark">{d.event.view}</a>
        </div>
        <div className="glass mt-10 rounded-[22px] p-6 md:p-8">
          <EventTabs
            labels={d.event.tabs}
            panels={[
              <div key="o" className="space-y-3 text-muted"><p>{e.tagline[lang]}</p><p>{fill(d.event.overview, vars)}</p><p><a className="font-bold text-brand" href={e.url} target="_blank" rel="noopener noreferrer">@hackumclub</a></p></div>,
              <p key="p" className="text-muted">{d.event.prizes}</p>,
              <p key="s" className="text-muted">{fill(d.event.schedule, vars)}</p>,
            ]}
          />
        </div>
      </div>
    </div>
  );
}
