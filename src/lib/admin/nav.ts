import type { Locale } from "@/i18n/config";

/**
 * TEMPORARY gate until plan Task 5 replaces it with requireStaffPage(): admin pages exist only in development, or
 * on a preview deploy that explicitly sets ADMIN_PREVIEW=1. Production without the flag → 404.
 */
export const adminPreviewAllowed = () => process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW === "1";

import type { StaffRoleName } from "@/lib/mockdb/types";

export type AdminNavKey = "dashboard" | "events" | "members" | "forms" | "polls" | "analytics" | "reports" | "comms" | "inbox" | "settings" | "audit" | "kit";
export type AdminNavItem = { key: AdminNavKey; href: string; ready: boolean; adminOnly: boolean };

// Flip `ready` as each page ships; unready items render as "Soon" instead of linking to a 404. `kit` is a developer
// page: reachable by URL, never listed.
const ITEMS: { key: AdminNavKey; path: string; ready: boolean; adminOnly?: boolean; hidden?: boolean }[] = [
  { key: "dashboard", path: "", ready: true },
  { key: "events", path: "/events", ready: true },
  { key: "members", path: "/members", ready: true },
  { key: "forms", path: "/forms", ready: true },
  { key: "polls", path: "/polls", ready: true },
  { key: "analytics", path: "/analytics", ready: true },
  { key: "reports", path: "/reports", ready: true },
  { key: "comms", path: "/comms", ready: true },
  { key: "inbox", path: "/inbox", ready: true },
  { key: "settings", path: "/settings", ready: true, adminOnly: true },
  { key: "audit", path: "/audit", ready: true, adminOnly: true },
  { key: "kit", path: "/kit", ready: true, hidden: true },
];

/** Only the items this role may open: an organizer never sees Settings or Audit (they would 404). Defaults to admin. */
export const adminNav = (lang: Locale, role: StaffRoleName = "admin"): AdminNavItem[] =>
  ITEMS.filter((i) => !i.hidden && (role === "admin" || !i.adminOnly)).map((i) => ({ key: i.key, href: `/${lang}/admin${i.path}`, ready: i.ready, adminOnly: !!i.adminOnly }));
export const isAdminRouteReady = (lang: Locale, key: AdminNavKey) => adminNav(lang).find((i) => i.key === key)?.ready ?? true;
