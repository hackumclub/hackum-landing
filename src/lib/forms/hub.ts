// Pure helpers for the admin forms hub (no React, no server-only imports).
import { tf, type L, type Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import type { FormId, FormKind, FormSummary } from "@/lib/mockdb/forms";

const FORM_ID = /^(?:membership_application|join|event:[A-Za-z0-9_-]{1,64})$/;
export const FORM_TABS = ["all", "event_registration", "membership_application", "join"] as const;
export type FormTab = (typeof FORM_TABS)[number];

/** A form id from a URL segment (may be percent-encoded: `event%3Ae_1`), or null when it can never exist. */
export function parseFormId(raw: string): FormId | null {
  let s: string;
  try { s = decodeURIComponent(raw); } catch { return null; }
  return FORM_ID.test(s) ? (s as FormId) : null;
}

/** The membership and join forms are edited here; an event's questions are edited on the event. */
export const isSiteForm = (id: FormId): id is "membership_application" | "join" => !id.startsWith("event:");

export const formHref = (id: FormId, tab?: "questions" | "responses") => `/admin/forms/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`;
export const csvHref = (id: FormId, lang: Locale) => `/api/admin/forms/${encodeURIComponent(id)}/csv?lang=${lang}`;

const norm = (s: string) => s.toLowerCase().trim();

/** Tab counts ignore the tab itself but follow the search, so the numbers answer "how many would I see if I switched". */
export function filterForms(rows: FormSummary[], { tab, q }: { tab: FormTab; q: string }): FormSummary[] {
  const needle = norm(q);
  return rows.filter((r) => (tab === "all" || r.kind === tab) && (!needle || norm(r.title.mn).includes(needle) || norm(r.title.en).includes(needle)));
}
export function tabCounts(rows: FormSummary[], q: string): Record<FormTab, number> {
  const out = { all: 0, event_registration: 0, membership_application: 0, join: 0 } satisfies Record<FormTab, number>;
  for (const r of filterForms(rows, { tab: "all", q })) { out.all++; out[r.kind]++; }
  return out;
}
export const kindOrder: Record<FormKind, number> = { membership_application: 0, join: 1, event_registration: 2 };

/** One answer as a person reads it (option index → option text, checkbox → Yes/No, multi → "a; b"). */
export function answerText(q: Question, a: Answers[string] | undefined, lang: Locale, yes: string, no: string): string {
  if (a === undefined) return "";
  const option = (i: string) => { const o = q.options?.[Number(i)]; return o ? tf(o, lang) : i; };
  if (q.type === "checkbox") return a === true ? yes : no;
  if (q.type === "select" && typeof a === "string") return option(a);
  if (q.type === "multi" && Array.isArray(a)) return a.map(option).join("; ");
  return Array.isArray(a) ? a.join("; ") : String(a);
}

/** Raw text for an answer whose question no longer exists. */
export const rawAnswerText = (a: Answers[string] | undefined): string => (a === undefined ? "" : Array.isArray(a) ? a.join("; ") : String(a));

export const titleOf = (title: L, lang: Locale) => tf(title, lang);
