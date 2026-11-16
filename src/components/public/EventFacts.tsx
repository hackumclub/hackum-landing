import { CalendarDays, Laptop, MapPin, Users, Video } from "lucide-react";
import { copy, type TicketDict } from "@/i18n/areas/public";
import type { Locale } from "@/i18n/config";
import type { EventDetail } from "@/lib/events";
import { formatUb } from "@/lib/time";

/** When / where / format / who it is for. Static (comes from the cached event), so it is part of the page's static shell. */
export default function EventFacts({ e, lang, ticket }: { e: EventDetail; lang: Locale; ticket: TicketDict }) {
  const c = copy[lang].facts;
  const start = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const day = { weekday: "long", year: "numeric", month: "long", day: "numeric" } as const;
  const clock = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
  const sameDay = formatUb(start, lang, day) === formatUb(end, lang, day);
  const when = e.approximateDate
    ? formatUb(start, lang, { year: "numeric", month: "long" })
    : `${formatUb(start, lang, day)}, ${formatUb(start, lang, clock)}–${sameDay ? formatUb(end, lang, clock) : formatUb(end, lang, { month: "short", day: "numeric", ...clock })}`;
  const where = [e.venue, e.address].filter(Boolean).join(", ") || (e.mode === "Online" ? c.online : "");
  const Mode = e.mode === "Online" ? Video : e.mode === "Offline" ? Users : Laptop;
  // <dl> children must be <div><dt/><dd/></div> only, so the icon bubble lives inside the <dt> (absolutely placed in the row's left gutter).
  const row = "relative min-h-11 pl-14";
  const bubble = "absolute top-0 left-0 grid size-11 place-items-center rounded-full bg-gradient-to-b from-white to-brand-tint text-brand-deep shadow-[inset_0_1px_0_#fff,0_8px_18px_-10px_rgb(0_91_140/0.6)] ring-1 ring-white";
  return (
    <section aria-labelledby="event-facts" className="min-w-0">
      <h2 id="event-facts" className="font-display text-lg font-black">{c.title}</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <div className={row}><dt className="text-faint"><span aria-hidden className={bubble}><CalendarDays className="size-5" /></span>{c.when}</dt><dd className="font-bold">{when}{e.approximateDate ? <span className="block font-normal text-muted">{c.tbc}</span> : null}</dd></div>
        {where ? <div className={row}><dt className="text-faint"><span aria-hidden className={bubble}><MapPin className="size-5" /></span>{c.where}</dt><dd className="font-bold [overflow-wrap:anywhere]">{where}</dd></div> : null}
        <div className={row}>
          <dt className="text-faint"><span aria-hidden className={bubble}><Mode className="size-5" /></span>{c.format}</dt>
          <dd className="font-bold">{ticket.modes[e.mode] ?? e.mode}{e.mode !== "Offline" ? <span className="block font-normal text-muted">{c.onlineNote}</span> : null}</dd>
        </div>
      </dl>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-bold text-brand-deep"><Users aria-hidden className="size-3.5" />{c.audience[e.audience]}</p>
    </section>
  );
}
