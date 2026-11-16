import type { Locale } from "./config";
import { fill } from "./config";

export type Plural = { one: string; other: string };

/** Pick the plural form for `n` (Intl rules per locale) and fill {n} plus any extra vars. */
export function plural(lang: Locale, n: number, forms: Plural, vars: Record<string, string | number> = {}) {
  const form = new Intl.PluralRules(lang === "mn" ? "mn" : "en").select(n) === "one" ? forms.one : forms.other;
  return fill(form, { n, ...vars });
}
