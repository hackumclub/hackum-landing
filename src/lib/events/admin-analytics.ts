// Selectors behind the Analytics tab: funnel, show rate, school breakdown, registrations per day.
import { ubDay } from "@/lib/mockdb/core";
import { eventStats } from "@/lib/mockdb/queries";
import type { Db } from "@/lib/mockdb/types";

export type SchoolBar = { school: string | null; n: number; other?: true };

const DAY = 86_400_000;
const LIVE = ["going", "waitlisted", "applied", "attended"];

export function eventAnalytics(db: Db, eventId: string, now: Date) {
  const stats = eventStats(db, eventId);
  const live = db.registrations.filter((r) => r.event_id === eventId && LIVE.includes(r.status));

  const seats = stats.going + stats.attended;
  const funnel = [
    { key: "registered" as const, value: stats.registered },
    { key: "going" as const, value: seats },
    { key: "attended" as const, value: stats.attended },
  ];
  /** Only meaningful once check-in data exists; before that it would read as 0 % and mislead. */
  const showRate = stats.attended > 0 && seats > 0 ? stats.attended / seats : null;

  const counts = new Map<string | null, number>();
  for (const r of live) {
    const school = db.profiles.find((p) => p.id === r.profile_id)?.school?.trim() || null;
    counts.set(school, (counts.get(school) ?? 0) + 1);
  }
  const sorted = [...counts].map(([school, n]): SchoolBar => ({ school, n })).sort((a, b) => b.n - a.n || String(a.school).localeCompare(String(b.school)));
  // Top 6 + "other"; a lone seventh school is shown as itself rather than hidden in a bucket of one.
  const bySchool: SchoolBar[] =
    sorted.length <= 7 ? sorted : [...sorted.slice(0, 6), { school: null, other: true, n: sorted.slice(6).reduce((s, x) => s + x.n, 0) }];

  const perDay = Array.from({ length: 30 }, (_, i) => ({ day: ubDay(new Date(now.getTime() - (29 - i) * DAY)), n: 0 }));
  for (const r of db.registrations) {
    if (r.event_id !== eventId || r.status === "cancelled") continue;
    const slot = perDay.find((d) => d.day === ubDay(new Date(r.created_at)));
    if (slot) slot.n++;
  }

  return {
    stats, funnel, showRate, bySchool, perDay,
    hasData: stats.registered + stats.rejected > 0,
    split: { new: stats.newAttendees, returning: stats.returningAttendees },
  };
}
