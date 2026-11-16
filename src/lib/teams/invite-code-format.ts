// Pure (client-safe) half of the team invite code: the alphabet and how a typed code is cleaned up.
/** 32 symbols (no I, O, 0, 1: they are read wrongly aloud): each random byte maps onto it without bias (256 / 32). */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_PATTERN = /^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

/**
 * What a person typed or pasted, as the stored code: separators, spaces and case do not matter.
 * Twelve symbols after HK become HK-XXXX-XXXX-XXXX; the short demo codes (HK-XXXX) keep working; anything else is just
 * trimmed and uppercased so it simply fails to match.
 */
export function normalizeInviteCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const flat = upper.replace(/[^A-Z0-9]/g, "");
  if (/^HK[A-Z0-9]{12}$/.test(flat)) return `HK-${flat.slice(2, 6)}-${flat.slice(6, 10)}-${flat.slice(10, 14)}`;
  if (/^HK[A-Z0-9]{4}$/.test(flat)) return `HK-${flat.slice(2)}`;
  return upper;
}
