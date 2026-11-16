import type { ErrorCode } from "@/lib/result";

/** Copy keys (see `copy[lang].auth.errors`) for what can go wrong on the "enter your code" step. */
export type CodeErrorKey = "codeWrong" | "codeLocked" | "noAccount" | "server";
export function codeErrorKey(error: ErrorCode): CodeErrorKey {
  switch (error) {
    case "invalid": return "codeWrong"; // wrong, expired or already used: the rule does not say which, on purpose
    case "rate_limited": return "codeLocked";
    case "not_found": return "noAccount";
    default: return "server";
  }
}

/** Copy keys for the "send me a code" step. */
export type SendErrorKey = "emailInvalid" | "sendLimit" | "server";
export function sendErrorKey(error: ErrorCode): SendErrorKey {
  return error === "invalid" ? "emailInvalid" : error === "rate_limited" ? "sendLimit" : "server";
}
