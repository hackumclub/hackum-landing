"use server";
// Server Actions for the announcement composer. Staff only (organizers included): a Server Action is a public
// endpoint, so the page guard is not enough. Authorise first, shape-check the payload with zod, then the rule (which
// re-checks staff, validates again, dedupes by `key`, rate-limits and audits). Never log subjects, bodies or addresses.
import { renderEmail } from "@/emails/render";
import { log } from "@/lib/log";
import { err, ok, type Result } from "@/lib/result";
import { audienceSize, sendAnnouncement } from "@/lib/mockdb/announce";
import { getStore } from "@/lib/mockdb/store";
import { DAILY_LIMIT, RESERVED_FOR_TRANSACTIONAL } from "@/lib/mockdb/outbox";
import { act, requireStaffAction } from "@/lib/server/session";
import { audienceSchema, previewSchema, sendSchema } from "./schema";

export type SendOutcome = { queued: number; optedOut: number; days: number };
export type SizeOutcome = { total: number; willReceive: number; optedOut: number; perDay: number; reserved: number };
export type PreviewOutcome = { subject: string; html: string };

const PLAN = { perDay: DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL, reserved: RESERVED_FOR_TRANSACTIONAL };

export async function sendAnnouncementAction(input: unknown): Promise<Result<SendOutcome>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { audience, ...rest } = parsed.data;
  const a = audience.kind === "event" ? { ...audience, statuses: [...new Set(audience.statuses)] } : audience;
  const r = await act((ctx) => sendAnnouncement(ctx, { ...rest, audience: a }));
  log(r.ok ? "INFO" : "WARN", "announce.actions", "announcement_send", crypto.randomUUID(), {
    audience: a.kind, outcome: r.ok ? "ok" : r.error, queued: r.ok ? r.data.queued : 0, opted_out: r.ok ? r.data.optedOut : 0,
  });
  return r;
}

/** Read-only: who is in the audience and who will actually get it. Staff only, so it cannot be used to count members. */
export async function audienceSizeAction(audience: unknown): Promise<Result<SizeOutcome>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = audienceSchema.safeParse(audience);
  if (!parsed.success) return err("invalid");
  return ok({ ...audienceSize(getStore().read(), parsed.data), ...PLAN });
}

/** The real rendered email (what recipients get), rendered on the server so the links use the site origin. */
export async function previewAnnouncementAction(input: unknown): Promise<Result<PreviewOutcome>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const { subject, body, lang } = parsed.data;
  const r = renderEmail("announcement", { subject_mn: subject.mn.trim(), subject_en: subject.en.trim(), body_mn: body.mn.trim(), body_en: body.en.trim(), to_name: "" }, lang);
  return ok({ subject: r.subject, html: r.html });
}
