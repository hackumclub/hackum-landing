// Club facts and bilingual content data, sourced from the "hackum-club" Figma file (Introduction deck,
// brand guideline) and the public @hackumclub Instagram. UI copy lives in src/i18n; this file holds data.
import type { L } from "@/i18n/config";

const P = "/img/club";

export const CLUB = {
  name: "Hackum Students Club",
  short: "Hackum",
  founded: 2017,
  socials: [
    ["Instagram", "https://www.instagram.com/hackumclub/"],
    ["Facebook", "https://www.facebook.com/share/1EjHXrvMXp/"],
    ["Threads", "https://www.threads.com/@hackumclub"],
  ],
} as const;

export const INSTAGRAM = CLUB.socials[0][1];

export type Milestone = { year: number; title: L; note?: L; url?: string };
// The timeline itself lives in the database (db.timeline_milestones) and is read by src/lib/public/readers.ts.

export type Shot = { src: string; alt: L; kind: "photo" | "poster" };
const photo = (file: string, mn: string, en: string): Shot => ({ src: `${P}/${file}.jpg`, alt: { mn, en }, kind: "photo" });

/** "Who we are" photo stack on the home page. */
export const WHO_PHOTOS: Shot[] = [
  photo("stage-2025", "Hackum-ийн гишүүд тайзан дээр хамтдаа", "Hackum members together on stage"),
  photo("digitalnum-2024", "Digital NUM 2024 тэмцээний оролцогчид", "Digital NUM 2024 participants"),
  photo("outing-forest", "Гишүүд намрын зугаалгаар ойд", "Members on an autumn trip in the forest"),
];

// Year shown in the footer. Prerender forbids new Date(), so this is a constant: bump it when a new season starts.
export const LATEST_YEAR = 2026;
