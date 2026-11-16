// Pure, client-safe part of the audit log: the filter shape and the (untrusted) query-string parser.
import { AUDIT_GROUPS, type AuditGroup } from "@/lib/members/format";

export const PAGE_SIZE = 50;
export const RANGES = ["24h", "7d", "30d"] as const;
export type Range = (typeof RANGES)[number];
export const RANGES_MS: Record<Range, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };

export type AuditFilter = { groups: Exclude<AuditGroup, "other">[]; actor: string | null; range: Range | null; page: number };

/** Parse untrusted query params into a safe filter (unknown groups/ranges are dropped, page is clamped later). */
export function parseAuditFilter(sp: Record<string, string | string[] | undefined>): AuditFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const groups = one(sp.group).split(",").filter((g): g is Exclude<AuditGroup, "other"> => (AUDIT_GROUPS as readonly string[]).includes(g));
  const range = RANGES.find((r) => r === one(sp.range)) ?? null;
  const actor = one(sp.actor).slice(0, 64) || null;
  return { groups: [...new Set(groups)], actor, range, page: Number.parseInt(one(sp.page), 10) || 1 };
}
