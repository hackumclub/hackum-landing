// MOCK of Clerk's email-code and passkey sign-in. Same limits and failure modes as the real thing so the UI is built
// against honest behaviour; in production Clerk owns all of this and these rules (and `auth_codes`) disappear.
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { err, ok, type Result } from "@/lib/result";
import type { L, Locale } from "@/i18n/config";
import { audit, enqueue, iso, nextId, profileOf, requireProfile } from "./core";
import type { Ctx, Passkey, Profile } from "./types";

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_WRONG_TRIES = 5;
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_PASSKEYS = 5;
const HOUR_MS = 3_600_000;

const normEmail = (raw: string) => raw.trim().toLowerCase();
const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const sameCode = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const findByEmail = (ctx: Ctx, email: string) => ctx.db.profiles.find((p) => p.email?.toLowerCase() === email) ?? null;

/** Sends a 6-digit code. The code is returned so the mock UI can show it (dev only); the real flow emails it. */
export function requestEmailCode(ctx: Ctx, rawEmail: string): Result<{ code: string }> {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) return err("invalid");
  const { db, now } = ctx;
  db.auth_codes = db.auth_codes.filter((c) => now.getTime() - new Date(c.created_at).getTime() <= HOUR_MS);
  if (db.auth_codes.filter((c) => c.email === email).length >= MAX_SENDS_PER_HOUR) return err("rate_limited");
  for (const c of db.auth_codes) if (c.email === email && !c.used_at) c.used_at = iso(now); // a new code replaces the old one
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  db.auth_codes.push({ email, code, attempts: 0, created_at: iso(now), expires_at: iso(new Date(now.getTime() + CODE_TTL_MS)), used_at: null });
  return ok({ code });
}

export type NewAccount = { name: L; locale: Locale };

const handleFor = (ctx: Ctx, email: string) => {
  let base = email.split("@")[0].replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  if (base.length < 3) base = "member";
  return ctx.db.profiles.some((p) => p.handle === base) ? `${base}-${++ctx.db.seq}` : base;
};

function createProfile(ctx: Ctx, email: string, a: NewAccount): Profile {
  const p: Profile = {
    id: nextId(ctx.db, "p"), clerk_user_id: `user_${randomBytes(6).toString("hex")}`, email, handle: handleFor(ctx, email),
    name: { mn: a.name.mn.trim(), en: a.name.en.trim() }, avatar_path: null, school: null, school_id: null, major: null, major_track: null,
    program_index: null, passkeys: [], grad_year: null, status: "guest", visibility: "members", locale: a.locale, links: {},
    notif_prefs: { reminders: true, updates: true, announcements: true }, calendar_token: randomBytes(16).toString("hex"),
    onboarded_at: iso(ctx.now), created_at: iso(ctx.now), last_seen_at: iso(ctx.now), deleted_at: null,
  };
  ctx.db.profiles.push(p);
  enqueue(ctx, { profileId: p.id, template: "welcome", priority: 0, payload: { to_name: p.name.mn || p.name.en }, dedupe: `welcome:${p.id}` });
  return p;
}

/**
 * Checks the code. Known email → signs that profile in. Unknown email → `not_found` (code stays valid), unless the
 * sign-up form sent `create`, which proves ownership of the address and creates a guest account.
 */
export function verifyEmailCode(ctx: Ctx, rawEmail: string, rawCode: string, create?: NewAccount): Result<{ profile_id: string; created: boolean }> {
  const email = normEmail(rawEmail);
  const code = rawCode.trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return err("invalid");
  const { db, now } = ctx;
  const row = [...db.auth_codes].reverse().find((c) => c.email === email && !c.used_at);
  if (!row || new Date(row.expires_at) <= now) return err("invalid");
  if (row.attempts >= MAX_WRONG_TRIES) return err("rate_limited");
  if (!sameCode(row.code, code)) { row.attempts += 1; return err("invalid"); }

  const existing = findByEmail(ctx, email);
  if (existing?.deleted_at) return err("not_found");
  if (existing) { row.used_at = iso(now); existing.last_seen_at = iso(now); return ok({ profile_id: existing.id, created: false }); }
  if (!create) return err("not_found");
  if (!create.name.mn.trim() || create.name.mn.length > 80 || create.name.en.length > 80 || (create.locale !== "mn" && create.locale !== "en")) return err("invalid");
  row.used_at = iso(now);
  return ok({ profile_id: createProfile(ctx, email, create).id, created: true });
}

export function addPasskey(ctx: Ctx, rawLabel: string): Result<Passkey> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  const label = rawLabel.trim();
  if (label.length < 1 || label.length > 40) return err("invalid");
  if (me.data.passkeys.length >= MAX_PASSKEYS) return err("conflict");
  const key: Passkey = { id: nextId(ctx.db, "pk"), label, created_at: iso(ctx.now) };
  me.data.passkeys.push(key);
  audit(ctx, "passkey.add", "profiles", me.data.id);
  return ok(key);
}

/** Mock of discoverable-credential sign-in: the profile must have registered a passkey. */
export function signInWithPasskey(ctx: Ctx, rawEmail: string): Result<{ profile_id: string }> {
  const email = normEmail(rawEmail);
  const p = validEmail(email) ? findByEmail(ctx, email) : null;
  if (!p || p.deleted_at || p.passkeys.length === 0 || !profileOf(ctx.db, p.id)) return err("not_found");
  p.last_seen_at = iso(ctx.now);
  return ok({ profile_id: p.id });
}
