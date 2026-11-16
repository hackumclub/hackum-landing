"use server";
// Server Actions for the member's own profile: details, school/major, photo, semester subjects, membership renewal.
// Authorisation = the rule only ever touches the acting profile (`act` runs it as the session's person). Input is shape-checked
// with zod here because it comes from the browser; the business limits (80 chars, 6 https links, 5 MB, magic bytes) live in
// the rules, which stay the single source of truth. Failures come back as a sentence in the person's language, never a code.
import { z } from "zod";
import { isLocale, type Locale } from "@/i18n/config";
import { type ErrorCode, type Result } from "@/lib/result";
import { act } from "@/lib/server/session";
import { saveAvatar, MAX_AVATAR_BYTES } from "@/lib/mockdb/avatars";
import { setSemesterSubjects, updateAcademic } from "@/lib/mockdb/academic";
import { removeAvatar } from "@/lib/mockdb/ext-avatar";
import { renewMembership } from "@/lib/mockdb/ext-membership";
import { updateProfile } from "@/lib/mockdb/profile";
import { MAJOR_TRACK_IDS, SCHOOL_IDS } from "@/lib/num/schools";
import { profileMessage, type ProfileScope } from "./profile-messages";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string };

const short = (n: number) => z.string().max(n);
const ProfileInput = z.object({
  name: z.object({ mn: short(200), en: short(200) }),
  grad_year: z.number().int().nullable(),
  links: z.record(short(40), short(400)),
  visibility: z.enum(["public", "members", "private"]),
  locale: z.enum(["mn", "en"]),
});
const AcademicSchema = z.object({
  school_id: z.enum(SCHOOL_IDS as [string, ...string[]]),
  school_name: short(200),
  major_track: z.enum(MAJOR_TRACK_IDS as [string, ...string[]]),
  program_index: short(40).nullable(),
  major_label: short(200),
});
const SubjectsInput = z.object({ year: z.number().int(), term: z.enum(["autumn", "spring"]), subjects: z.array(short(400)).max(100), shared: z.boolean() });

const localeOf = (v: unknown): Locale => (typeof v === "string" && isLocale(v) ? v : "mn");
const fail = (code: ErrorCode, lang: Locale, scope: ProfileScope): ActionResult<never> => ({ ok: false, error: code, message: profileMessage(code, lang, scope) });

/** Runs a rule as the signed-in person and turns the Result into an ActionResult with the message already chosen. */
async function run<T>(lang: Locale, scope: ProfileScope, rule: Parameters<typeof act<T>>[0]): Promise<ActionResult<T>> {
  const r: Result<T> = await act(rule);
  return r.ok ? r : fail(r.error, lang, scope);
}

export async function updateProfileAction(lang: Locale, input: unknown): Promise<ActionResult> {
  const l = localeOf(lang);
  const p = ProfileInput.safeParse(input);
  if (!p.success) return fail("invalid", l, "profile");
  return run(l, "profile", (ctx) => updateProfile(ctx, p.data));
}

export async function updateAcademicAction(lang: Locale, input: unknown): Promise<ActionResult> {
  const l = localeOf(lang);
  const p = AcademicSchema.safeParse(input);
  if (!p.success) return fail("invalid", l, "academic");
  return run(l, "academic", (ctx) => updateAcademic(ctx, p.data as Parameters<typeof updateAcademic>[1]));
}

export async function setSemesterSubjectsAction(lang: Locale, input: unknown) {
  const l = localeOf(lang);
  const p = SubjectsInput.safeParse(input);
  if (!p.success) return fail("invalid", l, "subjects");
  return run(l, "subjects", (ctx) => setSemesterSubjects(ctx, p.data));
}

/** FormData: `file` (the browser-resized image) and `lang`. The server re-checks type by magic bytes, size and dimensions. */
export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ avatar_path: string }>> {
  const lang = localeOf(formData.get("lang"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_AVATAR_BYTES) return fail("invalid", lang, "avatar");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return run(lang, "avatar", (ctx) => saveAvatar(ctx, bytes, file.type));
}

export async function removeAvatarAction(lang: Locale): Promise<ActionResult> {
  return run(localeOf(lang), "avatar", (ctx) => removeAvatar(ctx));
}

export async function renewMembershipAction(lang: Locale): Promise<ActionResult<{ id: string }>> {
  return run(localeOf(lang), "profile", (ctx) => renewMembership(ctx));
}
