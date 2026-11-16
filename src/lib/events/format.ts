import { tf, type Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import type { EventRow } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";
import { formatUb } from "@/lib/time";

/** One answer as plain text in the active language: select/multi store option *indexes*, so resolve them to labels. */
export function answerText(q: Question, value: Answers[string] | undefined, lang: Locale, yesNo: { yes: string; no: string }): string {
  if (value === undefined || value === null) return "";
  if (q.type === "checkbox") return value === true ? yesNo.yes : value === false ? yesNo.no : "";
  const options = q.options ?? [];
  const label = (i: string) => {
    const o = options[Number(i)];
    return o ? tf(o, lang) : "";
  };
  if (q.type === "select") return typeof value === "string" ? label(value) : "";
  if (q.type === "multi") return Array.isArray(value) ? value.map(label).filter(Boolean).join("; ") : "";
  return typeof value === "string" ? value : "";
}

/** A published event that is happening right now reads "live" (derived, never stored). */
export function displayStatus(e: Pick<EventRow, "status" | "starts_at" | "ends_at">, now: Date): Status {
  return e.status === "published" && new Date(e.starts_at) <= now && now < new Date(e.ends_at) ? "live" : e.status;
}

/** "Mon, Dec 1, 6:00 PM" for the start; legacy rows with a year-only date show just the month and year. */
export function eventWhen(e: Pick<EventRow, "starts_at" | "approximate_date">, lang: Locale): string {
  const d = new Date(e.starts_at);
  return e.approximate_date
    ? formatUb(d, lang, { year: "numeric", month: "short" })
    : formatUb(d, lang, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Start–end on one line: the end repeats the date only when it is a different UB day. */
export function eventRange(e: Pick<EventRow, "starts_at" | "ends_at">, lang: Locale): string {
  const s = new Date(e.starts_at), en = new Date(e.ends_at);
  const day = (d: Date) => formatUb(d, lang, { year: "numeric", month: "numeric", day: "numeric" });
  const time = (d: Date) => formatUb(d, lang, { hour: "2-digit", minute: "2-digit" });
  const start = formatUb(s, lang, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return day(s) === day(en) ? `${start} – ${time(en)}` : `${start} – ${formatUb(en, lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}
