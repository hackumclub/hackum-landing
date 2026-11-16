import { err, ok, type Result } from "@/lib/result";
import type { L } from "@/i18n/config";
import { type Answers, parseAnswers, questionsSchema, type Question } from "@/lib/events/questions";
import { audit, iso, nextId, profileOf, requireProfile, requireStaff } from "./core";
import type { Ctx, Db, Form } from "./types";

export type FormId = "membership_application" | "join" | `event:${string}`;
export type FormKind = "event_registration" | "membership_application" | "join";
export type FormSummary = { id: FormId; kind: FormKind; title: L; event_id: string | null; question_count: number; responses: number; last_response_at: string | null };
/** One answer sheet. Names only: staff see who answered, never their email. */
export type FormResponse = { profile_id: string; name: L; submitted_at: string; status: string; answers: Answers };

const SITE_FORMS = ["membership_application", "join"] as const;
const newest = (a: { submitted_at: string }, b: { submitted_at: string }) => b.submitted_at.localeCompare(a.submitted_at);

export function formDefinition(db: Db, id: FormId): { title: L; questions: Question[] } | null {
  if (id.startsWith("event:")) {
    const ev = db.events.find((e) => e.id === id.slice(6));
    return ev ? { title: ev.title, questions: ev.questions } : null;
  }
  const f = db.forms.find((x) => x.id === id);
  return f ? { title: f.title, questions: f.questions } : null;
}

/** Responses to a form, newest first; null when the form does not exist. Answers to removed questions are kept. */
export function listResponses(db: Db, id: FormId): FormResponse[] | null {
  if (!formDefinition(db, id)) return null;
  const who = (profileId: string): L => profileOf(db, profileId)?.name ?? { mn: "", en: "" };
  let rows: FormResponse[];
  if (id.startsWith("event:")) {
    rows = db.registrations.filter((r) => r.event_id === id.slice(6) && r.status !== "cancelled")
      .map((r) => ({ profile_id: r.profile_id, name: who(r.profile_id), submitted_at: r.created_at, status: r.status, answers: r.answers }));
  } else if (id === "membership_application") {
    rows = db.membership_applications.map((a) => ({ profile_id: a.profile_id, name: who(a.profile_id), submitted_at: a.created_at, status: a.status, answers: a.answers }));
  } else {
    rows = db.form_submissions.map((s) => ({ profile_id: s.profile_id, name: who(s.profile_id), submitted_at: s.created_at, status: "submitted", answers: s.answers }));
  }
  return rows.sort(newest);
}

/** Answer keys no current question owns (the question was removed after people answered). */
export function orphanKeys(questions: Question[], rows: FormResponse[]): string[] {
  const known = new Set(questions.map((q) => q.id));
  const out: string[] = [];
  for (const r of rows) for (const k of Object.keys(r.answers)) if (!known.has(k) && !out.includes(k)) out.push(k);
  return out;
}

export function listForms(db: Db): FormSummary[] {
  const summary = (id: FormId, kind: FormKind, title: L, eventId: string | null, questions: Question[]): FormSummary => {
    const rows = listResponses(db, id) ?? [];
    return { id, kind, title, event_id: eventId, question_count: questions.length, responses: rows.length, last_response_at: rows[0]?.submitted_at ?? null };
  };
  const site = db.forms.map((f) => summary(f.id, f.kind, f.title, null, f.questions));
  const events = [...db.events].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map((e) => summary(`event:${e.id}`, "event_registration", e.title, e.id, e.questions));
  return [...site, ...events];
}

export function updateForm(ctx: Ctx, id: (typeof SITE_FORMS)[number], questions: unknown): Result<Form> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const form = SITE_FORMS.includes(id) ? ctx.db.forms.find((f) => f.id === id) : undefined;
  if (!form) return err("not_found");
  const parsed = questionsSchema.safeParse(questions);
  if (!parsed.success) return err("invalid");
  const before = form.questions.length;
  Object.assign(form, { questions: parsed.data, updated_at: iso(ctx.now), updated_by: staff.data.id });
  audit(ctx, "form.update", "forms", id, { questions: [before, parsed.data.length] });
  return ok(form);
}

/** Answers to the "Join Hackum" form, one submission per person (the newest wins). */
export function submitJoinForm(ctx: Ctx, answers: unknown): Result<{ id: string }> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const parsed = parseAnswers(ctx.db.forms.find((f) => f.id === "join")?.questions ?? [], answers);
  if (!parsed.ok) return err("invalid");
  const row = ctx.db.form_submissions.find((s) => s.profile_id === me.data.id);
  if (row) Object.assign(row, { answers: parsed.data, created_at: iso(ctx.now) });
  else ctx.db.form_submissions.push({ id: nextId(ctx.db, "fs"), form_id: "join", profile_id: me.data.id, answers: parsed.data, created_at: iso(ctx.now) });
  return ok({ id: (row ?? ctx.db.form_submissions.at(-1)!).id });
}
