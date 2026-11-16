import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/me";
import { isLocale, type Locale } from "@/i18n/config";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { requireSession } from "@/lib/server/session";

/**
 * Everything a /me page needs, resolved at request time: language, the signed-in person (redirects to sign-in, or to
 * onboarding when not onboarded), a fresh clock and the db. Call it inside the page's <Suspense> boundary.
 */
export async function meContext(params: Promise<{ lang: string }>, path: (lang: Locale) => string, opts: { onboarded?: boolean } = {}) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  await connection(); // "now" and the store are per-request
  const session = await requireSession(lang, path(lang), opts);
  return { lang, session, db: getStore().read(), now: new Date(), d: getDictionary(lang), c: copy[lang] };
}
