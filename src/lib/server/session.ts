import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { err, type Result } from "@/lib/result";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import type { Ctx, StaffRoleName } from "@/lib/mockdb/types";
import type { MemberStatus } from "@/lib/status";

// MOCK AUTH. Same names and shapes the Clerk-backed versions will have (plan Task 5: getSession / requireSession /
// requireStaffPage / requireStaffAction), so pages and actions written against these do not change when Clerk lands.
// "Signed in" here = a dev persona cookie; see /[lang]/sign-in.
export const PERSONA_COOKIE = "hackum-dev-as";

export type Session = { profileId: string; handle: string; status: MemberStatus; staffRole: StaffRoleName | null; locale: Locale; onboarded: boolean };

export const getActorId = cache(async (): Promise<string | null> => {
  if (!mockEnabled()) return null;
  const handle = (await cookies()).get(PERSONA_COOKIE)?.value;
  if (!handle) return null;
  return getStore().read().profiles.find((p) => p.handle === handle && !p.deleted_at)?.id ?? null;
});

export const getSession = cache(async (): Promise<Session | null> => {
  const id = await getActorId();
  if (!id) return null;
  const db = getStore().read();
  const p = db.profiles.find((x) => x.id === id);
  if (!p) return null;
  return { profileId: p.id, handle: p.handle, status: p.status, staffRole: db.staff_roles.find((r) => r.profile_id === p.id)?.role ?? null, locale: p.locale, onboarded: !!p.onboarded_at };
});

/** Pages: signed-out visitors go to sign-in and come back; people who have not finished onboarding go there first. */
export async function requireSession(lang: Locale, next: string, opts: { onboarded?: boolean } = { onboarded: true }): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/${lang}/sign-in?next=${encodeURIComponent(next)}`);
  if (opts.onboarded !== false && !s.onboarded) redirect(`/${lang}/me/onboarding?next=${encodeURIComponent(next)}`);
  return s;
}

/** Admin pages: anyone who is not staff gets the ordinary 404, so the backoffice is invisible to them. */
export async function requireStaffPage(role?: "admin"): Promise<Session> {
  const s = await getSession();
  if (!s || !s.staffRole || (role === "admin" && s.staffRole !== "admin")) notFound();
  return s;
}

export async function requireStaffAction(role?: "admin"): Promise<Result<Session>> {
  const s = await getSession();
  if (!s) return err("unauthenticated");
  if (!s.staffRole || (role === "admin" && s.staffRole !== "admin")) return err("forbidden");
  return { ok: true, data: s };
}

/**
 * Run a business rule as the current user (the mock of calling a Supabase RPC with the user's token).
 * Server Actions only: a successful write expires the cached public pages straight away (read-your-own-writes).
 */
export async function act<T>(rule: (ctx: Ctx) => Result<T>): Promise<Result<T>> {
  if (!mockEnabled()) return err("server");
  const result = getStore().mutate(rule, await getActorId());
  if (result.ok) { updateTag("events"); updateTag("members"); updateTag("timeline"); }
  return result;
}
