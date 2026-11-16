import Link from "next/link";
import { CalendarClock, ExternalLink, MapPin, Users } from "lucide-react";
import { fill, href, tf, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import type { FormState } from "@/lib/events/admin-form";
import { formatUb } from "@/lib/time";
import { buttonClass } from "@/components/ui/Button";

/** Compact "how it looks publicly" card for the form: date tile, title, tagline, venue, seats. Updates as you type. */
export default function EventPreview({ lang, state, publicSlug, isDraft }: { lang: Locale; state: FormState; publicSlug: string | null; isDraft: boolean }) {
  const t = copy[lang].preview;
  const d = getDictionary(lang);
  const title = tf(state.title, lang).trim() || t.untitled;
  const tagline = tf(state.tagline, lang).trim();
  const where = state.mode === "online" ? t.online : state.venue_name.trim() || (state.mode === "hybrid" ? t.online : t.noVenue);
  const seats = state.unlimited ? t.unlimited : state.capacity.trim() ? fill(t.seats, { n: state.capacity.trim() }) : t.unlimited;
  const start = state.starts_at;
  return (
    <aside aria-labelledby="preview-title" className="grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 xl:sticky xl:top-20">
      <h2 id="preview-title" className="font-display text-base font-bold text-fg">{t.title}</h2>
      <div className="flex gap-3">
        <div className="grid h-14 w-16 shrink-0 content-center rounded-[var(--radius-sm)] bg-panel-2 text-center leading-tight">
          <span className="text-xs font-semibold whitespace-nowrap text-fg-muted">{start ? formatUb(start, lang, { month: "short" }) : "—"}</span>
          <span className="tnum font-display text-xl font-bold text-fg">{start ? formatUb(start, lang, { day: "numeric" }) : "—"}</span>
        </div>
        <div className="grid min-w-0 gap-1">
          <p className="text-xs font-semibold text-accent-fg">{d.admin.kinds[state.kind]}</p>
          <p className="font-bold break-words text-fg">{title}</p>
          {tagline && <p className="text-sm break-words text-fg-muted">{tagline}</p>}
        </div>
      </div>
      <ul className="grid gap-1.5 text-sm text-fg">
        <li className="flex items-center gap-2"><CalendarClock aria-hidden="true" size={16} className="shrink-0 text-fg-muted" />{start ? formatUb(start, lang, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</li>
        <li className="flex items-center gap-2"><MapPin aria-hidden="true" size={16} className="shrink-0 text-fg-muted" /><span className="min-w-0 break-words">{where}</span></li>
        <li className="flex items-center gap-2"><Users aria-hidden="true" size={16} className="shrink-0 text-fg-muted" />{seats}{state.reg_mode === "application" && ` · ${t.application}`}</li>
      </ul>
      {isDraft && <p className="text-xs text-fg-muted">{t.draft}</p>}
      {publicSlug ? (
        <Link href={href(lang, `/events/${publicSlug}`)} className={buttonClass("secondary", "md", "w-full")} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" size={16} />{t.viewPublic}
        </Link>
      ) : (
        <span aria-disabled="true" className={buttonClass("secondary", "md", "w-full")}><ExternalLink aria-hidden="true" size={16} />{t.viewPublic}</span>
      )}
    </aside>
  );
}
