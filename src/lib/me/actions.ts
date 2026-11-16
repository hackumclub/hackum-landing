"use server";
// Server Actions for the signed-in person (public event page + /me). Thin wrappers: authentication is the persona
// cookie (mock) → Clerk later; every business rule lives in src/lib/mockdb/*.ts and is unit-tested there.
import type { Locale } from "@/i18n/config";
import { err, type Result } from "@/lib/result";
import { parseAnswers } from "@/lib/events/questions";
import { applyForMembership, completeOnboarding, updatePrefs } from "@/lib/mockdb/members";
import { cancelRegistration, joinTeam, leaveTeam, registerForEvent, type TeamChoice } from "@/lib/mockdb/registrations";
import { getStore } from "@/lib/mockdb/store";
import type { NotifPrefs, Visibility } from "@/lib/mockdb/types";
import type { RegStatus } from "@/lib/status";
import { act } from "@/lib/server/session";

/** Like Result, plus per-question error codes ("required" | "too_long" | "bad_url" | "bad_option") keyed by question id. */
export type ApplyResult = Result<{ status: RegStatus; teamId?: string; inviteCode?: string }> | { ok: false; error: "invalid"; fields: Record<string, string> };

export async function rsvp(eventId: string): Promise<Result<{ status: RegStatus }>> {
  return act((ctx) => registerForEvent(ctx, { eventId, answers: {} }));
}
export async function cancelRsvp(eventId: string): Promise<Result<void>> {
  return act((ctx) => cancelRegistration(ctx, { eventId }));
}

/** Hackathon-style application: validates answers against the event's questions first, then applies (and joins/creates a team). */
export async function applyToEvent(input: { eventId: string; answers: unknown; team?: TeamChoice }): Promise<ApplyResult> {
  const event = getStore().read().events.find((e) => e.id === input.eventId);
  if (!event) return err("not_found");
  const parsed = parseAnswers(event.questions, input.answers);
  if (!parsed.ok) return { ok: false, error: "invalid", fields: parsed.errors };
  return act((ctx) => registerForEvent(ctx, { eventId: input.eventId, answers: parsed.data, team: input.team }));
}

export async function joinTeamByCode(code: string): Promise<Result<{ teamId: string }>> {
  return act((ctx) => joinTeam(ctx, { code }));
}
export async function leaveTeamAction(teamId: string): Promise<Result<void>> {
  return act((ctx) => leaveTeam(ctx, { teamId }));
}

export async function completeOnboardingAction(input: { name: { mn: string; en: string }; school: string; grad_year: number; locale: Locale }): Promise<Result<void>> {
  return act((ctx) => completeOnboarding(ctx, input));
}
export async function updatePrefsAction(input: { notif_prefs: NotifPrefs; locale: Locale; visibility: Visibility }): Promise<Result<void>> {
  return act((ctx) => updatePrefs(ctx, input));
}
export async function applyForMembershipAction(input: { motivation: string; team_interest: string[] }): Promise<Result<{ id: string }>> {
  return act((ctx) => applyForMembership(ctx, input));
}
