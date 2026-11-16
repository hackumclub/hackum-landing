// The local stand-in for Supabase: one in-memory Db shared by every request, tab and route handler of this process.
// Writes go through `mutate` (the rules in registrations.ts / members.ts / events.ts), which bumps a version number and
// notifies subscribers; /api/dev/stream turns that into server-sent events so open admin, /me and public tabs refresh
// live. Lives on globalThis because Next compiles server components and route handlers into separate module graphs.
import type { Result } from "@/lib/result";
import type { Ctx, Db } from "./types";
import { tick } from "./outbox";
import { buildSeed } from "./seed";

export type Store = ReturnType<typeof createStore>;

export function createStore(opts: { seed: () => Db; now?: () => Date }) {
  const now = opts.now ?? (() => new Date());
  let db = opts.seed();
  let version = 1;
  const listeners = new Set<(v: number) => void>();
  const bump = () => { version += 1; for (const l of [...listeners]) l(version); };

  return {
    /** The live db. Read freely; change it only through `mutate`. */
    read: () => db,
    version: () => version,
    now,
    subscribe(cb: (v: number) => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    mutate<T>(rule: (ctx: Ctx) => Result<T>, actor: string | null): Result<T> {
      const result = rule({ db, actor, now: now() });
      if (result.ok) bump();
      return result;
    },
    /** One beat of what pg_cron + the dispatch route do in production: queue due reminders, send what is queued. */
    tickNow() {
      const r = tick(db, now());
      if (r.reminders + r.sent + r.skipped + r.failed > 0) bump();
      return r;
    },
    reset() { db = opts.seed(); bump(); },
  };
}

/** Mock data is a local-development tool (and an explicit preview opt-in); never on in a normal production deploy. */
export const mockEnabled = () => process.env.NODE_ENV !== "production" || process.env.ADMIN_PREVIEW === "1";

const KEY = Symbol.for("hackum.mockdb");
type G = typeof globalThis & { [KEY]?: Store };

export function getStore(): Store {
  const g = globalThis as G;
  if (!g[KEY]) {
    const store = createStore({ seed: () => buildSeed(new Date()) });
    g[KEY] = store;
    // Background dispatcher, like the pg_cron job: every 3s in `next dev` so queued mail visibly turns into "sent".
    if (process.env.NODE_ENV === "development") setInterval(() => store.tickNow(), 3000).unref();
  }
  return g[KEY]!;
}
