"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { PERSONA_COOKIE, requireStaffAction } from "./session";
import { err } from "@/lib/result";

/** Only same-site relative paths are followed after sign-in (no open redirect). */
const safeNext = (next: unknown, lang: string) => (typeof next === "string" && /^\/(mn|en)(\/|$)/.test(next) && !next.startsWith("//") ? next : `/${lang}/me`);

export async function signInAs(formData: FormData) {
  const lang = String(formData.get("lang") ?? "mn");
  const handle = String(formData.get("handle") ?? "");
  const l = isLocale(lang) ? lang : "mn";
  if (!mockEnabled()) redirect(`/${l}`);
  const jar = await cookies();
  if (handle === "") jar.delete(PERSONA_COOKIE);
  else if (getStore().read().profiles.some((p) => p.handle === handle && !p.deleted_at)) jar.set(PERSONA_COOKIE, handle, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  redirect(handle === "" ? `/${l}` : safeNext(formData.get("next"), l));
}

/** Admin-only: put the demo data back to the seed (mock mode only). */
export async function resetDemoData() {
  const who = await requireStaffAction("admin");
  if (!who.ok || !mockEnabled()) return err("forbidden");
  getStore().reset();
  return { ok: true as const, data: undefined };
}
