// Pure URL <-> filter state for every admin list (members, registrations, comms, audit, events). The URL is the one
// source of truth: it survives reloads and the language switch, it can be shared, and a dashboard link is just a URL.
// Everything read from it is untrusted: unknown values are dropped, never thrown on.
import { isIsoDate } from "@/lib/date-range";

/** Allowed values: a fixed list (canonical order) or a predicate (input order). */
export type Allowed = readonly string[] | ((v: string) => boolean);
export type ListSpec = {
  /** `?q=` free text. */
  search?: boolean;
  /** `?from=&to=` (UB calendar days, inclusive). */
  dates?: boolean;
  /** Chip groups: `?status=a,b`. */
  multi?: Readonly<Record<string, Allowed>>;
  /** Exactly one value: a preset or a view (`?filter=`, `?tab=`). */
  single?: Readonly<Record<string, Allowed>>;
};
export type ListState = {
  q: string;
  from: string | null;
  to: string | null;
  page: number;
  multi: Record<string, string[]>;
  single: Record<string, string | null>;
};
export type RawParams = URLSearchParams | Readonly<Record<string, string | string[] | undefined>>;

export const MAX_QUERY = 80;
export const MAX_PAGE = 10_000;

const first = (raw: RawParams, key: string): string | undefined => {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
};
const allows = (a: Allowed, v: string) => (typeof a === "function" ? a(v) : a.includes(v));

export function emptyListState(spec: ListSpec): ListState {
  return {
    q: "", from: null, to: null, page: 1,
    multi: Object.fromEntries(Object.keys(spec.multi ?? {}).map((k) => [k, [] as string[]])),
    single: Object.fromEntries(Object.keys(spec.single ?? {}).map((k) => [k, null])),
  };
}

export function parseListState(raw: RawParams, spec: ListSpec): ListState {
  const state = emptyListState(spec);
  if (spec.search) state.q = (first(raw, "q") ?? "").trim().slice(0, MAX_QUERY);
  for (const [key, allowed] of Object.entries(spec.multi ?? {})) {
    const picked = [...new Set((first(raw, key) ?? "").split(",").map((v) => v.trim()).filter((v) => v !== "" && allows(allowed, v)))];
    state.multi[key] = typeof allowed === "function" ? picked : allowed.filter((v) => picked.includes(v));
  }
  for (const [key, allowed] of Object.entries(spec.single ?? {})) {
    const v = (first(raw, key) ?? "").trim();
    state.single[key] = v !== "" && allows(allowed, v) ? v : null;
  }
  if (spec.dates) {
    const from = first(raw, "from"), to = first(raw, "to");
    if (from && to && isIsoDate(from) && isIsoDate(to) && from <= to) { state.from = from; state.to = to; }
  }
  const page = first(raw, "page");
  if (page !== undefined && /^\d{1,9}$/.test(page)) state.page = Math.min(Math.max(1, Number(page)), MAX_PAGE);
  return state;
}

/** Canonical order: q, chip groups, single values, from, to, page. Page 1 is never written. */
export function serializeListState(state: ListState, spec: ListSpec): URLSearchParams {
  const p = new URLSearchParams();
  const q = state.q.trim().slice(0, MAX_QUERY);
  if (spec.search && q) p.set("q", q);
  for (const key of Object.keys(spec.multi ?? {})) {
    const v = state.multi[key] ?? [];
    if (v.length) p.set(key, v.join(","));
  }
  for (const key of Object.keys(spec.single ?? {})) {
    const v = state.single[key];
    if (v) p.set(key, v);
  }
  if (spec.dates && state.from && state.to) { p.set("from", state.from); p.set("to", state.to); }
  if (state.page > 1) p.set("page", String(Math.min(state.page, MAX_PAGE)));
  return p;
}

/** The query string (no "?") for `state`, keeping parameters this list does not own (`tab`, `state`, …). */
export function mergeIntoQuery(existing: string | URLSearchParams, state: ListState, spec: ListSpec): string {
  const out = new URLSearchParams(typeof existing === "string" ? existing : existing.toString());
  const owned = ["page", ...(spec.search ? ["q"] : []), ...(spec.dates ? ["from", "to"] : []), ...Object.keys(spec.multi ?? {}), ...Object.keys(spec.single ?? {})];
  for (const k of owned) out.delete(k);
  for (const [k, v] of serializeListState(state, spec)) out.set(k, v);
  return out.toString();
}

/** Active filters: the search, each selected chip, each single value and the date range count once. */
export function activeCount(state: ListState, ignore: readonly string[] = []): number {
  const multi = Object.entries(state.multi).reduce((n, [k, v]) => (ignore.includes(k) ? n : n + v.length), 0);
  const single = Object.entries(state.single).reduce((n, [k, v]) => (v && !ignore.includes(k) ? n + 1 : n), 0);
  return (state.q.trim() ? 1 : 0) + multi + single + (state.from && state.to ? 1 : 0);
}
