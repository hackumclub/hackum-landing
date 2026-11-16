import type { Locale } from "@/i18n/config";

/**
 * The club runs two semesters a year. Academic year Y starts in September of Y: Sep–Dec is autumn of Y, Jan–Aug is
 * spring of the academic year that began the previous September. Always read on the Ulaanbaatar wall clock (UTC+8).
 */
export type Term = "autumn" | "spring";
export type Semester = { year: number; term: Term };

const UB_OFFSET_MS = 8 * 3_600_000;
export const isTerm = (v: unknown): v is Term => v === "autumn" || v === "spring";

export function semesterOf(at: Date): Semester {
  const ub = new Date(at.getTime() + UB_OFFSET_MS);
  const year = ub.getUTCFullYear();
  return ub.getUTCMonth() >= 8 ? { year, term: "autumn" } : { year: year - 1, term: "spring" };
}

export const previousSemester = (s: Semester): Semester => (s.term === "spring" ? { year: s.year, term: "autumn" } : { year: s.year - 1, term: "spring" });

/** UB calendar dates (inclusive) that bound the semester. */
export function semesterRange(s: Semester): { from: string; to: string } {
  return s.term === "autumn" ? { from: `${s.year}-09-01`, to: `${s.year}-12-31` } : { from: `${s.year + 1}-01-01`, to: `${s.year + 1}-08-31` };
}

export function semesterLabel(s: Semester, lang: Locale): string {
  const calendarYear = s.term === "spring" ? s.year + 1 : s.year;
  if (lang === "mn") return `${calendarYear} оны ${s.term === "autumn" ? "намар" : "хавар"}`;
  return `${s.term === "autumn" ? "Autumn" : "Spring"} ${calendarYear}`;
}
