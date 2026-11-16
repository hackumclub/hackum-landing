import type { L, Locale } from "@/i18n/config";
import { goingCount } from "@/lib/mockdb/core";
import { attentionCounts, kpis, upcomingEvents } from "@/lib/mockdb/queries";
import { getStore } from "@/lib/mockdb/store";

// Dashboard data, read from the local mock database (src/lib/mockdb). Same shapes the real v_kpis / v_event_stats
// queries will return; `sample: true` makes the UI say it is demo data. Swap fromDb(), not getDashboard()'s type.

export const ATTENTION_ORDER = ["failed_emails", "pending_applications", "pending_members", "missing_cover", "needs_en"] as const;
export type AttentionKind = (typeof ATTENTION_ORDER)[number];
export type AttentionItem = { kind: AttentionKind; count: number; href: string };

const ATTENTION_PATH: Record<AttentionKind, string> = {
  failed_emails: "/admin/comms?status=failed",
  pending_applications: "/admin/events?filter=applications",
  pending_members: "/admin/members?tab=applications",
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

function fromDb(now: Date): Raw {
  const store = getStore();
  const db = store.read();
  const upcoming: UpcomingEvent[] = upcomingEvents(db, now).slice(0, 6).map((e) => ({
    id: e.id, slug: e.slug, title: e.title, kind: e.kind, status: e.status === "draft" ? "draft" : "published", startsAt: new Date(e.starts_at), regMode: e.reg_mode,
    going: goingCount(db, e.id), applied: db.registrations.filter((r) => r.event_id === e.id && r.status === "applied").length, capacity: e.capacity,
  }));
  return { kpis: kpis(db, now), upcoming, attention: attentionCounts(db) };
}

/** `scenario` exists so every state (empty / loading / error) can be reviewed against the local mock database. */
export async function getDashboard({ lang = "mn", scenario = "default", now }: { lang?: Locale; scenario?: Scenario; now?: Date } = {}): Promise<Dashboard> {
  if (scenario === "error") throw new Error("dashboard_unavailable");
  if (scenario === "slow") await new Promise((r) => setTimeout(r, 1500));
  const raw: Raw = scenario === "empty"
    ? { kpis: { activeMembers90d: 0, upcomingEvents: 0, rsvps30d: 0, rsvpsPrev30d: 0, membersTotal: 0, guestsTotal: 0 }, upcoming: [], attention: {} }
    : fromDb(now ?? getStore().now());
  return { ...raw, attention: toAttention(raw.attention, lang), sample: true };
}
