import { ok, type Result } from "@/lib/result";
import { audit, requireProfile } from "./core";
import type { Ctx } from "./types";

/** Removes the acting profile's own photo (bytes and pointer). Idempotent: removing nothing is not an error. */
export function removeAvatar(ctx: Ctx): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const had = !!ctx.db.avatars[me.data.id] || me.data.avatar_path !== null;
  delete ctx.db.avatars[me.data.id];
  me.data.avatar_path = null;
  if (had) audit(ctx, "profile.avatar_removed", "profiles", me.data.id);
  return ok(undefined);
}
