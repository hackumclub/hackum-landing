// Member badges: a pure function of the database (spec: profile page, "N to next" ring). No I/O, no clock reads
// except the optional `now` argument, so it is unit-tested against a fixed date and can move into a SQL view later.
import type { Db } from "@/lib/mockdb/types";

export type BadgeId =
  | "first-event" | "regular" | "hackathon" | "feedback" | "two-seasons"
  | "organizer" | "mentor" | "team-player" | "winner" | "early-bird";
export type BadgeTier = "bronze" | "silver" | "gold";
export type Badge = {
  id: BadgeId;
  tier: BadgeTier;
  earned: boolean;
  progress: { have: number; need: number };
  /** Needs a feature that ships in a later slice (event results): shown locked with a "coming soon" label. */
  comingSoon?: true;
};

const HOUR = 3_600_000;
const EARLY_WINDOW_H = 24;
const EARLY_RANK = 10;
const NEED = { regular: 5, twoSeasons: 2, team: 3, feedback: 3 } as const;

const make = (id: BadgeId, tier: BadgeTier, have: number, need: number, extra: { comingSoon?: true } = {}): Badge => ({
  id, tier, earned: have >= need, progress: { have: Math.min(have, need), need }, ...extra,
});

export function computeBadges(db: Db, profileId: string, now: Date = new Date()): Badge[] {
  const mine = db.registrations.filter((r) => r.profile_id === profileId);
  const eventOf = (id: string) => db.events.find((e) => e.id === id);
  const over = (id: string) => { const e = eventOf(id); return !!e && new Date(e.ends_at) <= now; };
  const me = db.profiles.find((p) => p.id === profileId);

  const attended = mine.filter((r) => r.status === "attended");
  const firstEvent = mine.filter((r) => r.status === "attended" || (r.status === "going" && over(r.event_id))).length;
  const hackathons = mine.filter((r) => (r.status === "attended" || r.status === "going") && eventOf(r.event_id)?.kind === "hackathon").length;
  const seasons = new Set(db.memberships.filter((m) => m.profile_id === profileId).map((m) => m.season)).size;
  // "Voice of the club": three event surveys answered (one row per person per event, so this is also three different events).
  const feedbackCount = db.event_feedback.filter((f) => f.profile_id === profileId).length;
  const staff = db.staff_roles.some((r) => r.profile_id === profileId);
  const mentor = me?.status === "alumni" && db.memberships.some((m) => m.profile_id === profileId);

  const teamSizes = mine
    .filter((r) => r.team_id && r.status !== "cancelled")
    .map((r) => db.registrations.filter((o) => o.team_id === r.team_id && o.status !== "cancelled").length);
  const biggestTeam = teamSizes.length ? Math.max(...teamSizes) : 0;

  const earlyBird = mine.some((r) => {
    if (r.status === "cancelled" || r.source !== "web") return false; // staff-added and imported rows say nothing about eagerness
    const ev = eventOf(r.event_id);
    if (!ev) return false;
    const withinWindow = !!ev.reg_opens_at && Date.parse(r.created_at) - Date.parse(ev.reg_opens_at) <= EARLY_WINDOW_H * HOUR && Date.parse(r.created_at) >= Date.parse(ev.reg_opens_at);
    if (withinWindow) return true;
    const rank = db.registrations
      .filter((o) => o.event_id === r.event_id && o.status !== "cancelled" && o.source === "web")
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .findIndex((o) => o.id === r.id);
    return rank >= 0 && rank < EARLY_RANK;
  });

  return [
    make("first-event", "bronze", firstEvent, 1),
    make("regular", "silver", attended.length, NEED.regular),
    make("hackathon", "silver", hackathons, 1),
    make("feedback", "bronze", feedbackCount, NEED.feedback),
    make("two-seasons", "silver", seasons, NEED.twoSeasons),
    make("organizer", "gold", staff ? 1 : 0, 1),
    make("mentor", "gold", mentor ? 1 : 0, 1),
    make("team-player", "bronze", biggestTeam, NEED.team),
    make("winner", "gold", 0, 1, { comingSoon: true }),
    make("early-bird", "bronze", earlyBird ? 1 : 0, 1),
  ];
}
