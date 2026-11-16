import type { Locale } from "@/i18n/config";
import type { DateRange } from "@/lib/date-range";
import type { Analytics } from "@/lib/mockdb/analytics";
import type { Db, EventRow } from "@/lib/mockdb/types";
import { semesterLabel, isTerm, type Semester } from "@/lib/semester";
import { toUbInput } from "@/lib/time";
import { kpiDelta } from "@/lib/admin/dashboard";

const ubDay = (iso: string) => toUbInput(new Date(iso)).slice(0, 10);
const inRange = (e: EventRow, r: DateRange) => { const d = ubDay(e.starts_at); return d >= r.from && d <= r.to; };

/** Attended ÷ (attended + no-show + still "going") over completed events in range; null when none. Same rule as `showRateByKind`. */
export function showRate(db: Db, range: DateRange): number | null {
  const done = new Set(db.events.filter((e) => e.status === "completed" && inRange(e, range)).map((e) => e.id));
  const seats = db.registrations.filter((r) => done.has(r.event_id) && ["attended", "no_show", "going"].includes(r.status));
  return seats.length ? seats.filter((r) => r.status === "attended").length / seats.length : null;
}

export type TopEvent = { id: string; title: EventRow["title"]; kind: EventRow["kind"]; startsAt: string; registered: number; attended: number; rate: number | null };
/** Events in range ranked by registrations (cancelled ignored); `rate` only for completed events. */
export function topEvents(db: Db, range: DateRange, limit = 8): TopEvent[] {
  return db.events.filter((e) => e.status !== "draft" && inRange(e, range)).map((e): TopEvent => {
    const regs = db.registrations.filter((r) => r.event_id === e.id && r.status !== "cancelled");
    const attended = regs.filter((r) => r.status === "attended").length;
    const seats = regs.filter((r) => ["attended", "no_show", "going"].includes(r.status)).length;
    return { id: e.id, title: e.title, kind: e.kind, startsAt: e.starts_at, registered: regs.length, attended, rate: e.status === "completed" && seats ? attended / seats : null };
  }).sort((a, b) => b.registered - a.registered || b.startsAt.localeCompare(a.startsAt)).slice(0, limit);
}

export type DeltaStrings = { deltaNew: string; deltaSrNew: string; deltaSrUp: string; deltaSrDown: string; deltaSrFlat: string };
export type KpiDeltaView = { text: string; trend: "up" | "down" | "flat"; good: boolean; srLabel: string };
const fillPct = (s: string, pct: string) => s.replace("{pct}", pct);

/** Delta chip for a count: "+25%", "−10%", "New" for a zero baseline (never Infinity). */
export function countDelta(current: number, previous: number, t: DeltaStrings): KpiDeltaView {
  const d = kpiDelta(current, previous);
  if (d.kind === "new") return { text: t.deltaNew, trend: "up", good: true, srLabel: t.deltaSrNew };
  const sr = d.trend === "up" ? t.deltaSrUp : d.trend === "down" ? t.deltaSrDown : t.deltaSrFlat;
  return { text: d.text, trend: d.trend, good: d.trend !== "down", srLabel: fillPct(sr, d.text.replace(/^[+−]/, "")) };
}

/** Delta chip for a rate, in percentage points. Null on either side means there is nothing to compare. */
export function rateDelta(current: number | null, previous: number | null, t: DeltaStrings & { pp: string }): KpiDeltaView | undefined {
  if (current === null || previous === null) return undefined;
  const pp = Math.round((current - previous) * 100);
  if (pp === 0) return { text: `0 ${t.pp}`, trend: "flat", good: true, srLabel: t.deltaSrFlat };
  const text = `${pp > 0 ? "+" : "−"}${Math.abs(pp)} ${t.pp}`;
  return { text, trend: pp > 0 ? "up" : "down", good: pp > 0, srLabel: fillPct(pp > 0 ? t.deltaSrUp : t.deltaSrDown, text) };
}

/** "2026-autumn" (the retention cohort key) → "Autumn 2026" / "2026 оны намар". */
export function cohortLabel(key: string, lang: Locale): string {
  const [y, term] = key.split("-");
  const year = Number(y);
  if (!Number.isFinite(year) || !isTerm(term)) return key;
  const s: Semester = { year, term };
  return semesterLabel(s, lang);
}

/** Registrations by weekday (Mon first) from the per-day series; days are UB calendar dates. */
export function byWeekday(series: Analytics["registrationsByDay"]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const p of series) out[(new Date(`${p.day}T00:00:00Z`).getUTCDay() + 6) % 7] += p.n;
  return out;
}

/** Registrations by calendar month ("YYYY-MM"), in order, from the per-day series. */
export function byMonth(series: Analytics["registrationsByDay"]): { month: string; n: number }[] {
  const m = new Map<string, number>();
  for (const p of series) m.set(p.day.slice(0, 7), (m.get(p.day.slice(0, 7)) ?? 0) + p.n);
  return [...m.entries()].map(([month, n]) => ({ month, n }));
}
