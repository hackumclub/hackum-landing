import type { Locale } from "@/i18n/config";
import type { ErrorCode } from "@/lib/result";
import { copy } from "./copy";

/** One plain sentence for every error code; never the code itself. `network` is for a call that never got an answer. */
export function announceMessage(code: ErrorCode | "network", lang: Locale): string {
  const e: Record<string, string> = copy[lang].errors;
  return e[code] ?? e.server;
}
