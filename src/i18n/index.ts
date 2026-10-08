import { en } from "./en";
import { mn, type Dict } from "./mn";
import type { Locale } from "./config";

const DICTS: Record<Locale, Dict> = { mn, en };

/** Both dictionaries are small and static, so they are bundled directly (no async import needed). */
export const getDictionary = (lang: Locale): Dict => DICTS[lang];
export type { Dict };
