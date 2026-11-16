import { ok, type Result } from "@/lib/result";
import { iso, requireProfile } from "./core";
import type { Ctx, Db, InboxItem } from "./types";

/** Newest first. `before` is the id of the last item already shown (cursor paging). */
export function inboxFor(db: Db, profileId: string, opts: { limit?: number; before?: string }): InboxItem[] {
  const mine = db.inbox
    .map((item, i) => ({ item, i }))
    .filter((x) => x.item.profile_id === profileId)
    .sort((a, b) => b.item.created_at.localeCompare(a.item.created_at) || b.i - a.i)
    .map((x) => x.item);
  const from = opts.before ? mine.findIndex((x) => x.id === opts.before) + 1 : 0;
  return mine.slice(from, from + (opts.limit ?? 20));
}

export const unreadCount = (db: Db, profileId: string) => db.inbox.filter((i) => i.profile_id === profileId && !i.read_at).length;

/** Marks the actor's own items read; ids that belong to someone else are ignored. */
export function markRead(ctx: Ctx, ids: string[]): Result<{ changed: number }> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const want = new Set(ids);
  let changed = 0;
  for (const i of ctx.db.inbox) if (i.profile_id === me.data.id && want.has(i.id) && !i.read_at) { i.read_at = iso(ctx.now); changed++; }
  return ok({ changed });
}

export function markAllRead(ctx: Ctx): Result<{ changed: number }> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  let changed = 0;
  for (const i of ctx.db.inbox) if (i.profile_id === me.data.id && !i.read_at) { i.read_at = iso(ctx.now); changed++; }
  return ok({ changed });
}
