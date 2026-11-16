import type { Locale } from "@/i18n/config";
import { tf } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import { answerText } from "@/lib/events/format";
import { toUbInput } from "@/lib/time";

/** UTF-8 byte-order mark: without it Excel opens the file as Windows-1252 and Cyrillic turns into mojibake. */
export const BOM = "﻿";

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One RFC 4180 field. Cells that a spreadsheet would run as a formula (= + - @, or a leading tab/CR) get an
 * apostrophe prefix (OWASP CSV-injection guidance): applicants type these values, staff open the file in Excel.
 */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows → CSV text: BOM first, CRLF after every record (RFC 4180). */
export const toCsv = (rows: string[][]): string => BOM + rows.map((r) => `${r.map(csvCell).join(",")}\r\n`).join("");

export type CsvRegistration = {
  name: string;
  school: string | null;
  /** Already localised ("Going", "Ирнэ"). */
  status: string;
  team: string | null;
  createdAt: string; // ISO
  answers: Answers;
};
export type CsvLabels = { name: string; school: string; status: string; team: string; applied: string; yes: string; no: string };

/** Fixed columns, then one column per question (header = the question label in `lang`, Mongolian when untranslated). */
export function registrationsCsv({ questions, rows, lang, labels }: { questions: Question[]; rows: CsvRegistration[]; lang: Locale; labels: CsvLabels }): string {
  const header = [labels.name, labels.school, labels.status, labels.team, labels.applied, ...questions.map((q) => tf(q.label, lang))];
  const yesNo = { yes: labels.yes, no: labels.no };
  const body = rows.map((r) => [
    r.name, r.school ?? "", r.status, r.team ?? "", toUbInput(new Date(r.createdAt)).replace("T", " "),
    ...questions.map((q) => answerText(q, r.answers[q.id], lang, yesNo)),
  ]);
  return toCsv([header, ...body]);
}
