import { formDefinition, type FormId } from "@/lib/mockdb/forms";
import type { Db } from "@/lib/mockdb/types";

/** Backoffice areas only an admin may open (an organizer gets the ordinary 404). Kept in step with `adminNav`. */
export const ADMIN_ONLY_AREAS = /^\/(?:mn|en)\/admin\/(?:settings|audit)(?:\/|$)/;

const FORM_PAGE = /^\/(?:mn|en)\/admin\/forms\/([^/]+)\/?$/;
const EVENT_PAGE = /^\/(?:mn|en)\/admin\/events\/([^/]+)(?:\/.*)?$/;
const POLL_PAGE = /^\/(?:mn|en)\/admin\/polls\/([^/]+)\/?$/;
const AREA = /^\/(mn|en)\/(me|admin)(?:\/|$)/;

export type GuardDecision = { type: "pass" } | { type: "redirect"; lang: "mn" | "en"; next: string } | { type: "notFound" };

/**
 * Optimistic route guard for the proxy: decided from the session cookie and a role lookup, before any page streams, so
 * the HTTP status is honest (307 to sign-in, real 404). It is a convenience, not the security boundary: every page,
 * layout and Server Action re-checks through `requireSession` / `requireStaffPage` / `requireStaffAction`.
 */
export function guardDecision(input: { pathname: string; search: string; handle: string | undefined; db: Db }): GuardDecision {
  const m = AREA.exec(input.pathname);
  if (!m) return { type: "pass" };
  const lang = m[1] as "mn" | "en";
  const area = m[2];
  const profile = input.handle ? input.db.profiles.find((p) => p.handle === input.handle && !p.deleted_at) : undefined;
  if (!profile) return { type: "redirect", lang, next: input.pathname + input.search };
  if (area === "me") return { type: "pass" };
  const role = input.db.staff_roles.find((r) => r.profile_id === profile.id)?.role;
  if (!role) return { type: "notFound" };
  if (role !== "admin" && ADMIN_ONLY_AREAS.test(input.pathname)) return { type: "notFound" };
  // An unknown form id renders the 404 page; answering it here makes the status honest (F-05).
  const form = FORM_PAGE.exec(input.pathname);
  if (form) {
    let id = "";
    try { id = decodeURIComponent(form[1]); } catch { /* malformed: unknown */ }
    if (!id || !formDefinition(input.db, id as FormId)) return { type: "notFound" };
  }
  // Same for an unknown event id (`new` is the create page).
  const ev = EVENT_PAGE.exec(input.pathname);
  if (ev && ev[1] !== "new") {
    let id = "";
    try { id = decodeURIComponent(ev[1]); } catch { /* malformed: unknown */ }
    if (!id || !input.db.events.some((e) => e.id === id)) return { type: "notFound" };
  }
  // And for an unknown poll id (`new` is the create page).
  const poll = POLL_PAGE.exec(input.pathname);
  // (`polls` is read defensively: a long-running dev server may still hold a store seeded before polls existed.)
  if (poll && poll[1] !== "new" && Array.isArray(input.db.polls)) {
    let id = "";
    try { id = decodeURIComponent(poll[1]); } catch { /* malformed: unknown */ }
    if (!id || !input.db.polls.some((p) => p.id === id)) return { type: "notFound" };
  }
  return { type: "pass" };
}
