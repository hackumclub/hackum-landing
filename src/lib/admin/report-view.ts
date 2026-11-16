// Pure view-model helpers for the event and period reports: every number a report prints goes through here, so a
// missing value reads "n/a" and never "NaN", "Infinity" or "undefined".
import { fill } from "@/i18n/config";
import type { copy as reportCopy } from "@/i18n/areas/admin-reports";
import type { PeriodReport, EventReport } from "@/lib/mockdb/reports";
import type { DateRange } from "@/lib/date-range";
import type { Db } from "@/lib/mockdb/types";
import { toUbInput } from "@/lib/time";
import { showRate } from "@/lib/admin/analytics-view";
import type { BarGroup } from "@/components/charts/BarChart";

type C = (typeof reportCopy)["en"];
const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const pctOrNa = (v: number | null | undefined, na: string): string => (finite(v) ? `${Math.round(v * 100)}%` : na);
export const ratingOrNa = (v: number | null | undefined, na: string): string => (finite(v) ? v.toFixed(1) : na);
/** "+42", "−8" (a real minus sign), "0". */
export const npsOrNa = (v: number | null | undefined, na: string): string => {
  if (!finite(v)) return na;
  const n = Math.round(v);
  return n === 0 ? "0" : n > 0 ? `+${n}` : `−${Math.abs(n)}`;
};
export const ratioOf = (part: number, whole: number): number | null => (finite(part) && finite(whole) && whole > 0 ? part / whole : null);

/** "Hackum report — Pitch Night": also the file name Chrome suggests for Save as PDF. */
export const docTitle = (template: string, name: string): string => fill(template, { name });

/** A file-name fragment: letters and digits of any script, single dashes, no dots or slashes, at most 60 characters. */
export function fileSafe(s: string): string {
  const out = s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return out || "report";
}

export type Kpi = { key: string; label: string; value: string; hint?: string };

export function eventKpis(r: EventReport, c: C): Kpi[] {
  const k = c.event.kpi;
  const na = c.na;
  const f = r.feedback;
  return [
    { key: "registered", label: k.registered, value: String(r.funnel.registered) },
    { key: "going", label: k.going, value: String(r.funnel.going) },
    { key: "attended", label: k.attended, value: String(r.funnel.attended) },
    { key: "showRate", label: k.showRate, value: pctOrNa(r.showRate, na), hint: k.showRateHint },
    { key: "rating", label: k.rating, value: ratingOrNa(f.avgRating, na), hint: f.avgRating === null ? undefined : k.ratingHint },
    { key: "nps", label: k.nps, value: npsOrNa(f.nps, na), hint: f.nps === null ? undefined : k.npsHint },
    { key: "responseRate", label: k.responseRate, value: pctOrNa(f.responseRate, na), hint: f.n > 0 ? fill(k.responseHint, { n: f.n }) : undefined },
  ];
}

const ubDay = (iso: string) => toUbInput(new Date(iso)).slice(0, 10);

/** People who attended at least one completed event in the range, counted once. */
export function uniqueAttendees(db: Db, range: DateRange): number {
  const done = new Set(db.events.filter((e) => e.status === "completed" && ubDay(e.starts_at) >= range.from && ubDay(e.starts_at) <= range.to).map((e) => e.id));
  return new Set(db.registrations.filter((r) => r.status === "attended" && done.has(r.event_id)).map((r) => r.profile_id)).size;
}

export function periodKpis(r: PeriodReport, db: Db, c: C): Kpi[] {
  const k = c.period.kpi;
  const na = c.na;
  return [
    { key: "events", label: k.events, value: String(r.events.length) },
    { key: "attendees", label: k.attendees, value: String(uniqueAttendees(db, r.range)) },
    { key: "showRate", label: k.showRate, value: pctOrNa(showRate(db, r.range), na) },
    { key: "newMembers", label: k.newMembers, value: String(r.newMembers) },
    { key: "rating", label: k.rating, value: ratingOrNa(r.feedback.avgRating, na), hint: r.feedback.avgRating === null ? undefined : c.event.kpi.ratingHint },
    { key: "nps", label: k.nps, value: npsOrNa(r.feedback.nps, na), hint: r.feedback.nps === null ? undefined : c.event.kpi.npsHint },
  ];
}

/** Rating distribution as bar groups, 5 stars first. */
export const ratingBars = (distribution: readonly number[], label: (stars: number) => string): BarGroup[] =>
  [5, 4, 3, 2, 1].map((n) => ({ key: String(n), label: label(n), values: [distribution[n - 1] ?? 0] }));
