"use server";
// Server Actions for the in-app inbox. Authorisation: the actor is the persona cookie (Clerk later); the rules only ever
// touch the actor's own rows, so another person's ids are ignored. Input is validated before the rule runs.
import { z } from "zod";
import { isLocale, type Locale } from "@/i18n/config";
import { err, type Result } from "@/lib/result";
import { markAllRead, markRead } from "@/lib/mockdb/notifications";
import { act, getActorId } from "@/lib/server/session";
import { loadInboxPage, type InboxPage } from "./load";

const ids = z.array(z.string().min(1).max(64)).min(1).max(200);
const before = z.string().min(1).max(64);

export async function markReadAction(input: string[]): Promise<Result<{ changed: number }>> {
  const parsed = ids.safeParse(input);
  if (!parsed.success) return err("invalid");
  return act((ctx) => markRead(ctx, parsed.data));
}

export async function markAllReadAction(): Promise<Result<{ changed: number }>> {
  return act((ctx) => markAllRead(ctx));
}

/** Next page of the actor's own list, after the row with id `cursor`. */
export async function loadMoreAction(cursor: string, lang: string): Promise<Result<InboxPage>> {
  const parsed = before.safeParse(cursor);
  if (!parsed.success || !isLocale(lang)) return err("invalid");
  const actor = await getActorId();
  if (!actor) return err("unauthenticated");
  return { ok: true, data: loadInboxPage(actor, lang as Locale, { before: parsed.data }) };
}
