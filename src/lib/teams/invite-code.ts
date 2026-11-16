import { randomBytes } from "node:crypto";
import { INVITE_ALPHABET } from "./invite-code-format";

export { INVITE_ALPHABET, INVITE_PATTERN, normalizeInviteCode } from "./invite-code-format";

/** HK- plus 12 symbols from a cryptographically secure source: 60 bits, so a code cannot be guessed. Server only. */
export function generateInviteCode(): string {
  const bytes = randomBytes(12);
  const symbols = Array.from(bytes, (b) => INVITE_ALPHABET[b & 31]).join("");
  return `HK-${symbols.slice(0, 4)}-${symbols.slice(4, 8)}-${symbols.slice(8, 12)}`;
}
