import { err, ok, type Result } from "@/lib/result";
import type { L } from "@/i18n/config";
import { enqueue, eventOf, eventPayload, iso, nextId, profileOf, requireProfile } from "./core";
import type { Ctx, Db, EventFeedback, EventRow } from "./types";

export const FEEDBACK_WINDOW_MS = 14 * 86_400_000;
export const FEEDBACK_REQUEST_DELAY_MS = 3_600_000;
const TEXT_MAX = 1000;

export type FeedbackInput = { eventId: string; rating: number; nps: number; went_well: string; improve: string; anonymous: boolean };
export type FeedbackComment = { kind: "well" | "improve"; text: string; at: string; /** null when the answer is anonymous */ author: L | null };
export type FeedbackSummary = {
  n: number; eligible: number; responseRate: number | null; avgRating: number | null;
  /** counts of ratings 1..5 */ distribution: [number, number, number, number, number]; nps: number | null; comments: FeedbackComment[];
};

const seatHolders = (db: Db, ev: EventRow) => db.registrations.filter((r) => r.event_id === ev.id && (r.status === "attended" || r.status === "going") && profileOf(db, r.profile_id));
const windowOpen = (ev: EventRow, now: Date) => ev.status === "completed" && now.getTime() >= new Date(ev.ends_at).getTime() && now.getTime() <= new Date(ev.ends_at).getTime() + FEEDBACK_WINDOW_MS;

export function submitFeedback(ctx: Ctx, input: FeedbackInput): Result<{ id: string }> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const ev = eventOf(ctx.db, input.eventId);
  if (!ev) return err("not_found");
  if (ev.status !== "completed") return err("closed");
  if (!ctx.db.registrations.some((r) => r.event_id === ev.id && r.profile_id === me.data.id && (r.status === "attended" || r.status === "going"))) return err("forbidden");
  if (!windowOpen(ev, ctx.now)) return err("closed");
  const wellText = input.went_well.trim(), improveText = input.improve.trim();
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return err("invalid");
  if (!Number.isInteger(input.nps) || input.nps < 0 || input.nps > 10) return err("invalid");
  if (wellText.length > TEXT_MAX || improveText.length > TEXT_MAX) return err("invalid");
  const row = ctx.db.event_feedback.find((f) => f.event_id === ev.id && f.profile_id === me.data.id);
  const fields = { rating: input.rating, nps: input.nps, went_well: wellText, improve: improveText, anonymous: !!input.anonymous, updated_at: iso(ctx.now) };
  if (row) { Object.assign(row, fields); return ok({ id: row.id }); }
  const created: EventFeedback = { id: nextId(ctx.db, "fb"), event_id: ev.id, profile_id: me.data.id, created_at: iso(ctx.now), ...fields };
  ctx.db.event_feedback.push(created);
  return ok({ id: created.id });
}

export const myFeedback = (db: Db, eventId: string, profileId: string): EventFeedback | null =>
  db.event_feedback.find((f) => f.event_id === eventId && f.profile_id === profileId) ?? null;

/** Staff view of one event's answers. Names appear only on answers the person did not mark anonymous. */
export function feedbackSummary(db: Db, eventId: string): FeedbackSummary {
  const ev = eventOf(db, eventId);
  const rows = db.event_feedback.filter((f) => f.event_id === eventId);
  const eligible = ev && ev.status === "completed" ? seatHolders(db, ev).length : 0;
  const n = rows.length;
  const distribution: FeedbackSummary["distribution"] = [0, 0, 0, 0, 0];
  for (const r of rows) distribution[r.rating - 1] += 1;
  const promoters = rows.filter((r) => r.nps >= 9).length, detractors = rows.filter((r) => r.nps <= 6).length;
  const comments: FeedbackComment[] = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.updated_at.localeCompare(a.r.updated_at) || b.i - a.i)
    .flatMap(({ r }) => {
      const author = r.anonymous ? null : profileOf(db, r.profile_id)?.name ?? null;
      return [
        ...(r.went_well ? [{ kind: "well" as const, text: r.went_well, at: r.updated_at, author }] : []),
        ...(r.improve ? [{ kind: "improve" as const, text: r.improve, at: r.updated_at, author }] : []),
      ];
    });
  return {
    n, eligible, responseRate: eligible ? n / eligible : null,
    avgRating: n ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : null,
    distribution, nps: n ? Math.round(((promoters - detractors) / n) * 100) : null, comments,
  };
}

/** One hour after an event is completed (for 14 days) everyone who came, and has not answered, gets asked once. */
export function enqueueFeedbackRequests(db: Db, now: Date): number {
  const ctx: Ctx = { db, actor: null, now };
  let queued = 0;
  for (const ev of db.events) {
    const end = new Date(ev.ends_at).getTime();
    if (ev.status !== "completed" || now.getTime() < end + FEEDBACK_REQUEST_DELAY_MS || now.getTime() > end + FEEDBACK_WINDOW_MS) continue;
    for (const r of seatHolders(db, ev)) {
      if (myFeedback(db, ev.id, r.profile_id)) continue;
      const p = profileOf(db, r.profile_id)!;
      if (enqueue(ctx, { profileId: p.id, template: "feedback_request", priority: 1, payload: eventPayload(ev, p), dedupe: `feedback:${ev.id}:${p.id}` })) queued++;
    }
  }
  return queued;
}
