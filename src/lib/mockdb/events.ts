import { err, ok, type Result } from "@/lib/result";
import type { EventStatus } from "@/lib/status";
import { audit, enqueue, eventOf, eventPayload, iso, nextId, profileOf, requireStaff } from "./core";
import type { Ctx, EventRow } from "./types";

/** Everything an organizer edits. The rest (id, status, ics_sequence, …) is managed by the rules. */
export type EventInput = Omit<EventRow, "id" | "status" | "tz" | "approximate_date" | "legacy_participants" | "ics_sequence" | "created_by" | "created_at">;

/** Changing any of these tells people with a seat (and bumps the calendar invite sequence). */
export const NOTIFY_FIELDS = ["starts_at", "ends_at", "mode", "venue_name", "venue_address", "online_url"] as const;
const EDITABLE: (keyof EventInput)[] = ["slug", "kind", "title", "tagline", "description", "starts_at", "ends_at", "mode", "venue_name", "venue_address", "online_url", "audience", "capacity", "waitlist", "reg_opens_at", "reg_closes_at", "cover_path", "poster_path", "themes", "external_url", "reg_mode", "questions", "team_mode", "team_size_min", "team_size_max", "decision_deadline"];

function valid(i: EventInput): boolean {
  const start = new Date(i.starts_at), end = new Date(i.ends_at);
  if (!/^[a-z0-9-]{3,60}$/.test(i.slug) || !i.title.mn.trim()) return false;
  if (Number.isNaN(+start) || Number.isNaN(+end) || end <= start) return false;
  if (i.capacity !== null && (!Number.isInteger(i.capacity) || i.capacity < 1 || i.capacity > 5000)) return false;
  if (i.reg_closes_at && new Date(i.reg_closes_at) > start) return false;
  if (i.reg_opens_at && i.reg_closes_at && new Date(i.reg_opens_at) > new Date(i.reg_closes_at)) return false;
  if (i.reg_mode === "application" && !i.decision_deadline) return false;
  if (i.team_mode !== "none" && !(i.team_size_min >= 1 && i.team_size_min <= i.team_size_max && i.team_size_max <= 10)) return false;
  if (i.mode !== "offline" && !/^https:\/\//.test(i.online_url ?? "")) return false;
  const ids = new Set<string>();
  if (i.questions.length > 20) return false;
  for (const q of i.questions) {
    if (!/^[a-z0-9_]{1,32}$/.test(q.id) || ids.has(q.id) || !q.label.mn.trim()) return false;
    if ((q.type === "select" || q.type === "multi") && (q.options?.length ?? 0) < 2) return false;
    ids.add(q.id);
  }
  return true;
}

export function createEvent(ctx: Ctx, input: EventInput): Result<{ id: string }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  if (!valid(input)) return err("invalid");
  if (ctx.db.events.some((e) => e.slug === input.slug)) return err("conflict");
  const row: EventRow = { ...structuredClone(input), id: nextId(ctx.db, "e"), status: "draft", tz: "Asia/Ulaanbaatar", approximate_date: false, legacy_participants: null, ics_sequence: 0, created_by: staff.data.id, created_at: iso(ctx.now) };
  ctx.db.events.push(row);
  audit(ctx, "event.create", "events", row.id, { slug: row.slug });
  return ok({ id: row.id });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const changedNotifyFields = (ev: EventRow, i: EventInput) => NOTIFY_FIELDS.filter((k) => !same(ev[k], i[k]));
const seated = (ctx: Ctx, ev: EventRow) => ctx.db.registrations.filter((r) => r.event_id === ev.id && r.status === "going" && profileOf(ctx.db, r.profile_id));

export function previewEventChange(ctx: Ctx, id: string, input: EventInput): Result<{ changed: string[]; willNotify: number }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const ev = eventOf(ctx.db, id);
  if (!ev) return err("not_found");
  if (!valid(input)) return err("invalid");
  const changed = changedNotifyFields(ev, input);
  return ok({ changed: [...changed], willNotify: ev.status === "published" && changed.length ? seated(ctx, ev).length : 0 });
}

export function updateEvent(ctx: Ctx, id: string, input: EventInput): Result<{ notified: number }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const ev = eventOf(ctx.db, id);
  if (!ev) return err("not_found");
  if (!valid(input)) return err("invalid");
  if (ctx.db.events.some((e) => e.slug === input.slug && e.id !== id)) return err("conflict");
  const notifyChanged = changedNotifyFields(ev, input);
  const diff: Record<string, unknown> = {};
  for (const k of EDITABLE) if (!same(ev[k], input[k])) diff[k] = [ev[k], input[k]];
  const timeMoved = !same(ev.starts_at, input.starts_at);
  Object.assign(ev, structuredClone(Object.fromEntries(EDITABLE.map((k) => [k, input[k]]))));
  if (Object.keys(diff).length) audit(ctx, "event.update", "events", id, diff);

  if (timeMoved) skipQueuedReminders(ctx, ev.id, (n) => n.payload.starts_at !== ev.starts_at);
  let notified = 0;
  if (ev.status === "published" && notifyChanged.length) {
    ev.ics_sequence += 1;
    for (const r of seated(ctx, ev)) {
      const p = profileOf(ctx.db, r.profile_id)!;
      if (enqueue(ctx, { profileId: p.id, template: "event_updated", priority: 0, payload: { ...eventPayload(ev, p), changed: notifyChanged.join(",") }, dedupe: `event_updated:${ev.id}:${p.id}:${ev.ics_sequence}` })) notified++;
    }
  }
  return ok({ notified });
}

function skipQueuedReminders(ctx: Ctx, eventId: string, when: (n: Ctx["db"]["notifications"][number]) => boolean) {
  for (const n of ctx.db.notifications) if (n.status === "queued" && n.template === "reminder_24h" && n.payload.event_id === eventId && when(n)) n.status = "skipped";
}

const NEXT: Record<EventStatus, EventStatus[]> = {
  draft: ["published"], published: ["draft", "cancelled", "completed"], cancelled: ["archived"], completed: ["archived"], archived: [],
};

export function setEventStatus(ctx: Ctx, id: string, status: EventStatus): Result<void> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const ev = eventOf(ctx.db, id);
  if (!ev) return err("not_found");
  const live = ctx.db.registrations.filter((r) => r.event_id === id && ["going", "waitlisted", "applied"].includes(r.status));
  if (!NEXT[ev.status].includes(status)) return err("conflict");
  if (status === "draft" && live.length) return err("conflict");
  const from = ev.status;
  ev.status = status;
  if (status === "cancelled") {
    skipQueuedReminders(ctx, id, () => true);
    for (const r of live) {
      const p = profileOf(ctx.db, r.profile_id);
      if (p) enqueue(ctx, { profileId: p.id, template: "event_cancelled", priority: 0, payload: eventPayload(ev, p), dedupe: `event_cancelled:${id}:${p.id}` });
    }
  }
  audit(ctx, "event.status", "events", id, { status: [from, status] });
  return ok(undefined);
}
