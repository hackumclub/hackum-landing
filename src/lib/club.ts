// Club facts and bilingual content data, sourced from the "hackum-club" Figma file (Introduction deck,
// brand guideline) and the public @hackumclub Instagram. UI copy lives in src/i18n; this file holds data.
import type { L } from "@/i18n/config";
import { POSTERS } from "./posters";

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
export const TIMELINE: Milestone[] = [
  { year: 2017, title: { mn: "Hackum үүсэв", en: "Hackum is founded" }, note: { mn: "HACK + NUM: МУИС-д технологид дурлагч оюутнууд нэгдэв", en: "HACK + NUM: tech-loving students team up at NUM" } },
  { year: 2018, title: { mn: "МУИС-н оюутнуудад зориулсан Hackum Chatbot", en: "Hackum Chatbot for NUM students" } },
  { year: 2019, title: { mn: "NUM Open Data Hackathon", en: "NUM Open Data Hackathon" } },
  { year: 2019, title: { mn: "Дижитал мэргэжилтэн", en: "Digital Specialist programme" } },
  { year: 2020, title: { mn: "Тунхаг төсөл", en: "Tunkhag project" }, note: { mn: "Covid & Hackum", en: "Covid & Hackum" }, url: "https://www.facebook.com/tunkhagmn/videos/2527956757452717" },
  { year: 2020, title: { mn: "Hackum online hackathon", en: "Hackum online hackathon" } },
  { year: 2020, title: { mn: "МУИС-н шилдгийн шилдэг клуб", en: "NUM’s best club of the year" } },
  { year: 2021, title: { mn: "Knowledge Day, Tech Meetups", en: "Knowledge Day, Tech Meetups" } },
  { year: 2022, title: { mn: "МУИС-н шилдгийн шилдэг клуб", en: "NUM’s best club of the year" } },
  { year: 2023, title: { mn: "NUM Startup 3.0", en: "NUM Startup 3.0" }, note: { mn: "3-р байр 🥉", en: "3rd place 🥉" } },
  { year: 2023, title: { mn: "Digital МУИС Appathon", en: "Digital NUM Appathon" } },
  { year: 2024, title: { mn: "ХАСБАНК Hackathon", en: "XacBank Hackathon" } },
  { year: 2024, title: { mn: "Digital NUM", en: "Digital NUM" } },
  { year: 2025, title: { mn: "C Battle", en: "C Battle" } },
  { year: 2025, title: { mn: "Dev Hackathon", en: "Dev Hackathon" } },
  { year: 2026, title: { mn: "Typerace", en: "Typerace" } },
];

export type Shot = { src: string; alt: L; kind: "photo" | "poster" };
const photo = (file: string, mn: string, en: string): Shot => ({ src: `${P}/${file}.jpg`, alt: { mn, en }, kind: "photo" });
const poster = (p: { src: string; alt: string; altEn: string }): Shot => ({ src: p.src, alt: { mn: p.alt, en: p.altEn }, kind: "poster" });

/**
 * Timeline media per year: `front` card with an equally sized `back` card peeking out behind it
 * (that year's poster when we have one, otherwise a second photo). Years absent here show a logo card.
 */
export const TIMELINE_MEDIA: Record<number, { front: Shot; back?: Shot }> = {
  2018: { front: photo("hackathon-2018", "NUM Hackathon 2018 дээр Hackum-ийн гишүүд", "Hackum members at NUM Hackathon 2018") },
  2019: { front: photo("opendata-2019", "NUM Open Data Hackathon 2019", "NUM Open Data Hackathon 2019"), back: photo("digital-2019", "Дижитал мэргэжилтэн 2019", "Digital Specialist 2019") },
  2020: { front: poster(POSTERS.online2020) },
  2021: { front: photo("outing-snow", "Гишүүд өвлийн аялалд", "Members on a winter trip"), back: photo("outing-steppe-2021", "Гишүүд хээр талд аялж байна", "Members on a steppe trip") },
  2023: { front: photo("startup-5", "NUM Startup 3.0 тэмцээн", "NUM Startup 3.0 contest"), back: photo("appathon-2023", "Digital МУИС Appathon 2023", "Digital NUM Appathon 2023") },
  2024: { front: photo("xac-2024", "ХАСБАНК Hackathon 2024", "XacBank Hackathon 2024"), back: photo("digitalnum-2024", "Digital NUM 2024", "Digital NUM 2024") },
  2025: { front: photo("cbattle-2025", "C Battle 2025 оролцогчид", "C Battle 2025 participants"), back: poster(POSTERS.cbattle) },
  2026: { front: photo("typerace-2026", "Typerace 2026 оролцогчид", "Typerace 2026 participants"), back: poster(POSTERS.typerace) },
};

/** "Who we are" photo stack on the home page. */
export const WHO_PHOTOS: Shot[] = [
  photo("stage-2025", "Hackum-ийн гишүүд тайзан дээр хамтдаа", "Hackum members together on stage"),
  photo("digitalnum-2024", "Digital NUM 2024 тэмцээний оролцогчид", "Digital NUM 2024 participants"),
  photo("outing-forest", "Гишүүд намрын зугаалгаар ойд", "Members on an autumn trip in the forest"),
];

// Deterministic "current" year (prerender forbids new Date()); bump with the newest milestone.
export const LATEST_YEAR = Math.max(...TIMELINE.map((m) => m.year));
