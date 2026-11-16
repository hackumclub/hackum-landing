import type { Locale } from "@/i18n/config";

/** The club runs on Ulaanbaatar time: UTC+8 all year (Mongolia has no DST since 2017). */
export const UB_TZ = "Asia/Ulaanbaatar";
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `datetime-local` value ("YYYY-MM-DDTHH:mm") read as UB wall-clock time → the UTC instant. Null if malformed or impossible. */
export function fromUbInput(value: string): Date | null {
  const m = LOCAL_INPUT.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const w = new Date(wall);
  // Date.UTC silently rolls over (month 13 → next year); reject anything that didn't round-trip.
  if (w.getUTCFullYear() !== y || w.getUTCMonth() !== mo - 1 || w.getUTCDate() !== d || w.getUTCHours() !== h || w.getUTCMinutes() !== mi) return null;
  return new Date(wall - UB_OFFSET_MS);
}

/** A UTC instant → the UB wall-clock string a `datetime-local` input expects. */
export const toUbInput = (d: Date) => new Date(d.getTime() + UB_OFFSET_MS).toISOString().slice(0, 16);

/** Human date/time in UB time, e.g. "Dec 1, 6:00 PM" / "12-р сарын 1, 18:00". */
export function formatUb(d: Date, lang: Locale, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) {
  return new Intl.DateTimeFormat(lang === "mn" ? "mn-MN" : "en-US", { timeZone: UB_TZ, ...opts }).format(d);
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_EN_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAYS_MN = ["Ням гараг", "Даваа гараг", "Мягмар гараг", "Лхагва гараг", "Пүрэв гараг", "Баасан гараг", "Бямба гараг"] as const;

export type StableDateKind = "date" | "short" | "time" | "datetime" | "datetimeShort" | "dayLong" | "monthYear";

/**
 * Date text in UB time that is byte-identical in Node and in every browser. `Intl` output for `mn-MN` (and for
 * `dateStyle`/`timeStyle`) depends on the ICU build, so server-rendered text and the browser's first render disagreed
 * and React reported a hydration mismatch. Everything here is plain arithmetic plus fixed month and weekday names.
 */
export function formatUbStable(d: Date, lang: Locale, kind: StableDateKind = "date"): string {
  if (Number.isNaN(d.getTime())) return "";
  const ub = new Date(d.getTime() + UB_OFFSET_MS);
  const y = ub.getUTCFullYear(), m = ub.getUTCMonth(), day = ub.getUTCDate(), h = ub.getUTCHours(), min = String(ub.getUTCMinutes()).padStart(2, "0");
  const wd = ub.getUTCDay();
  const mn = lang === "mn";
  const time = mn ? `${String(h).padStart(2, "0")}:${min}` : `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? "AM" : "PM"}`;
  const short = mn ? `${m + 1}-р сарын ${day}` : `${MONTHS_EN[m]} ${day}`;
  const date = mn ? `${y} оны ${short}` : `${short}, ${y}`;
  switch (kind) {
    case "date": return date;
    case "short": return short;
    case "time": return time;
    case "datetime": return `${date}, ${time}`;
    case "datetimeShort": return `${short}, ${time}`;
    case "monthYear": return mn ? `${y} оны ${m + 1}-р сар` : `${MONTHS_EN[m]} ${y}`;
    case "dayLong": return mn ? `${short}, ${WEEKDAYS_MN[wd]}` : `${WEEKDAYS_EN[wd]}, ${MONTHS_EN_LONG[m]} ${day}`;
  }
}
