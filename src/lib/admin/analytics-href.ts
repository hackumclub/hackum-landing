import type { Locale } from "@/i18n/config";
import type { DateRange } from "@/lib/date-range";

export const TABS = ["overview", "events", "members", "semesters"] as const;
export type Tab = (typeof TABS)[number];
export const parseTab = (v: string | string[] | undefined): Tab => (TABS as readonly string[]).includes(v as string) ? (v as Tab) : "overview";

/** Analytics URL that keeps the range and tab, omitting what equals the default so links stay short. */
export function analyticsHref(lang: Locale, o: { tab?: Tab; range?: DateRange | null }): string {
  const q = new URLSearchParams();
  if (o.tab && o.tab !== "overview") q.set("tab", o.tab);
  if (o.range) { q.set("from", o.range.from); q.set("to", o.range.to); }
  const s = q.toString();
  return `/${lang}/admin/analytics${s ? `?${s}` : ""}`;
}
