import type { Locale } from "@/i18n/config";

/**
 * TEMPORARY gate until plan Task 5 replaces it with requireStaffPage(): admin pages exist only in development, or
 * on a preview deploy that explicitly sets ADMIN_PREVIEW=1. Production without the flag → 404.
 */
export const adminPreviewAllowed = () => process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW === "1";

export type AdminNavKey = "dashboard" | "events" | "members" | "comms" | "settings" | "audit" | "kit";
export type AdminNavItem = { key: AdminNavKey; href: string; ready: boolean };

// Flip `ready` as each plan task ships its page; unready items render as "Soon" instead of linking to a 404.
const ITEMS: [AdminNavKey, string, boolean][] = [
  ["dashboard", "", true],
  ["events", "/events", false],
  ["members", "/members", false],
  ["comms", "/comms", false],
  ["settings", "/settings", false],
  ["audit", "/audit", false],
  ["kit", "/kit", true],
];

export const adminNav = (lang: Locale): AdminNavItem[] => ITEMS.map(([key, path, ready]) => ({ key, href: `/${lang}/admin${path}`, ready }));
export const isAdminRouteReady = (lang: Locale, key: AdminNavKey) => adminNav(lang).find((i) => i.key === key)!.ready;
