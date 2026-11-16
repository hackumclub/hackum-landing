// Pure formatting helpers for the members / comms / settings / audit areas. No React, no store access.
import type { Locale } from "@/i18n/config";
import type { NotifStatus } from "@/lib/mockdb/types";
import { formatUb, toUbInput } from "@/lib/time";

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/** "5 minutes ago" / "yesterday" / "in 2 hours". `now` is passed in so server and client render the same text. */
export function relativeTime(then: Date, now: Date, lang: Locale): string {
  const diff = then.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MIN) return lang === "mn" ? "дөнгөж сая" : "just now";
  const sign = Math.sign(diff);
  const [n, unit] = abs < HOUR ? [Math.round(abs / MIN), "minute"] as const
    : abs < DAY ? [Math.round(abs / HOUR), "hour"] as const
    : abs < 30 * DAY ? [Math.round(abs / DAY), "day"] as const
    : [Math.round(abs / (30 * DAY)), "month"] as const;
  if (lang === "mn") {
    // Intl's Mongolian relative-time data is missing in many runtimes (it falls back to English), so the words live here.
    if (unit === "day" && n === 1) return sign < 0 ? "өчигдөр" : "маргааш";
    const word = { minute: "минутын", hour: "цагийн", day: "өдрийн", month: "сарын" }[unit];
    return `${n} ${word} ${sign < 0 ? "өмнө" : "дараа"}`;
  }
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(sign * n, unit);
}

export type SeasonWindow = "open" | "scheduled" | "closed" | "none";
/** Membership-application window: open now, opens later, already closed, or not configured (needs both ends). */
export function seasonWindow(s: { application_opens_at: string | null; application_closes_at: string | null }, now: Date): SeasonWindow {
  if (!s.application_opens_at || !s.application_closes_at) return "none";
  const opens = new Date(s.application_opens_at).getTime(), closes = new Date(s.application_closes_at).getTime();
  const t = now.getTime();
  return t < opens ? "scheduled" : t <= closes ? "open" : "closed";
}

/** "smtp_timeout" → "Smtp timeout": the fallback phrase for a code the copy has no sentence for. */
export const humanizeCode = (code: string) => {
  const s = code.replace(/[_.]+/g, " ").trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : "";
};

// ── audit ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type AuditGroup = "events" | "registrations" | "members" | "staff" | "email" | "other";
export const AUDIT_GROUPS: readonly Exclude<AuditGroup, "other">[] = ["events", "registrations", "members", "staff", "email"];

const GROUP_BY_PREFIX: Record<string, AuditGroup> = {
  event: "events", registration: "registrations", decisions: "registrations",
  membership: "members", member: "members", profile: "members",
  staff: "staff", season: "staff", notification: "email",
};
export const auditGroup = (action: string): AuditGroup => GROUP_BY_PREFIX[action.split(".")[0] ?? ""] ?? "other";

export type EntityKind = "event" | "registration" | "profile" | "application" | "staff_role" | "season" | "notification" | "other";
const ENTITY: Record<string, EntityKind> = {
  event: "event", events: "event",
  registration: "registration", registrations: "registration", event_registrations: "registration",
  profile: "profile", profiles: "profile",
  membership_application: "application", membership_applications: "application",
  staff_role: "staff_role", staff_roles: "staff_role",
  season: "season", seasons: "season",
  notification: "notification", notifications: "notification",
};
export const entityKind = (entity: string): EntityKind => ENTITY[entity] ?? "other";

/** The Ulaanbaatar calendar day ("2026-11-16") an instant falls on: audit rows are grouped by the day the club lived it. */
export const dayKey = (iso: string) => toUbInput(new Date(iso)).slice(0, 10);

/** Consecutive runs of rows that share a UB day; keeps the incoming order (newest first stays newest first). */
export function groupByDay<T extends { at: string }>(rows: T[]): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = [];
  for (const r of rows) {
    const key = dayKey(r.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(r); else groups.push({ key, items: [r] });
  }
  return groups;
}

export type DayRelation = "today" | "yesterday" | "date";
export function dayRelation(key: string, now: Date): DayRelation {
  const today = dayKey(now.toISOString());
  if (key === today) return "today";
  return key === dayKey(new Date(now.getTime() - 86_400_000).toISOString()) ? "yesterday" : "date";
}

export type DiffPair = { key: string; before: unknown; after: unknown; changed: boolean };
/** `{ status: ["draft", "published"] }` is a change; any other value is shown as what was set. */
export function diffPairs(diff: Record<string, unknown>): DiffPair[] {
  return Object.entries(diff).map(([key, v]) =>
    Array.isArray(v) && v.length === 2 ? { key, before: v[0], after: v[1], changed: true } : { key, before: undefined, after: v, changed: false });
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
export function formatDiffValue(v: unknown, lang: Locale, words: { yes: string; no: string; empty: string }): string {
  if (v === null || v === undefined || v === "") return words.empty;
  if (typeof v === "boolean") return v ? words.yes : words.no;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const d = ISO.test(v) ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? formatUb(d, lang, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : v;
  }
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.join(", ");
  return JSON.stringify(v);
}

// ── comms ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type NotifGroup = "queued" | "sent" | "failed" | "skipped";
/** `sending` (in flight) is shown with the queued rows. */
export const notifGroup = (s: NotifStatus): NotifGroup => (s === "sending" ? "queued" : s);

// ── paging ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Clamp `page` (1-based, may be junk from the URL) to the valid range and return the slice bounds. */
export function paginate(total: number, page: number, size: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return { page: p, pages, from: (p - 1) * size, to: Math.min(total, p * size) };
}

// ── seasons ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type SeasonErrors = { year?: "year" | "yearTaken"; label?: "label"; window?: "windowBoth" | "windowOrder" };

/** Client-side check that mirrors the rule (`upsert_season`) so errors appear next to the field before a round trip. */
export function validateSeason(input: { year: string; labelMn: string; opens: Date | null; closes: Date | null }, existingYears: number[], editing: boolean): SeasonErrors {
  const errors: SeasonErrors = {};
  const year = /^\d{4}$/.test(input.year.trim()) ? Number(input.year) : NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = "year";
  else if (!editing && existingYears.includes(year)) errors.year = "yearTaken";
  if (!input.labelMn.trim()) errors.label = "label";
  if ((input.opens === null) !== (input.closes === null)) errors.window = "windowBoth";
  else if (input.opens && input.closes && input.opens.getTime() >= input.closes.getTime()) errors.window = "windowOrder";
  return errors;
}

// ── urls ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** `path` + a query string built from the params that actually have a value (arrays join with commas). */
export function withQuery(path: string, params: Record<string, string | number | string[] | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v.join(",") : v == null ? "" : String(v);
    if (s !== "") q.set(k, s);
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}
