import type { L } from "@/i18n/config";
import type { PollInput } from "@/lib/mockdb/polls";
import type { Poll, PollAudience, PollResultsVisibility } from "@/lib/mockdb/types";

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
export const AUDIENCES: PollAudience[] = ["members", "community", "everyone"];
export const VISIBILITIES: PollResultsVisibility[] = ["after_vote", "after_close", "staff_only"];

export type OptionDraft = { id: string; label: L };
/** Editor state. Times are ISO instants (or null); the editor shows them on the Ulaanbaatar wall clock. */
export type PollDraft = {
  title: L; description: L; options: OptionDraft[]; multi: boolean; maxChoices: number;
  audience: PollAudience; anonymous: boolean; results: PollResultsVisibility; opensAt: string | null; closesAt: string | null;
};

/** Machine codes per field; the UI maps them to copy. Keys: title, description, options, option.<i>, optionEn.<i>, maxChoices, closes, opens. */
export type DraftErrors = Record<string, "title" | "description" | "options" | "option" | "optionEn" | "maxChoices" | "closes" | "date">;

/** Stable ids "o1", "o2"…: the next one never reuses an id in `taken` (votes refer to option ids, so a recycled id would inherit old votes). */
export function nextOptionId(taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`o${n}`)) n += 1;
  return `o${n}`;
}

export function emptyDraft(): PollDraft {
  return {
    title: { mn: "", en: "" }, description: { mn: "", en: "" },
    options: [{ id: "o1", label: { mn: "", en: "" } }, { id: "o2", label: { mn: "", en: "" } }],
    multi: false, maxChoices: 1, audience: "members", anonymous: true, results: "after_vote", opensAt: null, closesAt: null,
  };
}

export const draftFromPoll = (p: Poll): PollDraft => ({
  title: { ...p.title }, description: { ...p.description }, options: p.options.map((o) => ({ id: o.id, label: { ...o.label } })),
  multi: p.multi, maxChoices: p.max_choices, audience: p.audience, anonymous: p.anonymous, results: p.results, opensAt: p.opens_at, closesAt: p.closes_at,
});

export function moveOption<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Largest number of picks that makes sense now; shrinks when options are removed. */
export const clampMax = (max: number, optionCount: number): number => Math.min(Math.max(1, Number.isFinite(max) ? Math.trunc(max) : 1), Math.max(1, optionCount));

const validDate = (v: string | null) => v === null || !Number.isNaN(new Date(v).getTime());

/** Same rules as the rule layer (`mockdb/polls.ts`), so the form can say what is wrong before anything is sent. */
export function validateDraft(d: PollDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.title.mn.trim() || d.title.mn.length > 200 || d.title.en.length > 200) e.title = "title";
  if (d.description.mn.length > 2000 || d.description.en.length > 2000) e.description = "description";
  if (d.options.length < MIN_OPTIONS || d.options.length > MAX_OPTIONS) e.options = "options";
  d.options.forEach((o, i) => {
    if (!o.label.mn.trim() || o.label.mn.length > 120) e[`option.${i}`] = "option";
    else if (o.label.en.length > 120) e[`optionEn.${i}`] = "optionEn";
  });
  if (d.multi && (!Number.isInteger(d.maxChoices) || d.maxChoices < 1 || d.maxChoices > d.options.length)) e.maxChoices = "maxChoices";
  if (!validDate(d.opensAt)) e.opens = "date";
  if (!validDate(d.closesAt)) e.closes = "date";
  if (!e.opens && !e.closes && d.opensAt && d.closesAt && new Date(d.closesAt) <= new Date(d.opensAt)) e.closes = "closes";
  return e;
}

export function toInput(d: PollDraft): PollInput {
  return {
    title: { mn: d.title.mn.trim(), en: d.title.en.trim() }, description: { mn: d.description.mn.trim(), en: d.description.en.trim() },
    options: d.options.map((o) => ({ id: o.id, label: { mn: o.label.mn.trim(), en: o.label.en.trim() } })),
    multi: d.multi, max_choices: d.multi ? clampMax(d.maxChoices, d.options.length) : 1,
    audience: d.audience, anonymous: d.anonymous, results: d.results, opens_at: d.opensAt, closes_at: d.closesAt,
  };
}

export const sameDraft = (a: PollDraft, b: PollDraft) => JSON.stringify(a) === JSON.stringify(b);
