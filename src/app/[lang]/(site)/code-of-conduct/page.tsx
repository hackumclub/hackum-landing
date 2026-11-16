import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageCircle } from "lucide-react";
import Prose from "@/components/Prose";
import lines from "@/data/conduct.json";
import { INSTAGRAM } from "@/lib/club";
import { copy } from "@/i18n/areas/public";
import { href, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/code-of-conduct">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.conduct } : {};
}

// The policy text itself is English-only for now; the Mongolian page says so above it.
export default async function Page({ params }: PageProps<"/[lang]/code-of-conduct">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = getDictionary(lang).conduct;
  const r = copy[lang].conduct;
  const pill = "inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold";
  return (
    <>
      <Prose title={c.title} note={c.note} lines={lines} />
      {/* F-10: the page used to be a dead end. A way to report a problem, and a way on. */}
      <section aria-labelledby="report-h" className="mx-auto -mt-8 max-w-3xl px-6 pb-16">
        <div className="glass grid gap-4 rounded-[22px] p-6 md:p-8">
          <h2 id="report-h" className="font-display text-xl font-extrabold">{r.contactTitle}</h2>
          <p className="text-muted">{r.contactLead}</p>
          <ul className="flex flex-wrap gap-3">
            <li><a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className={`btn-primary ${pill}`}><MessageCircle aria-hidden className="size-4" />{r.contactInstagram}</a></li>
            <li><Link href={href(lang, "/events")} className={`btn-glass-light ${pill} text-ink hover:text-brand`}><CalendarDays aria-hidden className="size-4" />{r.events}</Link></li>
          </ul>
          <p><Link href={href(lang)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-dark underline decoration-2 underline-offset-4"><ArrowLeft aria-hidden className="size-4" />{r.back}</Link></p>
        </div>
      </section>
    </>
  );
}
