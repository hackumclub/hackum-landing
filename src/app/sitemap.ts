import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { EVENTS } from "@/lib/events";
import { SITE_URL } from "@/lib/site-url";

const PAGES = ["", "/events", "/about", "/join", "/code-of-conduct"];

/** Every page in both languages, each entry listing its other-language alternate. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...PAGES, ...EVENTS.map((e) => `/events/${e.slug}`)];
  return paths.flatMap((p) =>
    LOCALES.map((lang) => ({
      url: `${SITE_URL}/${lang}${p}`,
      changeFrequency: p.startsWith("/events/") ? ("yearly" as const) : ("monthly" as const),
      priority: p === "" ? 1 : p.startsWith("/events/") ? 0.5 : 0.8,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${p}`])) },
    })),
  );
}
