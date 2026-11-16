"use server";
// Server Actions for the admin Polls area. Staff only: a Server Action is a public endpoint, so the page guard is not
// enough. Authorise first, shape-check the payload, then the rule (which re-checks staff, validates again and audits).
import { err, type Result } from "@/lib/result";
import { log } from "@/lib/log";
import { createPoll, setPollStatus, updatePoll } from "@/lib/mockdb/polls";
import type { PollStatus } from "@/lib/mockdb/types";
import { act, requireStaffAction } from "@/lib/server/session";
import { pollInputSchema } from "./schema";

const STATUSES: PollStatus[] = ["draft", "published", "closed"];
const logOutcome = (message: string, r: Result<unknown>, fields: Record<string, string | number> = {}) =>
  log(r.ok ? "INFO" : "WARN", "polls.actions", message, crypto.randomUUID(), { ...fields, outcome: r.ok ? "ok" : r.error });

export async function createPollAction(input: unknown): Promise<Result<{ id: string }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = pollInputSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const r = await act((ctx) => createPoll(ctx, parsed.data));
  logOutcome("poll_created", r, { options: parsed.data.options.length });
  return r;
}

export async function updatePollAction(id: unknown, input: unknown): Promise<Result<void>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return err("invalid");
  const parsed = pollInputSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const r = await act((ctx) => updatePoll(ctx, id, parsed.data));
  logOutcome("poll_updated", r, { options: parsed.data.options.length });
  return r;
}

/** draft → published (notifies the audience), published → closed, closed → published (reopen; nobody is mailed twice). */
export async function setPollStatusAction(id: unknown, status: unknown): Promise<Result<{ notified: number }>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return err("invalid");
  const to = STATUSES.find((s) => s === status);
  if (!to) return err("invalid");
  const r = await act((ctx) => setPollStatus(ctx, id, to));
  logOutcome("poll_status_changed", r, { status: to, notified: r.ok ? r.data.notified : 0 });
  return r;
}
