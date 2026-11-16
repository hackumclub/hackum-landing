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
