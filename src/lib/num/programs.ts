import type { L, Locale } from "@/i18n/config";
import type { MajorTrack } from "./schools";

export type ProgramLevel = "bachelor" | "master" | "doctor";
export type NumProgram = { index: string; name: L; level: ProgramLevel; unit: string; track: MajorTrack };

/** Lowercase, strip diacritics (NFD marks) and collapse whitespace. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const compact = (s: string) => s.replace(/\s+/g, "");

const TRACK_NAMES: readonly [MajorTrack, readonly string[]][] = [
  ["software", ["программ хангамж", "software engineering"]],
  // The seed spells it "Компьютерийн ухаан"; the NUM data says "Компьютерын ухаан".
  ["cs", ["компьютерын ухаан", "компьютерийн ухаан", "computer science"]],
  ["is", ["мэдээллийн систем", "information systems"]],
  ["it", ["мэдээллийн технологи", "information technology"]],
];

/** Track from the exact program name (either language); anything else, e.g. teacher-training variants, is "other". */
export function trackOf(p: { name: L }): MajorTrack {
  const names = [fold(p.name.mn), fold(p.name.en)];
  return TRACK_NAMES.find(([, needles]) => needles.some((n) => names.includes(fold(n))))?.[0] ?? "other";
}

let loaded: NumProgram[] | null = null;
let pending: Promise<NumProgram[]> | null = null;

/** Loads the bundled list on demand (dynamic import keeps ~85 KB of JSON out of the initial bundle) and memoises it. */
export function loadPrograms(): Promise<NumProgram[]> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import("@/data/num-programs.json").then((m) => {
    const doc = (m.default ?? m) as unknown as { programs: NumProgram[] };
    loaded = doc.programs;
    return loaded;
  }).catch((e: unknown) => { pending = null; throw e; });
  return pending;
}

/** Lower is better: 0 prefix of a name or the index, 1 prefix of a word, 2 substring; Infinity no match. */
function rankOf(q: string, qc: string, text: string): number {
  const f = fold(text);
  if (f.startsWith(q)) return 0;
  if (f.split(/[\s,\-–()/]+/).some((w) => w.startsWith(q))) return 1;
  if (f.includes(q)) return 2;
  return qc.length > 0 && compact(f).includes(qc) ? 2 : Infinity;
}

/**
 * Case- and diacritic-insensitive search over mn + en names and the index. Prefix matches first, then shorter names.
 * An empty query lists the first rows of the level so the picker can be browsed.
 * `programs` defaults to the list filled by `loadPrograms()` (empty until that has resolved).
 */
export function searchPrograms(
  q: string,
  lang: Locale,
  opts: { level?: NumProgram["level"]; limit?: number } = {},
  programs: readonly NumProgram[] = loaded ?? [],
): NumProgram[] {
  const limit = Math.max(0, opts.limit ?? 8);
  const pool = opts.level ? programs.filter((p) => p.level === opts.level) : programs;
  const query = fold(q);
  if (!query) return pool.slice(0, limit);
  const qc = compact(query);
  const other: Locale = lang === "mn" ? "en" : "mn";
  const scored: { p: NumProgram; rank: number }[] = [];
  for (const p of pool) {
    // The user's language wins ties over the other language and the index.
    const rank = Math.min(rankOf(query, qc, p.name[lang]), rankOf(query, qc, p.index) + 0.25, rankOf(query, qc, p.name[other]) + 0.5);
    if (Number.isFinite(rank)) scored.push({ p, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.p.name[lang].length - b.p.name[lang].length);
  return scored.slice(0, limit).map((s) => s.p);
}
