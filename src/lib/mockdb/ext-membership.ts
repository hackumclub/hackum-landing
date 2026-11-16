import { err, ok, type Result } from "@/lib/result";
import { audit, iso, nextId, notifyStaff, requireProfile } from "./core";
import { openSeason } from "./members";
import type { Ctx } from "./types";

export const RENEWAL_NOTE = "Renewal";

/**
 * A current member asks to stay for the season whose application window is open. `applyForMembership` refuses members
 * (`conflict`), so renewal is its own rule: same queue for staff (a pending application; approving it adds the season),
 * no motivation text. Errors: conflict (not a member, already renewed or already applied for that season), closed.
 */
export function renewMembership(ctx: Ctx, input: { team_interest?: string[] } = {}): Result<{ id: string }> {
  const me = requireProfile(ctx, { onboarded: true });
  if (!me.ok) return me;
  if (me.data.status !== "member") return err("conflict");
  if (me.data.school_id !== "num") return err("ineligible");
  const season = openSeason(ctx);
  if (!season) return err("closed");
  const year = season.year;
  if (ctx.db.memberships.some((m) => m.profile_id === me.data.id && m.season === year)) return err("conflict");
  if (ctx.db.membership_applications.some((a) => a.profile_id === me.data.id && a.season === year && a.status !== "withdrawn")) return err("conflict");
  const row = { id: nextId(ctx.db, "a"), profile_id: me.data.id, season: year, motivation: RENEWAL_NOTE, team_interest: (input.team_interest ?? []).slice(0, 6), answers: {}, status: "pending" as const, reviewed_by: null, reviewed_at: null, review_note: null, created_at: iso(ctx.now) };
  ctx.db.membership_applications.push(row);
  audit(ctx, "membership.renew", "membership_applications", row.id, { season: year });
  notifyStaff(ctx.db, ctx.now, { kind: "staff_application", payload: { application_id: row.id, profile_id: me.data.id, name: me.data.name.mn || me.data.name.en }, dedupe: `staffapp:${row.id}` });
  return ok({ id: row.id });
}
