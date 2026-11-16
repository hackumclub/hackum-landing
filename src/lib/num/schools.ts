import type { L } from "@/i18n/config";

/** МУИС (National University of Mongolia) is the only school whose students can become members. */
export type SchoolId = "num" | "must" | "ufe" | "mnums" | "other";
export type MajorTrack = "software" | "cs" | "is" | "it" | "other";

export const SCHOOLS: { id: SchoolId; name: L }[] = [
  { id: "num", name: { mn: "МУИС", en: "NUM (National University of Mongolia)" } },
  { id: "must", name: { mn: "ШУТИС", en: "MUST" } },
  { id: "ufe", name: { mn: "Санхүү, эдийн засгийн их сургууль", en: "University of Finance and Economics" } },
  { id: "mnums", name: { mn: "Анагаахын шинжлэх ухааны үндэсний их сургууль", en: "MNUMS" } },
  { id: "other", name: { mn: "Өөр сургууль", en: "Another school" } },
];
export const SCHOOL_IDS = SCHOOLS.map((s) => s.id) as SchoolId[];
export const MAJOR_TRACKS: { id: MajorTrack; name: L }[] = [
  { id: "software", name: { mn: "Программ хангамж", en: "Software engineering" } },
  { id: "cs", name: { mn: "Компьютерын ухаан", en: "Computer science" } },
  { id: "is", name: { mn: "Мэдээллийн систем", en: "Information systems" } },
  { id: "it", name: { mn: "Мэдээллийн технологи", en: "Information technology" } },
  { id: "other", name: { mn: "Бусад", en: "Other" } },
];
export const MAJOR_TRACK_IDS = MAJOR_TRACKS.map((t) => t.id) as MajorTrack[];
export const isSchoolId = (v: unknown): v is SchoolId => typeof v === "string" && (SCHOOL_IDS as string[]).includes(v);
export const isMajorTrack = (v: unknown): v is MajorTrack => typeof v === "string" && (MAJOR_TRACK_IDS as string[]).includes(v);
