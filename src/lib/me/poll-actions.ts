"use server";
// Server Action for voting in a club poll. Authorisation = the acting person plus the rule (audience, open window, option
// ids, max choices). Input is shape-checked with zod first; failures return a sentence in the person's language.
import { z } from "zod";
import { pollMessage } from "@/components/me/polls/copy";
import { isLocale, type Locale } from "@/i18n/config";
import { vote } from "@/lib/mockdb/polls";
import type { ErrorCode } from "@/lib/result";
import { act } from "@/lib/server/session";
import type { ActionResult } from "./profile-actions";

const VoteInput = z.object({
  pollId: z.string().min(1).max(64),
  optionIds: z.array(z.string().min(1).max(24)).min(1).max(10),
});

const fail = (code: ErrorCode, lang: Locale): ActionResult<never> => ({ ok: false, error: code, message: pollMessage(code, lang) });

export async function votePollAction(lang: Locale, input: unknown): Promise<ActionResult> {
  const l: Locale = typeof lang === "string" && isLocale(lang) ? lang : "mn";
  const p = VoteInput.safeParse(input);
  if (!p.success) return fail("invalid", l);
  const r = await act((ctx) => vote(ctx, p.data));
  return r.ok ? { ok: true, data: undefined } : fail(r.error, l);
}
