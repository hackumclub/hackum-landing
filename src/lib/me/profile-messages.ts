import { copy } from "@/i18n/areas/me";
import type { Locale } from "@/i18n/config";
import type { ErrorCode } from "@/lib/result";

/** Which form a failure came from: "invalid" means something different for a photo than for a subject list. */
export type ProfileScope = "profile" | "academic" | "avatar" | "subjects";

/** The sentence people read for a rule error. Never the code itself. */
export function profileMessage(code: ErrorCode, lang: Locale, scope: ProfileScope): string {
  const t = copy[lang].profile;
  return code === "invalid" ? t.errInvalid[scope] : (t.err as Record<string, string>)[code] ?? t.err.server;
}
