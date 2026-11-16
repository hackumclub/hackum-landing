"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { isLocale, type Locale } from "@/i18n/config";
import { landingPath } from "@/lib/auth/landing";
import { log } from "@/lib/log";
import { requestEmailCode, signInWithPasskey, verifyEmailCode } from "@/lib/mockdb/auth";
import { createAccount, validateJoin, type JoinFieldErrors, type JoinInput } from "@/lib/mockdb/ext-join";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { err, type ErrorCode } from "@/lib/result";
import { PERSONA_COOKIE, requireStaffAction } from "./session";
import type { AcademicInput } from "@/lib/mockdb/academic";

// MOCK AUTH. These actions stand in for Clerk's email-code, passkey and sign-up flows (same limits, same failure modes);
// the session is the persona cookie. A failure is returned (never thrown) so the form can show it beside the field;
// a success sets the cookie and redirects, so the caller only ever sees errors.

const localeOf = (lang: unknown): Locale => (typeof lang === "string" && isLocale(lang) ? lang : "mn");
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");
const RID = "n/a"; // no request-scoped id exists in the mock; the field is required by the logging standard

export type AuthFailure = { ok: false; error: ErrorCode; fields?: JoinFieldErrors };
const fail = (error: ErrorCode): AuthFailure => ({ ok: false, error });
export type SendResult = { ok: true; devCode?: string } | AuthFailure;

/** Sets the session for a profile and returns where they go next. */
async function startSession(profileId: string, lang: Locale, next: unknown): Promise<string> {
  const db = getStore().read();
  const p = db.profiles.find((x) => x.id === profileId);
  if (!p) throw new Error("profile_missing_after_sign_in");
  (await cookies()).set(PERSONA_COOKIE, p.handle, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  return landingPath(lang, next, { staff: db.staff_roles.some((r) => r.profile_id === p.id), onboarded: !!p.onboarded_at });
}

/** Sends the 6-digit code. Only in mock mode is the code handed back, so the demo can show it ("Dev: your code is …"). */
export async function requestCodeAction(input: { email: string; lang: string }): Promise<SendResult> {
  if (!mockEnabled()) return fail("server");
  const r = getStore().mutate((ctx) => requestEmailCode(ctx, str(input.email, 254)), null);
  if (!r.ok) {
    if (r.error === "rate_limited") log("WARN", "auth.actions", "code_send_rate_limited", RID);
    return { ok: false, error: r.error };
  }
  return { ok: true, devCode: r.data.code };
}

export async function verifyCodeAction(input: { email: string; code: string; lang: string; next?: string | null }): Promise<AuthFailure> {
  if (!mockEnabled()) return fail("server");
  const lang = localeOf(input.lang);
  const r = getStore().mutate((ctx) => verifyEmailCode(ctx, str(input.email, 254), str(input.code, 12)), null);
  if (!r.ok) {
    if (r.error === "rate_limited") log("WARN", "auth.actions", "code_attempts_exhausted", RID);
    return { ok: false, error: r.error };
  }
  log("INFO", "auth.actions", "sign_in_with_code", RID);
  redirect(await startSession(r.data.profile_id, lang, input.next));
}

/** Mock of discoverable-credential sign-in: only an account that registered a passkey can use it. */
export async function passkeyAction(input: { email: string; lang: string; next?: string | null }): Promise<AuthFailure> {
  if (!mockEnabled()) return fail("server");
  const lang = localeOf(input.lang);
  const r = getStore().mutate((ctx) => signInWithPasskey(ctx, str(input.email, 254)), null);
  if (!r.ok) return { ok: false, error: r.error };
  log("INFO", "auth.actions", "sign_in_with_passkey", RID);
  redirect(await startSession(r.data.profile_id, lang, input.next));
}

export type JoinFormInput = {
  lang: string;
  email: string;
  name: { mn: string; en: string };
  academic: AcademicInput;
  answers: Record<string, unknown>;
  motivation: string;
  team_interest: string[];
  membership_answers: Record<string, unknown>;
  next?: string | null;
};

const joinOf = (i: JoinFormInput): JoinInput => ({
  email: str(i.email, 254),
  locale: localeOf(i.lang),
  name: { mn: str(i.name?.mn, 120), en: str(i.name?.en, 120) },
  academic: { ...i.academic, school_name: str(i.academic?.school_name, 120), major_label: str(i.academic?.major_label, 120), program_index: i.academic?.program_index ? str(i.academic.program_index, 40) : null },
  answers: i.answers ?? {},
  motivation: str(i.motivation, 1200),
  team_interest: Array.isArray(i.team_interest) ? i.team_interest.filter((t): t is string => typeof t === "string").slice(0, 6) : [],
  membership_answers: i.membership_answers ?? {},
});

/** Step 1 of Join: validate the whole form (nothing is created, no code is spent), then send the code. */
export async function startJoinAction(input: JoinFormInput): Promise<SendResult> {
  if (!mockEnabled()) return fail("server");
  const join = joinOf(input);
  const db = getStore().read();
  const v = validateJoin(db, getStore().now(), join);
  if (!v.ok) return { ok: false, error: "invalid", fields: v.errors };
  return requestCodeAction({ email: join.email, lang: join.locale });
}

/** Step 2 of Join: the code proves the address, then the account and everything the person filled in are written in one go. */
export async function createAccountAction(input: JoinFormInput & { code: string }): Promise<AuthFailure> {
  if (!mockEnabled()) return fail("server");
  const join = joinOf(input);
  const store = getStore();
  const r = store.mutate((ctx) => createAccount(ctx, str(input.code, 12), join), null);
  if (!r.ok) {
    const fields = r.error === "invalid" ? (() => { const v = validateJoin(store.read(), store.now(), join); return v.ok ? undefined : v.errors; })() : undefined;
    return { ok: false, error: r.error, ...(fields ? { fields } : {}) };
  }
  if (r.data.created) { updateTag("members"); updateTag("events"); }
  log("INFO", "auth.actions", r.data.created ? "account_created" : "join_signed_in_existing", RID, { membership: r.data.membership });
  redirect(await startSession(r.data.profile_id, join.locale, input.next));
}

export async function signOutAction(input: { lang: string }): Promise<void> {
  (await cookies()).delete(PERSONA_COOKIE);
  redirect(`/${localeOf(input.lang)}`);
}

/** Demo accounts picker (dev only, F-29). An unknown handle comes back to the picker with a visible message (F-06). */
export async function signInAs(formData: FormData) {
  const l = localeOf(formData.get("lang"));
  const handle = String(formData.get("handle") ?? "");
  if (!mockEnabled()) redirect(`/${l}`);
  const jar = await cookies();
  if (handle === "") { jar.delete(PERSONA_COOKIE); redirect(`/${l}`); }
  const p = getStore().read().profiles.find((x) => x.handle === handle && !x.deleted_at);
  if (!p) {
    const q = new URLSearchParams({ error: "unknown" });
    const asked = formData.get("next");
    if (typeof asked === "string" && asked) q.set("next", asked);
    redirect(`/${l}/sign-in?${q.toString()}`);
  }
  jar.set(PERSONA_COOKIE, p.handle, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  const staff = getStore().read().staff_roles.some((r) => r.profile_id === p.id);
  redirect(landingPath(l, formData.get("next"), { staff, onboarded: true })); // the demo picker lands as it always did, onboarded or not
}

/** Admin-only: put the demo data back to the seed (mock mode only). */
export async function resetDemoData() {
  const who = await requireStaffAction("admin");
  if (!who.ok || !mockEnabled()) return err("forbidden");
  getStore().reset();
  return { ok: true as const, data: undefined };
}
