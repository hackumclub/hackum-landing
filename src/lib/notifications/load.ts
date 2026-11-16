import "server-only";
import type { Locale } from "@/i18n/config";
import { relativeTime } from "@/lib/members/format";
import { inboxFor, unreadCount } from "@/lib/mockdb/notifications";
import { getStore } from "@/lib/mockdb/store";
import { describeInbox, type InboxView } from "./map";

/** An inbox row ready to render: the mapped text plus a relative time computed on the server (so client and server agree). */
export type InboxRow = InboxView & { when: string };
export type BellData = { unread: number; items: InboxRow[] };
export type InboxPage = { unread: number; items: InboxRow[]; hasMore: boolean };

const PAGE = 20;

function rowsFor(profileId: string, lang: Locale, opts: { limit: number; before?: string }): { items: InboxRow[]; hasMore: boolean; unread: number } {
  const store = getStore();
  const db = store.read();
  const now = store.now();
  // One extra row tells us whether there is another page without a second query.
  const raw = inboxFor(db, profileId, { limit: opts.limit + 1, before: opts.before });
  const items = raw.slice(0, opts.limit).map((i): InboxRow => ({ ...describeInbox(i, lang), when: relativeTime(new Date(i.created_at), now, lang) }));
  return { items, hasMore: raw.length > opts.limit, unread: unreadCount(db, profileId) };
}

/** The bell: unread count and the latest 8. */
export function loadBell(profileId: string, lang: Locale, limit = 8): BellData {
  const { items, unread } = rowsFor(profileId, lang, { limit });
  return { unread, items };
}

/** A page of the full list, newest first; `before` is the id of the last row already on screen. */
export function loadInboxPage(profileId: string, lang: Locale, opts: { before?: string; limit?: number } = {}): InboxPage {
  return rowsFor(profileId, lang, { limit: opts.limit ?? PAGE, before: opts.before });
}
