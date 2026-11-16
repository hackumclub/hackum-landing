import type { L, Locale } from "@/i18n/config";

// Dashboard data. Until Supabase (plan Tasks 1–5) lands this serves SAMPLE data with the exact shape the real
// v_kpis / v_event_stats queries will return; `sample: true` makes the UI say so. Replace the body of
// getDashboard(), not its return type.

export const ATTENTION_ORDER = ["failed_emails", "pending_applications", "pending_members", "missing_cover", "needs_en"] as const;
export type AttentionKind = (typeof ATTENTION_ORDER)[number];
export type AttentionItem = { kind: AttentionKind; count: number; href: string };

const ATTENTION_PATH: Record<AttentionKind, string> = {
  failed_emails: "/admin/comms?status=failed",
  pending_applications: "/admin/events?filter=applications",
  pending_members: "/admin/members/applications",
  missing_cover: "/admin/events?filter=missing_cover",
  needs_en: "/admin/events?filter=needs_en",
};

/** Non-zero counts only, most urgent first (failed emails block people from getting invites). */
export function toAttention(raw: Partial<Record<AttentionKind, number>>, lang: Locale): AttentionItem[] {
  return ATTENTION_ORDER.filter((k) => (raw[k] ?? 0) > 0).map((k) => ({ kind: k, count: raw[k]!, href: `/${lang}${ATTENTION_PATH[k]}` }));
}

export type KpiDelta = { kind: "pct"; text: string; trend: "up" | "down" | "flat" } | { kind: "new"; trend: "up" };

/** Change vs the previous period. A zero baseline is "new", never Infinity/NaN. Uses U+2212 for the minus sign. */
export function kpiDelta(current: number, previous: number): KpiDelta {
  if (previous === 0) return current > 0 ? { kind: "new", trend: "up" } : { kind: "pct", text: "0%", trend: "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { kind: "pct", text: "0%", trend: "flat" };
  return { kind: "pct", text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`, trend: pct > 0 ? "up" : "down" };
}

export type Kpis = { activeMembers90d: number; upcomingEvents: number; rsvps30d: number; rsvpsPrev30d: number; membersTotal: number; guestsTotal: number };
export type UpcomingEvent = {
  id: string; slug: string; title: L; kind: "hackathon" | "workshop" | "meetup" | "competition" | "knowledge_day" | "outing" | "other";
  status: "draft" | "published"; startsAt: Date; regMode: "rsvp" | "application"; going: number; applied: number; capacity: number | null;
};
type Raw = { kpis: Kpis; upcoming: UpcomingEvent[]; attention: Partial<Record<AttentionKind, number>> };
export type Dashboard = { kpis: Kpis; upcoming: UpcomingEvent[]; attention: AttentionItem[]; sample: boolean };
export type Scenario = "default" | "empty" | "error" | "slow";

const DAY = 86_400_000;
/** Sample start time: `days` from now at a UB wall-clock hour (UB = UTC+8). */
function at(now: Date, days: number, ubHour: number, ubMin = 0) {
  const d = new Date(now.getTime() + days * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), ubHour - 8, ubMin));
}

function sample(now: Date): Raw {
  const upcoming: UpcomingEvent[] = [
    { id: "e3", slug: "devhack-2027", title: { mn: "DevHack 2027", en: "DevHack 2027" }, kind: "hackathon", status: "published", startsAt: at(now, 75, 9), regMode: "application", going: 0, applied: 64, capacity: 120 },
    { id: "e1", slug: "knowledge-day-rag", title: { mn: "Knowledge Day #6: RAG чатбот бүтээх", en: "Knowledge Day #6: Build a RAG chatbot" }, kind: "knowledge_day", status: "published", startsAt: at(now, 4, 18, 30), regMode: "rsvp", going: 52, applied: 0, capacity: 60 },
    { id: "e4", slug: "c-battle-winter", title: { mn: "C Battle · Өвөл", en: "" }, kind: "competition", status: "draft", startsAt: at(now, 30, 14), regMode: "rsvp", going: 0, applied: 0, capacity: 40 },
    { id: "e2", slug: "alumni-night", title: { mn: "Tech Meetup: Төгсөгчидтэй үдэш", en: "Tech Meetup: Alumni night" }, kind: "meetup", status: "published", startsAt: at(now, 11, 19), regMode: "rsvp", going: 23, applied: 0, capacity: null },
  ];
  return {
    kpis: { activeMembers90d: 86, upcomingEvents: upcoming.length, rsvps30d: 112, rsvpsPrev30d: 74, membersTotal: 142, guestsTotal: 231 },
    upcoming: upcoming.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    attention: { pending_applications: 64, pending_members: 7, missing_cover: 1, needs_en: 1 },
  };
}

/** `scenario` exists so every state (empty / loading / error) can be reviewed before real data exists. */
export async function getDashboard({ lang = "mn", scenario = "default", now = new Date() }: { lang?: Locale; scenario?: Scenario; now?: Date } = {}): Promise<Dashboard> {
  if (scenario === "error") throw new Error("dashboard_unavailable");
  if (scenario === "slow") await new Promise((r) => setTimeout(r, 1500));
  const raw: Raw = scenario === "empty"
    ? { kpis: { activeMembers90d: 0, upcomingEvents: 0, rsvps30d: 0, rsvpsPrev30d: 0, membersTotal: 0, guestsTotal: 0 }, upcoming: [], attention: {} }
    : sample(now);
  return { ...raw, attention: toAttention(raw.attention, lang), sample: true };
}
