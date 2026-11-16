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
