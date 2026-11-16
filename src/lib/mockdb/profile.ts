import { err, ok, type Result } from "@/lib/result";
import type { L, Locale } from "@/i18n/config";
import { audit, requireProfile } from "./core";
import type { Ctx, Visibility } from "./types";

const MAX_LINKS = 6;
const LINK_MAX = 200;
const NAME_MAX = 80;

function httpsUrl(v: string): boolean {
  if (v.length > LINK_MAX) return false;
  try { return new URL(v).protocol === "https:"; } catch { return false; }
}

/** The person's own profile basics. School and major go through `updateAcademic`, the photo through `saveAvatar`. */
export function updateProfile(ctx: Ctx, input: { name: L; grad_year: number | null; links: Record<string, string>; visibility: Visibility; locale: Locale }): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const name = { mn: input.name.mn.trim(), en: input.name.en.trim() };
  if (!name.mn || name.mn.length > NAME_MAX || name.en.length > NAME_MAX) return err("invalid");
  if (input.grad_year !== null && (!Number.isInteger(input.grad_year) || input.grad_year < 2000 || input.grad_year > 2040)) return err("invalid");
  if (!["public", "members", "private"].includes(input.visibility) || (input.locale !== "mn" && input.locale !== "en")) return err("invalid");
  const entries = Object.entries(input.links).map(([k, v]) => [k, v.trim()] as const).filter(([, v]) => v !== "");
  if (entries.length > MAX_LINKS || entries.some(([k, v]) => !/^[a-z]{2,20}$/.test(k) || !httpsUrl(v))) return err("invalid");
  Object.assign(me.data, { name, grad_year: input.grad_year, links: Object.fromEntries(entries), visibility: input.visibility, locale: input.locale });
  audit(ctx, "profile.update", "profiles", me.data.id);
  return ok(undefined);
}
