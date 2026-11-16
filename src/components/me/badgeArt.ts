import type { BadgeId } from "@/lib/me/badges";

/**
 * Badge art lives in ONE place. Today these are the 3D icons in /public/img/icons3d (file name without extension) used
 * as temporary art. When the Codex-generated badge set from docs/design/codex-asset-prompts.md lands, change this
 * mapping (and BadgeArt below) only: nothing else in the app knows where the art comes from.
 */
export const BADGE_ART: Record<BadgeId, string> = {
  "first-event": "star",
  regular: "fire",
  hackathon: "rocket",
  feedback: "chat",
  "two-seasons": "heart",
  organizer: "megaphone",
  mentor: "medal",
  "team-player": "puzzle",
  winner: "trophy",
  "early-bird": "target",
};
