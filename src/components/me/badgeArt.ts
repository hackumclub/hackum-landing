import type { BadgeId } from "@/lib/me/badges";

/** Badge art: the generated emblems in /public/img/badges, one PNG per badge id (see docs/design/codex-asset-prompts.md). */
export const BADGE_ART: Record<BadgeId, string> = {
  "first-event": "first-event",
  regular: "regular",
  hackathon: "hackathon",
  feedback: "feedback",
  "two-seasons": "two-seasons",
  organizer: "organizer",
  mentor: "mentor",
  "team-player": "team-player",
  winner: "winner",
  "early-bird": "early-bird",
};
