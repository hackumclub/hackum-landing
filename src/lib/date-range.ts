import { previousSemester, semesterOf, semesterRange } from "@/lib/semester";

export type DateRange = { from: string; to: string };
export type RangePreset = "thisSemester" | "lastSemester" | "last30" | "thisYear";

const UB_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Today on the Ulaanbaatar calendar, "YYYY-MM-DD". */
export const ubToday = (now: Date): string => ymd(new Date(now.getTime() + UB_OFFSET_MS));

/** Inclusive UB-calendar range for a preset. last30 = today and the 29 days before it. */
export function presetRange(preset: RangePreset, now: Date): DateRange {
  const today = ubToday(now);
  switch (preset) {
    case "thisSemester": return semesterRange(semesterOf(now));
    case "lastSemester": return semesterRange(previousSemester(semesterOf(now)));
    case "last30": {
      const start = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * DAY_MS);
      return { from: ymd(start), to: today };
    }
    case "thisYear": {
      const y = today.slice(0, 4);
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** True for a real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isIsoDate(v: string): boolean {
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Longest range the analytics query accepts (mirrors the guard in `mockdb/analytics.ts`). */
export const MAX_RANGE_DAYS = 800;

/** `YYYY-MM-DD` plus `n` calendar days (negative allowed). Assumes a valid date. */
export const addDays = (iso: string, n: number): string => ymd(new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS));

/** Inclusive number of days in the range (a one-day range is 1). */
export const rangeDays = (r: DateRange): number => Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / DAY_MS) + 1;

/** The equal-length range that ends the day before `r` starts (for "vs previous period" deltas). */
export function previousRange(r: DateRange): DateRange {
  const n = rangeDays(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

type Param = string | string[] | undefined;
/**
 * Reads `?from=&to=` from untrusted URL params. Anything missing, repeated, impossible, reversed or longer than
 * MAX_RANGE_DAYS falls back to `fallback`. `custom` is true only when the URL carried a usable range that differs
 * from the fallback (so the picker knows whether to offer "reset").
 */
export function parseRangeParams(p: { from?: Param; to?: Param }, fallback: DateRange): { range: DateRange; custom: boolean } {
  const { from, to } = p;
  if (typeof from !== "string" || typeof to !== "string" || !isIsoDate(from) || !isIsoDate(to) || from > to) return { range: fallback, custom: false };
  const range = { from, to };
  if (rangeDays(range) > MAX_RANGE_DAYS) return { range: fallback, custom: false };
  return { range, custom: !(from === fallback.from && to === fallback.to) };
}
