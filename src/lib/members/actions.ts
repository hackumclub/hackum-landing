"use server";
// Server Actions for the Members, Comms and Settings areas. Thin wrappers: every one validates its (untrusted) input,
// then runs a business rule as the current persona through act(); the rules themselves check the staff/admin role.
// Expected failures come back as Result objects with an error code the UI maps to a specific message.
import { z } from "zod";
import { isLocale, type L, type Locale } from "@/i18n/config";
import { renderEmail } from "@/emails/render";
import { err, ok, type Result } from "@/lib/result";
import { grantRole, mergeProfiles, reviewMembership, setMemberStatus, upsertSeason } from "@/lib/mockdb/members";
import { retryNotification } from "@/lib/mockdb/outbox";
import { profileOf } from "@/lib/mockdb/core";
import { getStore } from "@/lib/mockdb/store";
import type { StaffRoleName } from "@/lib/mockdb/types";
import { act, requireStaffAction } from "@/lib/server/session";
import { MEMBER_STATUSES, type ApplicationStatus, type MemberStatus } from "@/lib/status";

const MAX_IDS = 500;
const id = z.string().min(1).max(64);
const isoOrNull = z.union([z.null(), z.string().refine((s) => !Number.isNaN(Date.parse(s)))]);

// ── members ──────────────────────────────────────────────────────────────────────────────────────────────────────

export async function setStatusAction(ids: string[], status: MemberStatus): Promise<Result<{ changed: number }>> {
  const parsed = z.object({ ids: z.array(id).min(1).max(MAX_IDS), status: z.enum(MEMBER_STATUSES) }).safeParse({ ids, status });
  if (!parsed.success) return err("invalid");
  return act((ctx) => setMemberStatus(ctx, { ids: [...new Set(parsed.data.ids)], status: parsed.data.status }));
}

/** Like Result, plus who got there first when two reviewers collide (the card says "Already reviewed by …"). */
export type ReviewResult = Result<void> | { ok: false; error: "conflict"; reviewer: L | null; status: ApplicationStatus };

export async function reviewApplicationAction(input: { id: string; approve: boolean; note: string }): Promise<ReviewResult> {
  const parsed = z.object({ id, approve: z.boolean(), note: z.string().max(1000) }).safeParse(input);
  if (!parsed.success) return err("invalid");
  const result = await act((ctx) => reviewMembership(ctx, parsed.data));
  if (result.ok || result.error !== "conflict") return result;
  const db = getStore().read();
  const app = db.membership_applications.find((a) => a.id === parsed.data.id);
  const reviewer = profileOf(db, app?.reviewed_by ?? null);
  return { ok: false, error: "conflict", reviewer: reviewer ? { mn: reviewer.name.mn || reviewer.handle, en: reviewer.name.en || reviewer.name.mn || reviewer.handle } : null, status: app?.status ?? "pending" };
}

export async function mergeProfilesAction(keep: string, drop: string): Promise<Result<void>> {
  const parsed = z.object({ keep: id, drop: id }).safeParse({ keep, drop });
  if (!parsed.success || parsed.data.keep === parsed.data.drop) return err("invalid");
  return act((ctx) => mergeProfiles(ctx, parsed.data));
}

// ── settings ─────────────────────────────────────────────────────────────────────────────────────────────────────

const seasonSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  label: z.object({ mn: z.string().trim().min(1).max(80), en: z.string().trim().max(80) }),
  application_opens_at: isoOrNull,
  application_closes_at: isoOrNull,
  is_current: z.boolean(),
}).refine((s) => (s.application_opens_at === null) === (s.application_closes_at === null), "window needs both ends");
export type SeasonInput = z.input<typeof seasonSchema>;

export async function upsertSeasonAction(input: SeasonInput): Promise<Result<void>> {
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return err("invalid");
  const s = parsed.data;
  return act((ctx) => upsertSeason(ctx, {
    year: s.year, label: s.label, is_current: s.is_current,
    application_opens_at: s.application_opens_at ? new Date(s.application_opens_at).toISOString() : null,
    application_closes_at: s.application_closes_at ? new Date(s.application_closes_at).toISOString() : null,
  }));
}

/**
 * Grant, change or remove a staff role (admin only). The rule already refuses removing the last admin or your own admin
 * role; changing an admin's role to organizer is the same loss of access, so the same guard applies here.
 */
export async function grantRoleAction(profileId: string, role: StaffRoleName | null): Promise<Result<void>> {
  const parsed = z.object({ profileId: id, role: z.enum(["organizer", "admin"]).nullable() }).safeParse({ profileId, role });
  if (!parsed.success) return err("invalid");
  return act((ctx) => {
    const target = ctx.db.staff_roles.find((r) => r.profile_id === parsed.data.profileId);
    if (target?.role === "admin" && parsed.data.role !== "admin" && parsed.data.role !== null) {
      const admins = ctx.db.staff_roles.filter((r) => r.role === "admin").length;
      if (parsed.data.profileId === ctx.actor || admins <= 1) return err("conflict");
    }
    return grantRole(ctx, parsed.data);
  });
}

// ── comms ────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function retryNotificationAction(notificationId: string): Promise<Result<void>> {
  const parsed = id.safeParse(notificationId);
  if (!parsed.success) return err("invalid");
  return act((ctx) => retryNotification(ctx, { id: parsed.data }));
}

export type TickResult = { reminders: number; sent: number; skipped: number; failed: number; deferred: number };

/** One dispatcher beat on demand (what the cron job does every minute in production). Staff only. */
export async function sendQueuedNowAction(): Promise<Result<TickResult>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const r = getStore().tickNow();
  return ok({ reminders: r.reminders, sent: r.sent, skipped: r.skipped, failed: r.failed, deferred: r.deferred });
}

export type EmailPreview = {
  template: string;
  lang: Locale;
  subject: string;
  html: string;
  text: string;
  recipient: string;
  invite: { method: "REQUEST" | "CANCEL"; title: string; start: string; end: string; location: string; sequence: number } | null;
};

/** Render exactly what the recipient will get. Runs on the server so the payload (and any address) never reaches the browser. */
export async function previewNotificationAction(notificationId: string, lang?: string): Promise<Result<EmailPreview>> {
  const who = await requireStaffAction();
  if (!who.ok) return who;
  const parsedId = id.safeParse(notificationId);
  if (!parsedId.success) return err("invalid");
  const db = getStore().read();
  const n = db.notifications.find((x) => x.id === parsedId.data);
  if (!n) return err("not_found");
  const person = profileOf(db, n.profile_id);
  const payloadLang = typeof n.payload.locale === "string" && isLocale(n.payload.locale) ? n.payload.locale : null;
  const chosen: Locale = lang && isLocale(lang) ? lang : person?.locale ?? payloadLang ?? "mn";
  const subscriber = n.to_email ? db.subscribers.find((s) => s.email.toLowerCase() === n.to_email?.toLowerCase()) : null;
  const rendered = renderEmail(n.template, { ...n.payload, to_name: n.payload.to_name ?? person?.name.mn ?? subscriber?.name ?? null }, chosen);
  const ics = rendered.ics;
  return ok({
    template: n.template, lang: chosen, subject: rendered.subject, html: rendered.html, text: rendered.text,
    recipient: person ? person.name.mn || person.name.en : subscriber?.name ?? "",
    invite: ics ? { method: ics.method === "CANCEL" ? "CANCEL" : "REQUEST", title: ics.title, start: ics.start.toISOString(), end: ics.end.toISOString(), location: ics.location ?? "", sequence: ics.sequence } : null,
  });
}
