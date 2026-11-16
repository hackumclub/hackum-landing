import { fill, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { formatUb } from "@/lib/time";

/** The slice of the public event detail the fallback copy needs (`status` is the public phase label: "Ended", "Open", …). */
export type OverviewEvent = { name: string; year: string | number; mode: string; startsAt: string; approximateDate: boolean; status: string };

/**
 * Overview text for an event with no description. Past events say what happened (past tense); everything still ahead,
 * and cancelled ones, say what is planned (future tense) with the Ulaanbaatar calendar day, never "was a …" (audit F-15).
 */
export function overviewFallback(lang: Locale, e: OverviewEvent): string {
  const d = getDictionary(lang).event;
  const mode = e.mode === "Online" ? d.online : d.offline;
  if (e.status === "Ended") return fill(d.overview, { name: e.name, year: e.year, mode });
  if (e.approximateDate) return fill(d.overviewUpcomingYear, { name: e.name, mode, year: e.year });
  return fill(d.overviewUpcoming, { name: e.name, mode, date: formatUb(new Date(e.startsAt), lang, { month: "long", day: "numeric", year: "numeric" }) });
}
