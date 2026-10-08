export const LOCALES = ["mn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "mn";

export const isLocale = (v: string | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

/** A bilingual string for content data (events, timeline, members). UI copy lives in the dictionaries. */
export type L = Record<Locale, string>;
export const t = (v: L, lang: Locale) => v[lang];

/** Locale-prefixed internal path: href("en", "/events") → "/en/events", href("mn") → "/mn". */
export const href = (lang: Locale, path = "") => `/${lang}${path === "/" ? "" : path}`;

/** Swap the locale segment of a pathname, keeping the rest of the route. */
export const switchLocale = (pathname: string, to: Locale) => {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join("/") || `/${to}`;
};

/** Replace {name} placeholders. Kept as plain strings so dictionaries stay serialisable to client components. */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
