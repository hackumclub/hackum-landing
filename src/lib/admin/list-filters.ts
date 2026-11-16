// Pure row filters for the admin lists, driven by the URL state in `list-state.ts`. Each list passes plain rows (the
// same JSON the server hands to the client) so the numbers on a chip equal the rows you get when you pick it.
import type { L } from "@/i18n/config";
import type { ListState } from "@/lib/admin/list-state";
import { semesterOf } from "@/lib/semester";
import { toUbInput } from "@/lib/time";

const norm = (s: string) => s.toLowerCase().trim();
/** The Ulaanbaatar calendar day ("2026-11-16") an instant falls on. */
export const ubDayOf = (iso: string): string => toUbInput(new Date(iso)).slice(0, 10);
export const semesterKey = (at: Date): string => { const s = semesterOf(at); return `${s.year}-${s.term}`; };

function inRange(iso: string | null, state: ListState): boolean {
  if (!state.from || !state.to) return true;
  if (!iso) return false;
  const day = ubDayOf(iso);
  return day >= state.from && day <= state.to;
}
const hits = (selected: string[], pass: (v: string) => boolean) => selected.length === 0 || selected.some(pass);
const matchesText = (q: string, parts: (string | null | undefined)[]) => { const n = norm(q); return n === "" || parts.some((p) => norm(p ?? "").includes(n)); };

/** Number of rows each value of `group` would show if it were the only value chosen in that group (other filters kept). */
export function facetCounts<T>(rows: T[], state: ListState, group: string, values: readonly string[], filter: (rows: T[], s: ListState) => T[]): Record<string, number> {
  return Object.fromEntries(values.map((v) => [v, filter(rows, { ...state, multi: { ...state.multi, [group]: [v] } }).length]));
}

// ── members ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const MEMBER_TRACK_VALUES = ["software", "cs", "is", "it", "other", "unknown"] as const;
export const MEMBER_SCHOOL_VALUES = ["num", "other"] as const;
export type MemberFilterRow = {
  name: L; handle: string; status: string; school: string | null; schoolId: string | null; track: string | null; seasons: number[];
  teams: string[]; createdAt: string; lastSeenAt: string | null; activeSemesters: string[];
};

/** `by` says which date the range applies to: when the person joined, or when they were last seen. */
export function filterMembers<T extends MemberFilterRow>(rows: T[], s: ListState, by: "joined" | "seen" = "joined"): T[] {
  const { status = [], school = [], track = [], semester = [], season = [], team = [] } = s.multi;
  return rows.filter((m) =>
    hits(status, (v) => m.status === v)
    && hits(school, (v) => (v === "num" ? m.schoolId === "num" : m.schoolId !== "num"))
    && hits(track, (v) => (v === "unknown" ? m.track === null : m.track === v))
    && hits(semester, (v) => m.activeSemesters.includes(v))
    && hits(season, (v) => m.seasons.includes(Number(v)))
    && hits(team, (v) => m.teams.includes(v))
    && inRange(by === "joined" ? m.createdAt : m.lastSeenAt, s)
    && matchesText(s.q, [m.name.mn, m.name.en, m.school, m.handle]));
}

// ── applications ─────────────────────────────────────────────────────────────────────────────────────────────────

export type ApplicationFilterRow = { name: L; handle: string; school: string | null; schoolId: string | null; track: string | null; createdAt: string };
export function filterApplications<T extends ApplicationFilterRow>(rows: T[], s: ListState): T[] {
  const { school = [], track = [] } = s.multi;
  return rows.filter((a) =>
    hits(school, (v) => (v === "num" ? a.schoolId === "num" : a.schoolId !== "num"))
    && hits(track, (v) => (v === "unknown" ? a.track === null : a.track === v))
    && inRange(a.createdAt, s)
    && matchesText(s.q, [a.name.mn, a.name.en, a.school, a.handle]));
}

// ── event registrations ──────────────────────────────────────────────────────────────────────────────────────────

export type RegFilterRow = { name: L; school: string | null; status: string; teamId: string | null; createdAt: string; answers: Record<string, unknown> };
/** Answer filters use the chip-group key `a_<questionId>` with option indexes as values. */
export const ANSWER_PREFIX = "a_";

export function filterRegistrations<T extends RegFilterRow>(rows: T[], s: ListState): T[] {
  const status = s.multi.status ?? [];
  const team = s.multi.team ?? [];
  const answerGroups = Object.entries(s.multi).filter(([k, v]) => k.startsWith(ANSWER_PREFIX) && v.length > 0);
  return rows.filter((r) => {
    // Without a status chip, "everyone" leaves out people who cancelled (they have their own chip).
    if (status.length === 0 ? r.status === "cancelled" : !status.includes(r.status)) return false;
    if (team.length === 1 && (team[0] === "team") !== (r.teamId !== null)) return false;
    if (!inRange(r.createdAt, s)) return false;
    if (!matchesText(s.q, [r.name.mn, r.name.en, r.school])) return false;
    return answerGroups.every(([k, wanted]) => {
      const a = r.answers[k.slice(ANSWER_PREFIX.length)];
      return Array.isArray(a) ? a.some((x) => wanted.includes(String(x))) : typeof a === "string" && wanted.includes(a);
    });
  });
}

// ── comms ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type CommsFilterRow = { template: string; group: string; recipient: string; scheduledAt: string; sentAt: string | null };
export function filterComms<T extends CommsFilterRow>(rows: T[], s: ListState): T[] {
  const { status = [], template = [] } = s.multi;
  return rows.filter((r) =>
    hits(status, (v) => r.group === v)
    && hits(template, (v) => r.template === v)
    && inRange(r.sentAt ?? r.scheduledAt, s)
    && matchesText(s.q, [r.recipient]));
}

// ── events ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type EventFilterRow = { title: L; slug: string; stored: string; kind: string; scope?: string; applied: number; cover: string | null; noEnTitle: boolean };
const PRESET_TEST: Record<string, (r: EventFilterRow) => boolean> = {
  applications: (r) => r.stored === "published" && r.applied > 0,
  missing_cover: (r) => (r.stored === "draft" || r.stored === "published") && !r.cover,
  needs_en: (r) => (r.stored === "draft" || r.stored === "published") && r.noEnTitle,
};
export function filterEvents<T extends EventFilterRow>(rows: T[], s: ListState): T[] {
  const { status = [], kind = [], scope = [] } = s.multi;
  const preset = s.single.filter ? PRESET_TEST[s.single.filter] : null;
  return rows.filter((r) =>
    (!preset || preset(r))
    && hits(status, (v) => r.stored === v)
    && hits(kind, (v) => r.kind === v)
    && hits(scope, (v) => (v === "num" ? r.scope === "num" : r.scope !== "num"))
    && matchesText(s.q, [r.title.mn, r.title.en, r.slug]));
}
