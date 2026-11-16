import type { NumProgram } from "@/lib/num/programs";

/** Small, hand-written program list: enough to exercise ranking, levels, diacritics and tracks. */
export const PROGRAMS_FIXTURE: NumProgram[] = [
  { index: "D 061301", name: { mn: "Компьютерын ухаан", en: "Computer science" }, level: "bachelor", unit: "ХШУИС", track: "cs" },
  { index: "D 061302", name: { mn: "Программ хангамж", en: "Software engineering" }, level: "bachelor", unit: "ХШУИС", track: "software" },
  { index: "D 061303", name: { mn: "Мэдээллийн систем", en: "Information systems" }, level: "bachelor", unit: "ХШУИС", track: "is" },
  { index: "D 011403", name: { mn: "Багш, мэдээлэл зүйн боловсрол", en: "Teacher training - Information technology" }, level: "bachelor", unit: "Боловсролын сургууль", track: "other" },
  { index: "D 052001", name: { mn: "Өгөгдлийн шинжилгээ", en: "Computational data analysis" }, level: "bachelor", unit: "ШУС", track: "other" },
  { index: "E 061301", name: { mn: "Компьютерын ухаан", en: "Computer science" }, level: "master", unit: "ХШУИС", track: "cs" },
  { index: "E 061302", name: { mn: "Программ хангамж", en: "Software engineering" }, level: "master", unit: "ХШУИС", track: "software" },
  { index: "F 061301", name: { mn: "Компьютерын ухаан", en: "Computer science" }, level: "doctor", unit: "ХШУИС", track: "cs" },
];
