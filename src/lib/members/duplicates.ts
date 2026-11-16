// Possible-duplicate detection for the Merge tab. Pure and synchronous: O(n²) pair scan, fine for a club roster
// (~140 profiles = ~10k comparisons); bucket by first letter / email if the roster ever passes a few thousand.
import type { L } from "@/i18n/config";

export type DuplicateReason = "name" | "similar" | "email";
export type DuplicatePair = { a: string; b: string; score: number; reason: DuplicateReason };
export type DuplicateCandidate = { id: string; name: L; email: string | null };

/** Fuzzy matching below this length would pair unrelated short names ("Ану" / "Ана"), so it needs a longer name. */
const MIN_FUZZY_LENGTH = 6;
const MAX_EDITS = 2;
export const MIN_SCORE = 0.8;

/** Lowercase, trim, and collapse runs of whitespace and hyphens/dashes into one space ("Бат-Эрдэнэ" = "бат эрдэнэ"). */
export const normalizeName = (s: string) => s.toLowerCase().replace(/[\s\-‐-―]+/g, " ").trim();

const normalizeEmail = (s: string | null) => (s ? s.trim().toLowerCase() : "");

/** Classic edit distance (insert, delete, substitute), two-row DP, early exit not needed at these lengths. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

type Prepared = { id: string; mn: string; en: string; email: string };

function scorePair(x: Prepared, y: Prepared): { score: number; reason: DuplicateReason } | null {
  if (x.email && x.email === y.email) return { score: 1, reason: "email" };
  if ((x.mn && x.mn === y.mn) || (x.en && x.en === y.en)) return { score: 1, reason: "name" };
  if (x.mn.length >= MIN_FUZZY_LENGTH && y.mn.length >= MIN_FUZZY_LENGTH && Math.abs(x.mn.length - y.mn.length) <= MAX_EDITS && levenshtein(x.mn, y.mn) <= MAX_EDITS) {
    return { score: 0.8, reason: "similar" };
  }
  return null;
}

/**
 * Pairs worth a human look. Same non-null email or equal normalized name (Mongolian, or English when present) = 1.0;
 * Levenshtein ≤ 2 on the normalized Mongolian name = 0.8. Score ≥ 0.8 only, no self-pairs, each pair once
 * (in input order), sorted by score descending then input order.
 */
export function suggestDuplicates(people: DuplicateCandidate[]): DuplicatePair[] {
  const ps: Prepared[] = people.map((p) => ({ id: p.id, mn: normalizeName(p.name.mn), en: normalizeName(p.name.en), email: normalizeEmail(p.email) }));
  const out: DuplicatePair[] = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const x = ps[i]!, y = ps[j]!;
      if (x.id === y.id) continue;
      const s = scorePair(x, y);
      if (s && s.score >= MIN_SCORE) out.push({ a: x.id, b: y.id, ...s });
    }
  }
  // Array.prototype.sort is stable, so equal scores keep the (i, j) discovery order.
  return out.sort((p, q) => q.score - p.score);
}

export type MergeFootprint = { regEvents: string[]; seasons: number[]; appSeasons: number[] };

/** What merging `drop` into `keep` actually moves: rows that would collide (same event / same season) are discarded, not moved. */
export function mergeImpact(keep: MergeFootprint, drop: MergeFootprint) {
  const only = <T,>(from: T[], other: T[]) => new Set(from.filter((x) => !other.includes(x))).size;
  return { registrations: only(drop.regEvents, keep.regEvents), seasons: only(drop.seasons, keep.seasons), applications: only(drop.appSeasons, keep.appSeasons) };
}
