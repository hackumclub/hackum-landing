import type { Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import { toUbInput } from "@/lib/time";
import type { FormResponse } from "@/lib/mockdb/forms";

const HEAD = { en: { name: "Name", at: "Submitted", status: "Status", gone: "Removed question", yes: "Yes", no: "No" }, mn: { name: "Нэр", at: "Илгээсэн", status: "Төлөв", gone: "Устгасан асуулт", yes: "Тийм", no: "Үгүй" } } as const;
const lab = (l: { mn: string; en: string }, lang: Locale) => (lang === "en" && l.en.trim() ? l.en : l.mn);

/** Spreadsheets run cells that start with = + - @ (or tab / CR) as formulas: a leading apostrophe keeps them text. */
const FORMULA_START = /^[=+\-@\t\r]/;
function cell(v: string): string {
  const s = FORMULA_START.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function answerText(q: Question, a: Answers[string] | undefined, lang: Locale): string {
  if (a === undefined) return "";
  const option = (i: string) => { const o = q.options?.[Number(i)]; return o ? lab(o, lang) : i; };
  if (q.type === "checkbox") return a === true ? HEAD[lang].yes : HEAD[lang].no;
  if (q.type === "select" && typeof a === "string") return option(a);
  if (q.type === "multi" && Array.isArray(a)) return a.map(option).join("; ");
  return Array.isArray(a) ? a.join("; ") : String(a);
}

/** Staff export of one form's responses: UTF-8 with BOM (Excel), CRLF, RFC 4180 quoting, formula-safe. No emails. */
export function responsesToCsv(questions: Question[], rows: FormResponse[], lang: Locale, orphans: string[] = []): string {
  const h = HEAD[lang];
  const known = new Set(questions.map((q) => q.id));
  const gone = [...orphans];
  for (const r of rows) for (const k of Object.keys(r.answers)) if (!known.has(k) && !gone.includes(k)) gone.push(k);
  const header = [h.name, h.at, h.status, ...questions.map((q) => lab(q.label, lang)), ...gone.map((k) => `${h.gone}: ${k}`)];
  const lines = rows.map((r) => [
    lab(r.name, lang) || r.profile_id, toUbInput(new Date(r.submitted_at)).replace("T", " "), r.status,
    ...questions.map((q) => answerText(q, r.answers[q.id], lang)),
    ...gone.map((k) => (r.answers[k] === undefined ? "" : Array.isArray(r.answers[k]) ? (r.answers[k] as string[]).join("; ") : String(r.answers[k]))),
  ]);
  return `﻿${[header, ...lines].map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`;
}
