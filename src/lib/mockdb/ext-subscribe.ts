// Newsletter sign-up ("notify me about events"): the one write the public site makes without a signed-in person.
import type { Locale } from "@/i18n/config";
import { err, ok, type Result } from "@/lib/result";
import { iso } from "./core";
import type { Ctx } from "./types";

export const SUBSCRIBE_SOURCES = ["join_page", "footer", "event_page"] as const;
const CONTROL = /[\u0000-\u001f\u007f]/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Normalised copy of what the visitor typed, or null when it cannot be a real name/email. */
export function normaliseSignup(name: string, email: string): { name: string; email: string } | null {
  const n = name.trim().replace(/\s+/g, " ");
  const e = email.trim().toLowerCase();
  if (n.length < 1 || n.length > 80 || CONTROL.test(n)) return null;
  if (e.length < 6 || e.length > 254 || CONTROL.test(e) || !EMAIL.test(e)) return null;
  return { name: n, email: e };
}

/**
 * Add a subscriber. A repeated email (any letter case) is a success that changes nothing, so the endpoint
 * cannot be used to find out who is already subscribed. Validation runs first, so an invalid request never
 * reveals whether the address exists either.
 */
export function subscribe(ctx: Ctx, input: { name: string; email: string; lang: Locale; source?: string }): Result<{ created: boolean }> {
  const clean = normaliseSignup(input.name, input.email);
  if (!clean) return err("invalid");
  if (ctx.db.subscribers.some((s) => s.email.toLowerCase() === clean.email)) return ok({ created: false });
  const source = (SUBSCRIBE_SOURCES as readonly string[]).includes(input.source ?? "") ? (input.source as string) : "join_page";
  ctx.db.subscribers.push({ ...clean, lang: input.lang, source, created_at: iso(ctx.now) });
  return ok({ created: true });
}
