import type { L } from "@/i18n/config";
import { toUbInput } from "@/lib/time";
import type { MajorTrack, SchoolId } from "@/lib/num/schools";
import { analytics, tally, type Analytics, type DateRange } from "./analytics";
import { eventOf, profileOf } from "./core";
import { feedbackSummary, type FeedbackSummary } from "./feedback";
import { pollResults } from "./polls";
import type { Db, EventKind, EventRow } from "./types";

const ubDay = (iso: string) => toUbInput(new Date(iso)).slice(0, 10);
const MAX_DAYS = 800;

export type EventReport = {
  event: Pick<EventRow, "id" | "slug" | "title" | "kind" | "starts_at" | "school_scope" | "status">;
  funnel: { registered: number; going: number; attended: number; no_show: number; waitlisted: number };
  showRate: number | null;
  attendeesBySchool: { school_id: SchoolId | "unknown"; n: number }[];
  attendeesByTrack: { track: MajorTrack | "unknown"; n: number }[];
  newVsReturning: { new: number; returning: number };
  registrationsByDay: { day: string; n: number }[];
  feedback: FeedbackSummary;
};

/** Everything the event report page prints. Null for an unknown event. */
export function eventReport(db: Db, eventId: string): EventReport | null {
  const ev = eventOf(db, eventId);
  if (!ev) return null;
  const regs = db.registrations.filter((r) => r.event_id === ev.id && r.status !== "cancelled");
  const count = (...s: string[]) => regs.filter((r) => s.includes(r.status)).length;
  const attendedRegs = regs.filter((r) => r.status === "attended");
  const seats = count("attended", "no_show", "going");
  const attendees = attendedRegs.map((r) => profileOf(db, r.profile_id)).filter((p): p is NonNullable<typeof p> => !!p);

  let returning = 0;
  for (const r of attendedRegs) {
    const before = db.registrations.some((x) => x.profile_id === r.profile_id && x.status === "attended" && x.event_id !== ev.id && (eventOf(db, x.event_id)?.starts_at ?? "") < ev.starts_at);
    if (before) returning += 1;
  }

  const perDay = new Map<string, number>();
  for (const r of regs) perDay.set(ubDay(r.created_at), (perDay.get(ubDay(r.created_at)) ?? 0) + 1);
  const keys = [...perDay.keys()].sort();
  const registrationsByDay: EventReport["registrationsByDay"] = [];
  if (keys.length) {
    const end = Date.parse(`${[ubDay(ev.starts_at), keys[keys.length - 1]].sort().pop()}T00:00:00Z`);
    for (let t = Date.parse(`${keys[0]}T00:00:00Z`); t <= end && registrationsByDay.length < MAX_DAYS; t += 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      registrationsByDay.push({ day, n: perDay.get(day) ?? 0 });
    }
  }

  return {
    event: { id: ev.id, slug: ev.slug, title: ev.title, kind: ev.kind, starts_at: ev.starts_at, school_scope: ev.school_scope, status: ev.status },
    funnel: { registered: regs.length, going: count("going", "attended"), attended: attendedRegs.length, no_show: count("no_show"), waitlisted: count("waitlisted") },
    showRate: ev.status === "completed" && seats ? attendedRegs.length / seats : null,
    attendeesBySchool: tally<SchoolId>(attendees.map((p) => p.school_id)).map(({ key, n }) => ({ school_id: key, n })),
    attendeesByTrack: tally<MajorTrack>(attendees.map((p) => p.major_track)).map(({ key, n }) => ({ track: key, n })),
    newVsReturning: { new: attendedRegs.length - returning, returning },
    registrationsByDay,
    feedback: feedbackSummary(db, ev.id),
  };
}

export type PeriodReport = {
  range: DateRange;
  analytics: Analytics;
  events: { id: string; slug: string; title: L; kind: EventKind; starts_at: string; attended: number; registered: number; responses: number; rating: number | null; nps: number | null }[];
  polls: { id: string; title: L; voters: number; eligible: number; turnout: number | null }[];
  feedback: { responses: number; avgRating: number | null; nps: number | null };
  newMembers: number;
};

/** The semester or year report: analytics plus per-event feedback, closed-poll turnout and approved applications. */
export function periodReport(db: Db, range: DateRange, now: Date): PeriodReport {
  const inRange = (iso: string) => { const d = ubDay(iso); return d >= range.from && d <= range.to; };
  const events = db.events.filter((e) => e.status === "completed" && inRange(e.starts_at)).map((e) => {
    const regs = db.registrations.filter((r) => r.event_id === e.id && r.status !== "cancelled");
    const f = feedbackSummary(db, e.id);
    return { id: e.id, slug: e.slug, title: e.title, kind: e.kind, starts_at: e.starts_at, attended: regs.filter((r) => r.status === "attended").length, registered: regs.length, responses: f.n, rating: f.avgRating, nps: f.nps };
  }).sort((a, b) => b.attended - a.attended || b.starts_at.localeCompare(a.starts_at));

  const rows = db.event_feedback.filter((f) => events.some((e) => e.id === f.event_id));
  const promoters = rows.filter((r) => r.nps >= 9).length, detractors = rows.filter((r) => r.nps <= 6).length;

  const polls = db.polls.filter((p) => p.status !== "draft" && inRange(p.created_at) && (p.status === "closed" || (!!p.closes_at && now >= new Date(p.closes_at)))).map((p) => {
    const r = pollResults(db, p.id, null, now)!;
    return { id: p.id, title: p.title, voters: r.voters, eligible: r.eligible, turnout: r.turnout };
  });

  return {
    range, analytics: analytics(db, range), events, polls,
    feedback: {
      responses: rows.length,
      avgRating: rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null,
      nps: rows.length ? Math.round(((promoters - detractors) / rows.length) * 100) : null,
    },
    newMembers: db.membership_applications.filter((a) => a.status === "approved" && !!a.reviewed_at && inRange(a.reviewed_at)).length,
  };
}
