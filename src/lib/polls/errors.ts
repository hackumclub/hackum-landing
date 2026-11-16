import type { Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-polls";
import type { ErrorCode } from "@/lib/result";

export type PollErrorScope = "save" | "status";

/** One plain sentence for every error code; never the code itself. `conflict` depends on what was being done. */
export function pollMessage(code: ErrorCode, lang: Locale, scope: PollErrorScope): string {
  const e: Record<string, string> = copy[lang].errors;
  if (code === "conflict") return scope === "save" ? e.conflictSave : e.conflictStatus;
  return e[code] ?? e.generic;
}
