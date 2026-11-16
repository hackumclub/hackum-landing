"use server";
// Read-only helpers for the apply flow that actions.ts does not cover.
import { err, ok, type Result } from "@/lib/result";
import { getStore } from "@/lib/mockdb/store";
import { getActorId } from "@/lib/server/session";

const CODE = /^[A-Z0-9-]{3,16}$/;

/**
 * "Is this invite code usable for this event?": lets the join step show the team's name and free spots before submitting.
 * Reveals only what the code-holder needs (name, size). Errors mirror joinTeam: not_found | closed (team locked) | full.
 * Mock-only: the production version must rate-limit this per user, because a code check is an enumeration oracle.
 */
export async function checkTeamCode(input: { eventId: string; code: string }): Promise<Result<{ name: string; size: number; max: number }>> {
  if (!(await getActorId())) return err("unauthenticated");
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!CODE.test(code)) return err("invalid");
  const db = getStore().read();
  const team = db.teams.find((t) => t.invite_code === code && t.event_id === input.eventId);
  const ev = team && db.events.find((e) => e.id === team.event_id);
  if (!team || !ev) return err("not_found");
  const size = db.registrations.filter((r) => r.team_id === team.id && r.status !== "cancelled").length;
  if (team.locked) return err("closed");
  if (size >= ev.team_size_max) return err("full");
  return ok({ name: team.name, size, max: ev.team_size_max });
}
