"use server";
// Server Action for answering an event's feedback survey. Authorisation = the acting person (`act` runs the rule as the
// session's profile; signed out → unauthenticated) and the rule itself (only people who attended or were going, only inside
// the 14-day window). Input comes from the browser, so it is shape-checked with zod first; failures come back as a sentence
// in the person's language, never a code.
import { z } from "zod";
import { feedbackMessage } from "@/components/me/feedback/copy";
import { isLocale, type Locale } from "@/i18n/config";
import { submitFeedback } from "@/lib/mockdb/feedback";
import type { ErrorCode } from "@/lib/result";
import { act } from "@/lib/server/session";
import type { ActionResult } from "./profile-actions";

const TEXT = 1000;
const FeedbackInput = z.object({
  eventId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  nps: z.number().int().min(0).max(10),
  went_well: z.string().max(TEXT),
  improve: z.string().max(TEXT),
  anonymous: z.boolean(),
});

const fail = (code: ErrorCode, lang: Locale): ActionResult<never> => ({ ok: false, error: code, message: feedbackMessage(code, lang) });

export async function submitFeedbackAction(lang: Locale, input: unknown): Promise<ActionResult<{ id: string }>> {
  const l: Locale = typeof lang === "string" && isLocale(lang) ? lang : "mn";
  const p = FeedbackInput.safeParse(input);
  if (!p.success) return fail("invalid", l);
  const r = await act((ctx) => submitFeedback(ctx, p.data));
  return r.ok ? r : fail(r.error, l);
}
