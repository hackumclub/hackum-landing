import Link from "next/link";
import { copy } from "@/i18n/areas/me";
import { tf, type Locale } from "@/i18n/config";
import { countdown, homeData } from "@/lib/me/queries";
import { getStore } from "@/lib/mockdb/store";
import { formatUb } from "@/lib/time";
import Icon3D from "@/components/Icon3D";

/** Laptop left rail, below the nav: the person's next event (or a nudge to browse). Server component. */
export default function MeRail({ profileId, lang, now }: { profileId: string; lang: Locale; now: Date }) {
  const c = copy[lang].home;
  const next = homeData(getStore().read(), profileId, now).next;
  const card = "relative grid gap-1 overflow-hidden rounded-[var(--radius-md)] border border-line bg-panel p-4";
  // Tinted by meaning (the next event = accent), calm panel behind the text.
  const wash = { background: "radial-gradient(120% 140% at 0% 0%, var(--ops-accent-soft), var(--ops-panel) 72%)" };
  if (!next) {
    return (
      <section aria-labelledby="rail-next" className={card} style={wash}>
        <h2 id="rail-next" className="text-sm font-bold text-fg-muted">{c.nextTitle}</h2>
        <p className="text-sm font-bold text-fg">{c.nothingNextTitle}</p>
        <Link href={`/${lang}/me/events`} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-accent-fg hover:underline">{c.allEvents}</Link>
      </section>
    );
  }
  const when = countdown(next, now, lang);
  return (
    <section aria-labelledby="rail-next" className={card} style={wash}>
      <Icon3D name="calendar" sizes="64px" className="pointer-events-none absolute -top-2 -right-2 size-16 rotate-6 opacity-90" />
      <h2 id="rail-next" className="text-sm font-bold text-fg-muted">{c.nextTitle}</h2>
      <Link href={`/${lang}/events/${next.slug}`} className="pr-10 font-display text-base font-black [overflow-wrap:anywhere] text-fg hover:underline">{tf(next.title, lang)}</Link>
      <p className="text-sm font-semibold text-accent-fg">{when.text}</p>
      <p className="text-sm text-fg-muted">{formatUb(new Date(next.starts_at), lang)}{next.venue ? ` · ${next.venue}` : ""}</p>
    </section>
  );
}
