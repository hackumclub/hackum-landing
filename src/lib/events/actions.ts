"use server";
// Server Actions for the organizer's event screens. Thin wrappers: staff check first, shape/size guard on anything
// that crossed the network, then the business rule via act() (runs as the current persona; the rules re-check staff).
import { err, type Result } from "@/lib/result";
import { eventInputSchema } from "@/lib/events/admin-form";
import { log } from "@/lib/log";
import { createEvent, previewEventChange, setEventStatus, updateEvent } from "@/lib/mockdb/events";
import { decideRegistrations, sendDecisions } from "@/lib/mockdb/registrations";
import { act, requireStaffAction } from "@/lib/server/session";
import type { EventStatus } from "@/lib/status";

const SETTABLE: readonly EventStatus[] = ["draft", "published", "cancelled", "completed", "archived"];
const MAX_IDS = 1000;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

function trace<T>(message: string, fields: Record<string, string | number | boolean | null>, r: Result<T>): Result<T> {
  log(r.ok ? "INFO" : "WARN", "events.actions", message, crypto.randomUUID(), { ...fields, outcome: r.ok ? "ok" : r.error });
  return r;
}

export async function createEventAction(input: unknown): Promise<Result<{ id: string }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const r = await act((ctx) => createEvent(ctx, parsed.data));
  return trace("event_created", { event_id: r.ok ? r.data.id : null }, r);
}

/** Dry run for a staged edit: which fields changed that notify people, and how many would get an updated invite. */
export async function previewEventChangeAction(id: string, input: unknown): Promise<Result<{ changed: string[]; willNotify: number; nonNumRegistrants: number }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = eventInputSchema.safeParse(input);
  if (!isId(id) || !parsed.success) return err("invalid");
  return act((ctx) => previewEventChange(ctx, id, parsed.data));
}

export async function updateEventAction(id: string, input: unknown): Promise<Result<{ notified: number }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = eventInputSchema.safeParse(input);
  if (!isId(id) || !parsed.success) return err("invalid");
  const r = await act((ctx) => updateEvent(ctx, id, parsed.data));
  return trace("event_updated", { event_id: id, notified: r.ok ? r.data.notified : null }, r);
}

export async function setEventStatusAction(id: string, status: string): Promise<Result<void>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  if (!isId(id) || !SETTABLE.includes(status as EventStatus)) return err("invalid");
  const r = await act((ctx) => setEventStatus(ctx, id, status as EventStatus));
  return trace("event_status_set", { event_id: id, status }, r);
}

export async function decideAction(input: { ids: string[]; decision: "accept" | "reject" | "waitlist"; scope: "individual" | "team" }): Promise<Result<{ changed: number }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const { ids, decision, scope } = input;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every(isId)) return err("invalid");
  if (!["accept", "reject", "waitlist"].includes(decision) || !["individual", "team"].includes(scope)) return err("invalid");
  const r = await act((ctx) => decideRegistrations(ctx, { ids, decision, scope }));
  return trace("registrations_decided", { decision, scope, count: ids.length }, r);
}

export async function sendDecisionsAction(eventId: string): Promise<Result<{ queued: number }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  if (!isId(eventId)) return err("invalid");
  const r = await act((ctx) => sendDecisions(ctx, { eventId }));
  return trace("decisions_sent", { event_id: eventId, queued: r.ok ? r.data.queued : null }, r);
}
