// Pure model of the admin event form: state shape, validation that mirrors the rule's `valid()` in
// src/lib/mockdb/events.ts (the rule only answers "invalid", so the form must explain), the zod guard the server
// action runs on untrusted payloads, and the question-builder helpers. No React, no server-only imports.
import { z } from "zod";
import type { L } from "@/i18n/config";
import { questionsSchema, MAX_QUESTIONS, type Question } from "@/lib/events/questions";
import type { EventAudience, EventKind, EventMode, EventRow, RegMode, SchoolScope, TeamMode } from "@/lib/mockdb/types";
import type { EventInput } from "@/lib/mockdb/events";

export const KINDS = ["hackathon", "workshop", "meetup", "competition", "knowledge_day", "outing", "other"] as const satisfies readonly EventKind[];
export const MODES = ["offline", "online", "hybrid"] as const satisfies readonly EventMode[];
export const AUDIENCES = ["open", "members", "alumni", "invite"] as const satisfies readonly EventAudience[];
export const SCOPES = ["all", "num"] as const satisfies readonly SchoolScope[];
export const REG_MODES = ["rsvp", "application"] as const satisfies readonly RegMode[];
export const TEAM_MODES = ["none", "optional", "required"] as const satisfies readonly TeamMode[];
export const QUESTION_TYPES = ["short", "long", "select", "multi", "checkbox", "url"] as const satisfies readonly Question["type"][];

export type FormState = {
  slug: string;
  /** True once a person typed in the slug (or the event already exists): the title stops rewriting it. */
  slugTouched: boolean;
  kind: EventKind;
  title: L; tagline: L; description: L;
  starts_at: Date | null; ends_at: Date | null; reg_opens_at: Date | null; reg_closes_at: Date | null; decision_deadline: Date | null;
  mode: EventMode;
  venue_name: string; venue_address: string; online_url: string;
  audience: EventAudience;
  school_scope: SchoolScope;
  capacity: string; unlimited: boolean; waitlist: boolean;
  reg_mode: RegMode;
  questions: Question[];
  team_mode: TeamMode; team_size_min: number; team_size_max: number;
  cover_path: string;
};

// ── slug ───────────────────────────────────────────────────────────────────────────────────────────────────────

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u",
  п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "i", э: "e", ю: "yu", я: "ya",
};
const dash = (s: string) => s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** URL slug suggested from the English title, else a transliteration of the Mongolian one. Empty when nothing usable. */
export function slugify(title: L): string {
  const en = dash(title.en.toLowerCase());
  const src = en || dash([...title.mn.toLowerCase()].map((c) => CYR[c] ?? c).join(""));
  return dash(src.slice(0, 60));
}

// ── state ↔ input ──────────────────────────────────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;

export function defaultState(now: Date): FormState {
  const start = new Date(Math.ceil((now.getTime() + 7 * 24 * HOUR) / HOUR) * HOUR);
  return {
    slug: "", slugTouched: false, kind: "meetup",
    title: { mn: "", en: "" }, tagline: { mn: "", en: "" }, description: { mn: "", en: "" },
    starts_at: start, ends_at: new Date(start.getTime() + 2 * HOUR), reg_opens_at: null, reg_closes_at: null, decision_deadline: null,
    mode: "offline", venue_name: "", venue_address: "", online_url: "",
    audience: "open", school_scope: "all", capacity: "", unlimited: true, waitlist: true,
    reg_mode: "rsvp", questions: [], team_mode: "none", team_size_min: 1, team_size_max: 1,
    cover_path: "",
  };
}

const date = (iso: string | null) => (iso ? new Date(iso) : null);

export function stateFromEvent(e: EventRow): FormState {
  return {
    slug: e.slug, slugTouched: true, kind: e.kind, title: { ...e.title }, tagline: { ...e.tagline }, description: { ...e.description },
    starts_at: date(e.starts_at), ends_at: date(e.ends_at), reg_opens_at: date(e.reg_opens_at), reg_closes_at: date(e.reg_closes_at), decision_deadline: date(e.decision_deadline),
    mode: e.mode, venue_name: e.venue_name ?? "", venue_address: e.venue_address ?? "", online_url: e.online_url ?? "",
    audience: e.audience, school_scope: e.school_scope, capacity: e.capacity === null ? "" : String(e.capacity), unlimited: e.capacity === null, waitlist: e.waitlist,
    reg_mode: e.reg_mode, questions: structuredClone(e.questions), team_mode: e.team_mode, team_size_min: e.team_size_min, team_size_max: e.team_size_max,
    cover_path: e.cover_path ?? "",
  };
}

const trimL = (v: L): L => ({ mn: v.mn.trim(), en: v.en.trim() });
const orNull = (s: string) => s.trim() || null;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Form → what the rule takes. `keep` supplies the fields the form does not edit (poster, themes, external link). */
export function toInput(s: FormState, keep: Pick<EventRow, "poster_path" | "themes" | "external_url"> | null): EventInput {
  const application = s.reg_mode === "application";
  const parsedCapacity = s.capacity.trim() === "" ? Number.NaN : Number(s.capacity);
  return {
    slug: s.slug.trim(), kind: s.kind, title: trimL(s.title), tagline: trimL(s.tagline), description: trimL(s.description),
    starts_at: s.starts_at ? s.starts_at.toISOString() : "", ends_at: s.ends_at ? s.ends_at.toISOString() : "",
    mode: s.mode,
    venue_name: s.mode === "online" ? null : orNull(s.venue_name),
    venue_address: s.mode === "online" ? null : orNull(s.venue_address),
    online_url: s.mode === "offline" ? null : orNull(s.online_url),
    audience: s.audience, school_scope: s.school_scope,
    capacity: s.unlimited ? null : parsedCapacity, waitlist: s.waitlist,
    reg_opens_at: iso(s.reg_opens_at), reg_closes_at: iso(s.reg_closes_at),
    cover_path: orNull(s.cover_path), poster_path: keep?.poster_path ?? null, themes: keep?.themes ?? [], external_url: keep?.external_url ?? null,
    reg_mode: s.reg_mode,
    // RSVP events take no custom questions or teams: a required question would block the one-tap RSVP.
    questions: application ? s.questions.map((q) => ({ ...q, label: trimL(q.label), ...(q.options ? { options: q.options.map(trimL) } : {}) })) : [],
    team_mode: application ? s.team_mode : "none", team_size_min: s.team_size_min, team_size_max: s.team_size_max,
    decision_deadline: application ? iso(s.decision_deadline) : null,
  };
}

// ── validation ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Machine codes; the form maps them to copy. Keys are field names, `questions`, or `q<i>.label` / `q<i>.options`. */
export type FormErrors = Record<string, string>;

export function validate(s: FormState, opts: { takenSlugs: readonly string[] }): FormErrors {
  const e: FormErrors = {};
  if (!/^[a-z0-9-]{3,60}$/.test(s.slug.trim())) e.slug = "slug_format";
  else if (opts.takenSlugs.includes(s.slug.trim())) e.slug = "slug_taken";
  if (!s.title.mn.trim()) e.title = "required";
  if (!s.starts_at) e.starts_at = "required";
  if (!s.ends_at) e.ends_at = "required";
  else if (s.starts_at && s.ends_at <= s.starts_at) e.ends_at = "end_before_start";
  if (!s.unlimited) {
    const n = s.capacity.trim() === "" ? Number.NaN : Number(s.capacity);
    if (Number.isNaN(n) && s.capacity.trim() !== "") e.capacity = "capacity_nan";
    else if (!Number.isInteger(n) || n < 1 || n > 5000) e.capacity = "capacity_range";
  }
  if (s.reg_closes_at && s.starts_at && s.reg_closes_at > s.starts_at) e.reg_closes_at = "closes_after_start";
  if (s.reg_opens_at && s.reg_closes_at && s.reg_opens_at > s.reg_closes_at) e.reg_opens_at = "opens_after_closes";
  if (s.mode !== "offline" && !/^https:\/\/\S+$/.test(s.online_url.trim())) e.online_url = "https_required";
  if (s.reg_mode === "application") {
    if (!s.decision_deadline) e.decision_deadline = "required";
    if (s.team_mode !== "none" && !(s.team_size_min >= 1 && s.team_size_min <= s.team_size_max && s.team_size_max <= 10)) e.team_size = "team_range";
    Object.assign(e, validateQuestions(s.questions));
  }
  return e;
}

/** Errors for a question list (event form and the forms hub editor): `questions`, `q<i>.label`, `q<i>.options`. */
export function validateQuestions(questions: readonly Question[]): FormErrors {
  const e: FormErrors = {};
  if (questions.length > MAX_QUESTIONS) e.questions = "too_many";
  questions.forEach((q, i) => {
    if (!q.label.mn.trim()) e[`q${i}.label`] = "required";
    if ((q.type === "select" || q.type === "multi") && (q.options ?? []).filter((o) => o.mn.trim()).length < 2) e[`q${i}.options`] = "options_min_2";
  });
  return e;
}

// ── question builder ───────────────────────────────────────────────────────────────────────────────────────────

/** Smallest unused `q<n>`. Ids are never derived from labels, so renaming a question never orphans its answers. */
export function nextQuestionId(existing: readonly string[]): string {
  for (let n = 1; ; n++) if (!existing.includes(`q${n}`)) return `q${n}`;
}

export function newQuestion(existingIds: readonly string[], type: Question["type"]): Question {
  const q: Question = { id: nextQuestionId(existingIds), type, label: { mn: "", en: "" }, required: false };
  if (type === "select" || type === "multi") q.options = [{ mn: "", en: "" }, { mn: "", en: "" }];
  return q;
}

/** Swap with the neighbour; at the ends returns the same array so callers can skip the state update. */
export function moveQuestion(qs: Question[], index: number, dir: -1 | 1): Question[] {
  const to = index + dir;
  if (to < 0 || to >= qs.length) return qs;
  const next = [...qs];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// ── before / after for the staged-edit dialog ──────────────────────────────────────────────────────────────────

export const DIFF_KEYS = ["slug", "kind", "title", "tagline", "description", "starts_at", "ends_at", "mode", "venue_name", "venue_address", "online_url", "audience", "school_scope", "capacity", "waitlist", "reg_opens_at", "reg_closes_at", "cover_path", "reg_mode", "questions", "team_mode", "team_size_min", "team_size_max", "decision_deadline"] as const satisfies readonly (keyof EventInput)[];
export type DiffKey = (typeof DIFF_KEYS)[number];
/** Changing any of these tells people with a seat (mirrors NOTIFY_FIELDS in the rule). */
const NOTIFY: readonly DiffKey[] = ["starts_at", "ends_at", "mode", "venue_name", "venue_address", "online_url"];

export type FieldChange = { key: DiffKey; before: EventInput[DiffKey]; after: EventInput[DiffKey]; notifies: boolean };

export function changedFields(before: EventRow, after: EventInput): FieldChange[] {
  return DIFF_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((key) => ({ key, before: before[key], after: after[key], notifies: NOTIFY.includes(key) }));
}

// ── server-side guard ──────────────────────────────────────────────────────────────────────────────────────────

const text = (max: number) => z.object({ mn: z.string().max(max), en: z.string().max(max) });
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date");
const path = z.string().max(300).regex(/^(\/|https:\/\/)/);

/** Shape + size limits for a payload that crossed the network. Business rules stay in the mock RPC (`valid()`). */
export const eventInputSchema: z.ZodType<EventInput> = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  kind: z.enum(KINDS), title: text(200), tagline: text(300), description: text(10_000),
  starts_at: isoDate, ends_at: isoDate,
  mode: z.enum(MODES),
  venue_name: z.string().max(200).nullable(), venue_address: z.string().max(300).nullable(), online_url: z.string().max(500).nullable(),
  audience: z.enum(AUDIENCES), school_scope: z.enum(["num", "all"]),
  capacity: z.number().int().min(1).max(5000).nullable(), waitlist: z.boolean(),
  reg_opens_at: isoDate.nullable(), reg_closes_at: isoDate.nullable(),
  cover_path: path.nullable(), poster_path: path.nullable(), themes: z.array(z.string().max(40)).max(10), external_url: z.string().max(500).nullable(),
  reg_mode: z.enum(REG_MODES), questions: questionsSchema,
  team_mode: z.enum(TEAM_MODES), team_size_min: z.number().int().min(0).max(100), team_size_max: z.number().int().min(0).max(100),
  decision_deadline: isoDate.nullable(),
});
