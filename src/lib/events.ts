import data from "@/data/events.json";
import type { L } from "@/i18n/config";

export type Event = {
  slug: string;
  name: L;
  tagline: L;
  year: string;
  mode: string;
  themes: string[];
  status: string;
  participants: number | null;
  url: string;
};

// English display names where the Mongolian name contains Cyrillic.
const NAME_EN: Record<string, string> = {
  "xacbank-hackathon-2024": "XacBank Hackathon",
  "digital-num-appathon-2023": "Digital NUM Appathon",
};

export const EVENTS: Event[] = data.map((h) => ({
  slug: h.slug,
  name: { mn: h.name, en: NAME_EN[h.slug] ?? h.name },
  tagline: { mn: h.tagline, en: h.tagline_en },
  year: h.dates ?? "",
  mode: h.mode,
  themes: h.themes,
  status: h.status,
  participants: h.participants,
  url: h.url,
}));

export const findEvent = (slug: string) => EVENTS.find((e) => e.slug === slug);
