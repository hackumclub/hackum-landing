import type { Locale } from "@/i18n/config";

/** Only same-site relative paths are followed after sign-in (no open redirect, no protocol-relative URLs). */
export function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/(mn|en)(\/|$)/.test(next) && !next.startsWith("//") && !next.includes("\\") ? next : null;
}

/**
 * Where a person goes after signing in: unfinished onboarding first (carrying the page they asked for), then the page they
 * asked for, then home: the backoffice for staff, the member app for everyone else.
 */
export function landingPath(lang: Locale, next: unknown, who: { staff: boolean; onboarded: boolean }): string {
  const asked = safeNext(next);
  if (!who.onboarded) return asked ? `/${lang}/me/onboarding?next=${encodeURIComponent(asked)}` : `/${lang}/me/onboarding`;
  if (asked) return asked;
  return who.staff ? `/${lang}/admin` : `/${lang}/me`;
}
