import type { Locale } from "@/i18n/config";
import { ubToday } from "@/lib/date-range";

/** Pure calendar arithmetic on UB calendar days ("YYYY-MM-DD"); no time zone, no Intl, so Node and browsers agree. */
export type Iso = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const DAY = 86_400_000;
const utc = (iso: Iso) => Date.parse(`${iso}T00:00:00Z`);
const fromUtc = (ms: number): Iso => new Date(ms).toISOString().slice(0, 10);

/** True for a real calendar day ("2026-02-30" is not one). */
export function isIso(v: string): v is Iso {
  const m = ISO.exec(v);
  if (!m) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && fromUtc(d.getTime()) === v;
}

export const addDays = (iso: Iso, n: number): Iso => fromUtc(utc(iso) + n * DAY);

/** Same day number n months away, clamped to the end of a shorter month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: Iso, n: number): Iso {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1, d = Number(iso.slice(8, 10));
  const idx = y * 12 + m + n;
  const ny = Math.floor(idx / 12), nm = ((idx % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${pad(ny, 4)}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

/** Monday = 0 … Sunday = 6. */
export const weekday = (iso: Iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
export const startOfWeek = (iso: Iso) => addDays(iso, -weekday(iso));
export const endOfWeek = (iso: Iso) => addDays(iso, 6 - weekday(iso));
export const startOfMonth = (iso: Iso): Iso => `${iso.slice(0, 7)}-01`;
export const endOfMonth = (iso: Iso): Iso => { const f = startOfMonth(iso); return addDays(addMonths(f, 1), -1); };

/** Weeks (Monday first) covering a month; days outside the month are `null`. */
export function monthWeeks(iso: Iso): (Iso | null)[][] {
  const first = startOfMonth(iso), last = endOfMonth(iso);
  const weeks: (Iso | null)[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i); return d >= first && d <= last ? d : null; }));
  }
  return weeks;
}

export const clampIso = (iso: Iso, min?: Iso, max?: Iso): Iso => (min && iso < min ? min : max && iso > max ? max : iso);
export const isBetween = (iso: Iso, a: Iso | null, b: Iso | null) => !!a && !!b && iso >= (a < b ? a : b) && iso <= (a < b ? b : a);

/** Today on the UB calendar. */
export const todayIso = (now: Date = new Date()): Iso => ubToday(now);

const MONTHS: Record<Locale, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  mn: Array.from({ length: 12 }, (_, i) => `${i + 1}-р сар`),
};
const WEEKDAYS: Record<Locale, string[]> = {
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  mn: ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"],
};
const WEEKDAYS_LONG: Record<Locale, string[]> = {
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  mn: ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"],
};
export const weekdayShort = (lang: Locale) => WEEKDAYS[lang];
export const weekdayLong = (lang: Locale) => WEEKDAYS_LONG[lang];
export const monthTitle = (iso: Iso, lang: Locale) => {
  const y = iso.slice(0, 4), m = Number(iso.slice(5, 7)) - 1;
  return lang === "mn" ? `${y} оны ${MONTHS.mn[m]}` : `${MONTHS.en[m]} ${y}`;
};
/** "Mon, Nov 16, 2026" / "2026 оны 11-р сарын 16, Даваа": the accessible name of a day cell. */
export function dayName(iso: Iso, lang: Locale) {
  const m = Number(iso.slice(5, 7)) - 1, d = Number(iso.slice(8, 10)), y = iso.slice(0, 4);
  const wd = WEEKDAYS_LONG[lang][weekday(iso)];
  return lang === "mn" ? `${y} оны ${m + 1}-р сарын ${d}, ${wd}` : `${wd}, ${MONTHS.en[m]} ${d}, ${y}`;
}
/** Short display of a chosen day on a trigger. */
export function dayLabel(iso: Iso, lang: Locale) {
  const m = Number(iso.slice(5, 7)) - 1, d = Number(iso.slice(8, 10)), y = iso.slice(0, 4);
  return lang === "mn" ? `${y}.${pad(m + 1)}.${pad(d)}` : `${MONTHS.en[m].slice(0, 3)} ${d}, ${y}`;
}

/** "HH:mm" → minutes since midnight, or null. Accepts "9:30", "0930", "930" while typing. */
export function parseTime(v: string): string | null {
  const t = v.trim();
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}
export function shiftTime(v: string, minutes: number): string {
  const [h, m] = v.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
