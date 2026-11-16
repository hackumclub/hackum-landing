import Link from "next/link";
import Sticker from "./Sticker";
import TiltCard from "./motion/TiltCard";
import type { Event } from "@/lib/events";
import { href, type Locale } from "@/i18n/config";
import type { TicketDict } from "@/i18n/areas/public";

/**
 * Typographic event preview (no photo): name, tagline and a perforated stub with year and format.
 * `size="hero"` is the header of an event page; the default is a list card linking to it.
 */
export default function EventTicket({ e, lang, dict, size = "card", tilt = 0 }: { e: Event; lang: Locale; dict: TicketDict; size?: "card" | "hero"; tilt?: number }) {
  const hero = size === "hero";
  const Title = hero ? "h1" : "h3"; // the event page's own heading is the hero title; list cards sit under a section heading
  const kind = e.themes.map((x) => dict.kinds[x] ?? x).join(" · ");
  const body = (
    <div className={`relative flex overflow-visible rounded-[22px] bg-paper text-ink shadow-card transition-shadow duration-300 group-hover:shadow-[0_24px_50px_-18px_rgb(0_91_140/0.45)] ${hero ? "min-h-[300px]" : "min-h-[220px]"}`}>
      <div className={`relative flex flex-1 flex-col justify-between ${hero ? "p-6 md:p-12" : "p-6"}`}>
        {hero ? <span aria-hidden className="pointer-events-none absolute -top-4 right-3 font-display text-[140px] font-black leading-none tracking-tight text-fur md:-top-8 md:text-[200px]">{e.year}</span> : null}
        <p className="relative text-sm font-bold text-brand-dark">{kind}</p>
        <div className="relative">
          <Title className={`font-display font-black leading-[1.05] [overflow-wrap:anywhere] ${hero ? "pt-10 text-3xl md:pt-0 md:text-6xl" : e.name[lang].length > 24 ? "text-[22px]" : "text-[28px]"}`}>{e.name[lang]}</Title>
          <p className={`mt-2 max-w-md text-muted ${hero ? "text-lg" : "text-sm"}`}>{e.tagline[lang]}</p>
          {hero && (
            <p className="mt-4 flex flex-wrap gap-2 text-xs font-bold md:hidden">
              <span className="rounded-full bg-fur px-3 py-1.5 text-ink">{dict.modes[e.mode] ?? e.mode}</span>
              <span className="rounded-full bg-brand-tint px-3 py-1.5 text-brand-deep">{e.status === "Ended" ? dict.done : dict.statuses[e.status] ?? e.status}</span>
            </p>
          )}
        </div>
      </div>
      <div aria-hidden className={`perforation w-4 shrink-0 bg-paper ${hero ? "hidden md:block" : ""}`} />
      <div className={`shrink-0 flex-col justify-between border-l-2 border-dashed border-fur ${hero ? "hidden w-52 p-6 md:flex" : "flex w-28 p-4"}`}>
        <dl className="space-y-3 text-xs">
          {hero ? null : <div><dt className="sr-only">{dict.year}</dt><dd className="font-display text-3xl font-black leading-none">{e.year}</dd></div>}
          <div><dt className="text-faint">{dict.mode}</dt><dd className="font-bold">{dict.modes[e.mode] ?? e.mode}</dd></div>
        </dl>
        <span className="self-start rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand-deep">{e.status === "Ended" ? dict.done : dict.statuses[e.status] ?? e.status}</span>
      </div>
      <Sticker
        name={e.sticker}
        sizes={hero ? "176px" : "96px"}
        className={`absolute transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-3 ${hero ? "-top-12 right-4 w-24 md:-top-14 md:right-52 md:w-44" : "-top-10 right-24 w-24"}`}
      />
    </div>
  );
  if (hero) return body;
  return (
    <Link href={href(lang, `/events/${e.slug}`)} aria-label={`${e.name[lang]}, ${e.year}`} data-cursor="open" className="group block rounded-[22px] pt-10" style={{ rotate: `${tilt}deg` }}>
      <TiltCard className="rounded-[22px]">{body}</TiltCard>
    </Link>
  );
}
