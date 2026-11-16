import { semesterOf, type Semester } from "@/lib/semester";
import { toUbInput } from "@/lib/time";
import type { MajorTrack, SchoolId } from "@/lib/num/schools";
import type { Db, EventKind, EventRow } from "./types";

export type DateRange = { from: string; to: string }; // UB calendar days, inclusive
export type Analytics = {
  registrationsByDay: { day: string; n: number }[];
  funnel: { registered: number; going: number; attended: number };
  showRateByKind: { kind: EventKind; rate: number | null; n: number }[];
  membersBySchool: { school_id: SchoolId | "unknown"; n: number }[];
  membersByTrack: { track: MajorTrack | "unknown"; n: number }[];
  bySemester: { year: number; term: Semester["term"]; events: number; registrations: number; attended: number }[];
  retention: { cohort: string; returned: number; total: number }[];
};

const MAX_DAYS = 800; // a guard, not a feature: stops an absurd range from allocating forever
const ubDay = (iso: string) => toUbInput(new Date(iso)).slice(0, 10);
const semKey = (s: Semester) => s.year * 2 + (s.term === "autumn" ? 0 : 1); // chronological: autumn Y, then spring Y (Jan Y+1)
const semName = (s: Semester) => `${s.year}-${s.term}`;

function days(range: DateRange): string[] {
  const out: string[] = [];
  const end = Date.parse(`${range.to}T00:00:00Z`);
  for (let t = Date.parse(`${range.from}T00:00:00Z`); t <= end && out.length < MAX_DAYS; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Counts people, biggest first; the "unknown" bucket (not filled in yet) always sorts after real values on ties. */
export function tally<K extends string>(keys: (K | null)[]): { key: K | "unknown"; n: number }[] {
  const m = new Map<K | "unknown", number>();
  for (const k of keys) m.set(k ?? "unknown", (m.get(k ?? "unknown") ?? 0) + 1);
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || Number(a.key === "unknown") - Number(b.key === "unknown"));
}

export function analytics(db: Db, range: DateRange): Analytics {
  const inRange = (e: EventRow) => { const d = ubDay(e.starts_at); return d >= range.from && d <= range.to; };
  const events = db.events.filter(inRange);
  const byEvent = new Map(events.map((e) => [e.id, e]));
  const regs = db.registrations.filter((r) => byEvent.has(r.event_id) && r.status !== "cancelled");

  const funnel = {
    registered: regs.length,
    going: regs.filter((r) => r.status === "going" || r.status === "attended").length,
    attended: regs.filter((r) => r.status === "attended").length,
  };

  const kinds = [...new Set(events.map((e) => e.kind))];
  const showRateByKind = kinds.map((kind) => {
    const done = events.filter((e) => e.kind === kind && e.status === "completed");
    const seats = regs.filter((r) => done.some((e) => e.id === r.event_id) && ["attended", "no_show", "going"].includes(r.status));
    const attended = seats.filter((r) => r.status === "attended").length;
    return { kind, rate: seats.length ? attended / seats.length : null, n: done.length };
  });

  const perDay = new Map<string, number>();
  for (const r of db.registrations) perDay.set(ubDay(r.created_at), (perDay.get(ubDay(r.created_at)) ?? 0) + 1);
  const registrationsByDay = days(range).map((day) => ({ day, n: perDay.get(day) ?? 0 }));

  const people = db.profiles.filter((p) => !p.deleted_at);
  const membersBySchool = tally<SchoolId>(people.map((p) => p.school_id)).map(({ key, n }) => ({ school_id: key, n }));
  const membersByTrack = tally<MajorTrack>(people.map((p) => p.major_track)).map(({ key, n }) => ({ track: key, n }));

  const sem = new Map<number, Analytics["bySemester"][number]>();
  for (const e of events) {
    const s = semesterOf(new Date(e.starts_at));
    const row = sem.get(semKey(s)) ?? { year: s.year, term: s.term, events: 0, registrations: 0, attended: 0 };
    row.events += 1;
    row.registrations += regs.filter((r) => r.event_id === e.id).length;
    row.attended += regs.filter((r) => r.event_id === e.id && r.status === "attended").length;
    sem.set(semKey(s), row);
  }
  const bySemester = [...sem.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  const attendedIn = new Map<string, Set<number>>(); // profile → semesters attended
  for (const r of regs.filter((x) => x.status === "attended")) {
    const set = attendedIn.get(r.profile_id) ?? new Set<number>();
    set.add(semKey(semesterOf(new Date(byEvent.get(r.event_id)!.starts_at))));
    attendedIn.set(r.profile_id, set);
  }
  const cohorts = new Map<number, { total: number; returned: number }>();
  for (const set of attendedIn.values()) {
    const first = Math.min(...set);
    const c = cohorts.get(first) ?? { total: 0, returned: 0 };
    c.total += 1;
    if ([...set].some((k) => k > first)) c.returned += 1;
    cohorts.set(first, c);
  }
  const retention = [...cohorts.entries()].sort((a, b) => a[0] - b[0]).map(([k, c]) => ({ cohort: semName({ year: Math.floor(k / 2), term: k % 2 === 0 ? "autumn" : "spring" }), ...c }));

  return { registrationsByDay, funnel, showRateByKind, membersBySchool, membersByTrack, bySemester, retention };
}
