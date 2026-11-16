import { z } from "zod";
import type { L } from "@/i18n/config";

/** One custom registration question on an event (stored in `events.questions` jsonb, ordered). */
export type Question = {
  id: string; // ^[a-z0-9_]{1,32}$, unique within the event
  type: "short" | "long" | "select" | "multi" | "checkbox" | "url";
  label: L;
  required: boolean;
  /** select / multi only. Answers refer to options by index ("0", "1", …). */
  options?: L[];
};
export type Answers = Record<string, string | string[] | boolean>;

export const MAX_QUESTIONS = 20;
export const SHORT_MAX = 200;
export const LONG_MAX = 2000;
export const URL_MAX = 2000;

/** Machine codes returned per question id by `parseAnswers`; the UI maps them to localized copy. `invalid` is the whole payload (key "_"). */
export type AnswerErrorCode = "required" | "too_long" | "bad_url" | "bad_option" | "invalid";

// ── question definitions (admin builder) ─────────────────────────────────────────────────────────────────────────

const labelSchema = z.object({
  mn: z.string().trim().min(1).max(200), // Mongolian is the source language; en may be empty (falls back to mn)
  en: z.string().trim().max(200),
});

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{1,32}$/),
    type: z.enum(["short", "long", "select", "multi", "checkbox", "url"]),
    label: labelSchema,
    required: z.boolean(),
    options: z.array(labelSchema).max(20).optional(),
  })
  .superRefine((q, ctx) => {
    if ((q.type === "select" || q.type === "multi") && (q.options?.length ?? 0) < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "options_min_2" });
    }
  });

export const questionsSchema: z.ZodType<Question[]> = z
  .array(questionSchema)
  .max(MAX_QUESTIONS)
  .superRefine((qs, ctx) => {
    const seen = new Set<string>();
    qs.forEach((q, i) => {
      if (seen.has(q.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: "duplicate_id" });
      seen.add(q.id);
    });
  });

// ── answers ──────────────────────────────────────────────────────────────────────────────────────────────────────

const OPTION_INDEX = /^(0|[1-9]\d*)$/;
const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

type Checked = { value: string | string[] | boolean | undefined } | { code: AnswerErrorCode };

/** Validates one answer. `value: undefined` means "empty optional answer, omit it". */
function checkAnswer(q: Question, raw: unknown): Checked {
  const fail = (code: AnswerErrorCode): Checked => ({ code });
  switch (q.type) {
    case "short":
    case "long": {
      if (isBlank(raw)) return q.required ? fail("required") : { value: undefined };
      if (typeof raw !== "string") return fail("required");
      const v = raw.trim();
      return v.length > (q.type === "short" ? SHORT_MAX : LONG_MAX) ? fail("too_long") : { value: v };
    }
    case "url": {
      if (isBlank(raw)) return q.required ? fail("required") : { value: undefined };
      if (typeof raw !== "string") return fail("bad_url");
      const v = raw.trim();
      if (v.length > URL_MAX) return fail("too_long");
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:" ? { value: v } : fail("bad_url");
      } catch {
        return fail("bad_url");
      }
    }
    case "select": {
      if (isBlank(raw)) return q.required ? fail("required") : { value: undefined };
      const n = q.options?.length ?? 0;
      return typeof raw === "string" && OPTION_INDEX.test(raw) && Number(raw) < n ? { value: raw } : fail("bad_option");
    }
    case "multi": {
      if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) return q.required ? fail("required") : { value: undefined };
      const n = q.options?.length ?? 0;
      if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string" && OPTION_INDEX.test(x) && Number(x) < n)) return fail("bad_option");
      return { value: [...new Set(raw as string[])] };
    }
    case "checkbox": {
      if (raw === undefined || raw === null) return q.required ? fail("required") : { value: undefined };
      if (typeof raw !== "boolean") return fail("required");
      return q.required && !raw ? fail("required") : { value: raw };
    }
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Zod schema for the answers of one registration to the given questions. Unknown keys are stripped, empty optional
 * answers are omitted, and each issue's `path` is `[questionId]` with the machine code as its `message`.
 */
export function answersSchema(qs: Question[]): z.ZodType<Answers> {
  return z
    .custom<Record<string, unknown>>(isRecord, { message: "invalid" })
    .transform((raw, ctx): Answers => {
      const out: Answers = {};
      for (const q of qs) {
        const r = checkAnswer(q, Object.hasOwn(raw, q.id) ? raw[q.id] : undefined);
        if ("code" in r) ctx.addIssue({ code: "custom", path: [q.id], message: r.code });
        else if (r.value !== undefined) out[q.id] = r.value;
      }
      return out;
    });
}

export function parseAnswers(
  qs: Question[],
  raw: unknown,
): { ok: true; data: Answers } | { ok: false; errors: Record<string, string> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, errors: { _: "invalid" } };
  const r = answersSchema(qs).safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = typeof issue.path[0] === "string" ? issue.path[0] : "_";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
