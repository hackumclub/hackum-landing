"use server";
// Server Action for the admin forms hub. Authorise first (the page guard is not enough: actions are public endpoints),
// then shape-check the payload, then the rule (which re-checks staff, validates again and writes the audit entry).
import { err, type Result } from "@/lib/result";
import { questionsSchema } from "@/lib/events/questions";
import { log } from "@/lib/log";
import { updateForm } from "@/lib/mockdb/forms";
import { act, requireStaffAction } from "@/lib/server/session";

const SITE_FORMS = ["membership_application", "join"] as const;

/** Replace the questions of the membership or join form. Answers to removed questions stay in storage (see `orphanKeys`). */
export async function updateFormAction(id: unknown, questions: unknown): Promise<Result<{ updated_at: string }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  if (typeof id !== "string") return err("invalid");
  const formId = SITE_FORMS.find((x) => x === id);
  if (!formId) return err("not_found");
  const parsed = questionsSchema.safeParse(questions);
  if (!parsed.success) return err("invalid");
  const r = await act((ctx) => updateForm(ctx, formId, parsed.data));
  log(r.ok ? "INFO" : "WARN", "forms.actions", "form_updated", crypto.randomUUID(), { form_id: formId, questions: parsed.data.length, outcome: r.ok ? "ok" : r.error });
  return r.ok ? { ok: true, data: { updated_at: r.data.updated_at } } : r;
}
