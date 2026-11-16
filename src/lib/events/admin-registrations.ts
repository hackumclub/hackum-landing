// Pure selectors for the Registrations tab. Rows are plain JSON so they cross the server → client boundary as props.
// `acceptImpact` mirrors the capacity rule in decideRegistrations (the rule still has the last word: error "full").
import type { L } from "@/i18n/config";
import type { Answers } from "@/lib/events/questions";
import { registrationsView } from "@/lib/mockdb/queries";
import type { Db } from "@/lib/mockdb/types";
import type { MemberStatus, RegStatus } from "@/lib/status";

export type RegRow = {
  id: string;
  profileId: string;
  name: L;
  avatar: string | null;
  school: string | null;
  major: string | null;
  gradYear: number | null;
  memberStatus: MemberStatus;
  status: RegStatus;
  teamId: string | null;
  createdAt: string;
  decidedAt: string | null;
  notified: boolean;
  answers: Answers;
  /** Events this person attended before (a returning-guest signal for reviewers). */
  attended: number;
};
export type TeamRow = { id: string; name: string; captainId: string; lookingFor: string[]; locked: boolean; memberIds: string[] };

export function buildRegistrations(db: Db, eventId: string): { rows: RegRow[]; teams: TeamRow[] } {
  const rows = registrationsView(db, eventId)
    .map(({ registration: r, profile: p }): RegRow => ({
      id: r.id, profileId: p.id, name: p.name, avatar: p.avatar_path, school: p.school, major: p.major, gradYear: p.grad_year, memberStatus: p.status,
      status: r.status, teamId: r.team_id, createdAt: r.created_at, decidedAt: r.decided_at, notified: !!r.decision_notified_at, answers: r.answers,
      attended: db.registrations.filter((o) => o.profile_id === p.id && o.event_id !== eventId && o.status === "attended").length,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const teams = db.teams
    .filter((t) => t.event_id === eventId)
    .map((t): TeamRow => ({ id: t.id, name: t.name, captainId: t.captain_profile_id, lookingFor: t.looking_for, locked: t.locked, memberIds: rows.filter((r) => r.teamId === t.id).map((r) => r.id) }));
  return { rows, teams };
}

export type Segment = "all" | RegStatus;
export type RowFilter = { segment: Segment; team: "any" | "team" | "solo"; q: string; answers: Record<string, string[]> };

/** Tab counts. "All" leaves out people who cancelled; they have their own tab. */
export function segmentCounts(rows: RegRow[]): Record<Segment, number> {
  const c: Record<Segment, number> = { all: 0, applied: 0, going: 0, waitlisted: 0, rejected: 0, cancelled: 0, attended: 0, no_show: 0 };
  for (const r of rows) {
    c[r.status]++;
    if (r.status !== "cancelled") c.all++;
  }
  return c;
}

const norm = (s: string) => s.toLowerCase().trim();

export function filterRows(rows: RegRow[], f: RowFilter): RegRow[] {
  const q = norm(f.q);
  const active = Object.entries(f.answers).filter(([, v]) => v.length > 0);
  return rows.filter((r) => {
    if (f.segment === "all" ? r.status === "cancelled" : r.status !== f.segment) return false;
    if (f.team === "team" && !r.teamId) return false;
    if (f.team === "solo" && r.teamId) return false;
    if (q && ![r.name.mn, r.name.en, r.school ?? ""].some((s) => norm(s).includes(q))) return false;
    return active.every(([qid, wanted]) => {
      const a = r.answers[qid];
      return Array.isArray(a) ? a.some((x) => wanted.includes(x)) : typeof a === "string" && wanted.includes(a);
    });
  });
}

/** Decided (accepted / rejected / waitlisted) but not yet emailed: what "Send decisions" would send. */
export function pendingDecisions(rows: RegRow[]) {
  const waiting = rows.filter((r) => r.decidedAt && !r.notified);
  const n = (s: RegStatus) => waiting.filter((r) => r.status === s).length;
  const out = { accepted: n("going"), rejected: n("rejected"), waitlisted: n("waitlisted"), total: 0 };
  out.total = out.accepted + out.rejected + out.waitlisted;
  return out;
}

const FINAL: RegStatus[] = ["cancelled", "attended", "no_show"];

/**
 * What accepting `ids` would do to the seat count. `ids` is the scope-expanded set the rule will touch;
 * `over` is how many seats short it would be (0 = fits, always 0 when capacity is unlimited).
 */
export function acceptImpact(rows: RegRow[], ids: string[], scope: "individual" | "team", capacity: number | null) {
  const picked = new Set(ids);
  let touched = rows.filter((r) => picked.has(r.id));
  if (scope === "team") {
    const teams = new Set(touched.map((r) => r.teamId).filter((t): t is string => !!t));
    touched = [...new Set([...touched, ...rows.filter((r) => r.teamId && teams.has(r.teamId) && (r.status === "applied" || r.status === "waitlisted"))])];
  }
  touched = touched.filter((r) => !FINAL.includes(r.status));
  const adding = touched.filter((r) => r.status !== "going").length;
  const taken = rows.filter((r) => r.status === "going" || r.status === "attended").length;
  return { ids: touched.map((r) => r.id), adding, taken, over: capacity === null ? 0 : Math.max(0, taken + adding - capacity) };
}
