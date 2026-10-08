import type { L } from "@/i18n/config";

export type Role = "lead" | "core" | "member";
export type Team = "project" | "marketing" | "external" | "internal";
export type Member = {
  name: L;
  /** Season start year: 2025 means the 2025–26 season. */
  season: number;
  role: Role;
  team?: Team;
  /** Optional square photo under /public/img/members/. Falls back to initials. */
  photo?: string;
};

/** Seasons shown in the year filter, newest first (founded 2017). */
export const SEASONS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];

/**
 * Known members. 2025–26 comes from the Figma "Багийн бүтэц" slide and the Typerace 2026 certificate.
 * Earlier seasons and photos still need to be filled in by the club (see README note in the summary).
 */
export const MEMBERS: Member[] = [
  { season: 2025, role: "lead", name: { mn: "Г. Энхжин", en: "G. Enkhjin" } },
  { season: 2025, role: "core", team: "project", name: { mn: "Энхнасан", en: "Enkhnasan" } },
  { season: 2025, role: "core", team: "project", name: { mn: "Саруулчимэг", en: "Saruulchimeg" } },
  { season: 2025, role: "core", team: "marketing", name: { mn: "Цэлмэг", en: "Tselmeg" } },
  { season: 2025, role: "core", team: "marketing", name: { mn: "Гэрэлмаа", en: "Gerelmaa" } },
  { season: 2025, role: "core", team: "external", name: { mn: "Энхмэнд", en: "Enkhmend" } },
  { season: 2025, role: "core", team: "external", name: { mn: "Төгөлдөр", en: "Tuguldur" } },
  { season: 2025, role: "core", team: "internal", name: { mn: "Золбаяр", en: "Zolbayar" } },
  { season: 2025, role: "core", team: "internal", name: { mn: "Номин", en: "Nomin" } },
];
