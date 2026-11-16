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
  const row = "grid gap-0.5";
  return (
    <section aria-labelledby="event-facts">
      <h2 id="event-facts" className="font-display text-lg font-black">{c.title}</h2>
      <dl className="mt-4 space-y-4 text-sm">
        <div className={row}><dt className="text-faint">{c.when}</dt><dd className="font-bold">{when}{e.approximateDate ? <span className="block font-normal text-muted">{c.tbc}</span> : null}</dd></div>
        {where ? <div className={row}><dt className="text-faint">{c.where}</dt><dd className="font-bold">{where}</dd></div> : null}
        <div className={row}>
          <dt className="text-faint">{c.format}</dt>
          <dd className="font-bold">{ticket.modes[e.mode] ?? e.mode}{e.mode !== "Offline" ? <span className="block font-normal text-muted">{c.onlineNote}</span> : null}</dd>
        </div>
      </dl>
      <p className="mt-4 inline-flex rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-deep">{c.audience[e.audience]}</p>
    </section>
  );
}
