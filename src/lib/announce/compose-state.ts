// Pure helpers of the announcement composer: query-param parsing, validity (and the reason Send is disabled), the
// free-plan sentence and the localStorage draft. No React, no server imports: unit-tested in tests/unit/compose-state.test.ts.
import type { AnnounceAudience } from "@/lib/mockdb/announce";
import { fill, type L } from "@/i18n/config";

export const SUBJECT_MAX = 120;
export const BODY_MAX = 5000;
const DRAFT_TEXT_MAX = 20_000;

export const AUDIENCE_KINDS = ["members", "community", "everyone", "subscribers", "event"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];
export const EVENT_STATUSES = ["going", "waitlisted", "applied", "attended"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** What the "Who" step holds: the card picked and, for the event card, the event and statuses. Always renderable. */
export type AudienceChoice = { kind: AudienceKind | null; eventId: string; statuses: EventStatus[] };
export const NO_AUDIENCE: AudienceChoice = { kind: null, eventId: "", statuses: [] };

export type AudienceSize = { total: number; willReceive: number; optedOut: number };

const isKind = (v: unknown): v is AudienceKind => typeof v === "string" && (AUDIENCE_KINDS as readonly string[]).includes(v);
const cleanStatuses = (v: unknown): EventStatus[] => (Array.isArray(v) ? EVENT_STATUSES.filter((s) => v.includes(s)) : []);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?audience=members|community|everyone|subscribers|event&event=<id>&statuses=going,waitlisted`. Untrusted: invalid → default. */
export function parseComposeParams(sp: Readonly<Record<string, string | string[] | undefined>>, knownEventIds: readonly string[]): AudienceChoice {
  const kind = first(sp.audience);
  if (!isKind(kind)) return NO_AUDIENCE;
  if (kind !== "event") return { kind, eventId: "", statuses: [] };
  const ev = first(sp.event) ?? "";
  const statuses = cleanStatuses((first(sp.statuses) ?? "").split(",").map((s) => s.trim()));
  return { kind, eventId: knownEventIds.includes(ev) ? ev : "", statuses: statuses.length ? statuses : ["going"] };
}

/** The audience that matches a members-list status filter (`?status=member,alumni`): nothing or members only → members. */
export function audienceForStatuses(statuses: readonly string[]): "members" | "community" | "everyone" {
  if (statuses.includes("guest")) return "everyone";
  return statuses.includes("alumni") ? "community" : "members";
}

/** The composer's deep link, e.g. from the members list or an event's registrations. */
export const composeHref = (lang: string, q: { audience: AudienceKind; eventId?: string; statuses?: readonly EventStatus[] } = { audience: "members" }) => {
  const params = new URLSearchParams({ audience: q.audience });
  if (q.audience === "event") { if (q.eventId) params.set("event", q.eventId); if (q.statuses?.length) params.set("statuses", q.statuses.join(",")); }
  return `/${lang}/admin/comms/new?${params.toString()}`;
};

/** The domain audience, or null while the choice is incomplete. */
export function toAudience(c: AudienceChoice): AnnounceAudience | null {
  if (!c.kind) return null;
  if (c.kind !== "event") return { kind: c.kind };
  const statuses = cleanStatuses(c.statuses);
  return c.eventId && statuses.length ? { kind: "event", eventId: c.eventId, statuses } : null;
}

export const audienceKey = (a: AnnounceAudience) => (a.kind === "event" ? `event:${a.eventId}:${a.statuses.join(",")}` : a.kind);

export type BlockReason = "audience" | "event" | "statuses" | "subject" | "body" | "subjectLong" | "bodyLong" | "counting" | "nobody" | "sent";

/** Why Send cannot be pressed yet (the first thing to fix), or null when it can. */
export function sendBlock(s: { subject: string; body: string; subjectEn?: string; bodyEn?: string; audience: AudienceChoice; size: AudienceSize | null; /** this exact message already went out: edit it or start a new one */ sent?: boolean }): BlockReason | null {
  if (s.sent) return "sent";
  if (!s.audience.kind) return "audience";
  if (s.audience.kind === "event") {
    if (!s.audience.eventId) return "event";
    if (cleanStatuses(s.audience.statuses).length === 0) return "statuses";
  }
  if (!s.subject.trim()) return "subject";
  if (s.subject.length > SUBJECT_MAX || (s.subjectEn?.length ?? 0) > SUBJECT_MAX) return "subjectLong";
  if (!s.body.trim()) return "body";
  if (s.body.length > BODY_MAX || (s.bodyEn?.length ?? 0) > BODY_MAX) return "bodyLong";
  if (!s.size) return "counting";
  if (s.size.willReceive === 0) return "nobody";
  return null;
}

/** Days the free plan needs for `n` emails at `perDay` a day (at least one). */
export const daysNeeded = (n: number, perDay: number) => (perDay > 0 ? Math.max(1, Math.ceil(n / perDay)) : 1);

export function daysSentence(n: number, plan: { perDay: number; reserved: number }, c: { one: string; other: string }): string {
  const days = daysNeeded(n, plan.perDay);
  return fill(days <= 1 ? c.one : c.other, { days, perDay: plan.perDay, reserved: plan.reserved });
}

// ── draft autosave ───────────────────────────────────────────────────────────────────────────────────────────────

export type Draft = { subject: L; body: L; audience: AudienceChoice };

export const serializeDraft = (d: Draft) => JSON.stringify(d);

const isL = (v: unknown): v is L => !!v && typeof v === "object" && typeof (v as L).mn === "string" && typeof (v as L).en === "string";
const clamp = (l: L): L => ({ mn: l.mn.slice(0, DRAFT_TEXT_MAX), en: l.en.slice(0, DRAFT_TEXT_MAX) });

/** localStorage is user-editable: anything that is not the exact shape gives null, never an exception. */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (!isL(o.subject) || !isL(o.body)) return null;
    const a = (o.audience && typeof o.audience === "object" ? o.audience : {}) as Record<string, unknown>;
    const kind = isKind(a.kind) ? a.kind : null;
    return { subject: clamp(o.subject), body: clamp(o.body), audience: { kind, eventId: typeof a.eventId === "string" ? a.eventId : "", statuses: cleanStatuses(a.statuses) } };
  } catch {
    return null;
  }
}
