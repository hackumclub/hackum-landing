import { isLocale } from "@/i18n/config";
import { log } from "@/lib/log";
import { subscribe, SUBSCRIBE_SOURCES } from "@/lib/mockdb/ext-subscribe";
import { getStore, mockEnabled } from "@/lib/mockdb/store";

/**
 * POST /api/subscribe  { name, email, lang, website }  → store a "notify me about events" sign-up.
 *
 * Hardening: same-origin only, JSON only, 2 KB body cap, strict field validation (control characters rejected),
 * a honeypot field that silently succeeds for bots, and a best-effort per-IP rate limit. Duplicate emails
 * return the same success response so the endpoint can't be used to probe who is subscribed.
 *
 * Where sign-ups go:
 *  - db.subscribers, through the `subscribe` rule (src/lib/mockdb/ext-subscribe.ts), whenever the mock database is on.
 *  - SUBSCRIBE_WEBHOOK_URL (https; optional SUBSCRIBE_WEBHOOK_SECRET sent as a Bearer token) → also forwarded as JSON.
 *  - with the mock off and no webhook configured → 503, and the form tells the visitor to use Instagram.
 * Names and emails are never written to logs.
 */
const LOGGER = "api.subscribe";
const MAX_BODY = 2048;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5; // per client address
const MAX_HITS_UNKNOWN = 60; // when the host passes no client address, every visitor shares one bucket
const CONTROL = /[\u0000-\u001f\u007f]/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

type Failure = "bad_request" | "origin" | "name" | "email" | "rate" | "unavailable" | "server";
const STATUS: Record<Failure, number> = { bad_request: 400, origin: 403, name: 400, email: 400, rate: 429, unavailable: 503, server: 502 };

const hits = new Map<string, number[]>();
function limited(ip: string, now: number) {
  const cap = ip === "unknown" ? MAX_HITS_UNKNOWN : MAX_HITS;
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > cap;
}

const reply = (status: number, body: object, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
const fail = (e: Failure, extra?: Record<string, string>) => reply(STATUS[e], { ok: false, error: e }, extra);

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

type Signup = { name: string; email: string; lang: string; source: string; ts: string };

/** Optional extra: forward a new sign-up to a webhook (https, or http://localhost in development). Never throws. */
async function forward(rec: Signup): Promise<boolean> {
  const hook = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (!hook) return true;
  let url: URL;
  try { url = new URL(hook); } catch { return false; }
  const dev = process.env.NODE_ENV !== "production";
  const allowed = url.protocol === "https:" || (dev && url.protocol === "http:" && url.hostname === "localhost");
  if (!allowed) return false;
  const secret = process.env.SUBSCRIBE_WEBHOOK_SECRET;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(rec),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    return res.ok;
  } catch { return false; }
}

/**
 * Store the sign-up in db.subscribers (what the admin reads) through the `subscribe` rule, then forward it to the
 * optional webhook. With the mock database switched off (a plain production deploy) the webhook is the only
 * destination, and without one there is nowhere to put the sign-up.
 */
async function deliver(rec: Signup): Promise<"ok" | "unavailable" | "error"> {
  if (!mockEnabled()) {
    if (!process.env.SUBSCRIBE_WEBHOOK_URL) return "unavailable";
    return (await forward(rec)) ? "ok" : "error";
  }
  const stored = getStore().mutate((ctx) => subscribe(ctx, { name: rec.name, email: rec.email, lang: isLocale(rec.lang) ? rec.lang : "mn", source: rec.source }), null);
  if (!stored.ok) return "error";
  // A duplicate is a silent success; only a new row is forwarded. A webhook failure never fails a stored sign-up.
  if (stored.data.created && !(await forward(rec))) log("WARN", LOGGER, "subscribe_webhook_failed", "n/a", { source: rec.source });
  return "ok";
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const done = (outcome: string, status: number, res: Response) => {
    log(status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO", LOGGER, "subscribe_request_handled", requestId, { outcome, status });
    return res;
  };

  if (!sameOrigin(req)) return done("origin", 403, fail("origin"));
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return done("bad_request", 400, fail("bad_request"));

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip, Date.now())) return done("rate", 429, fail("rate", { "Retry-After": String(WINDOW_MS / 1000) }));

  const text = await req.text();
  if (text.length > MAX_BODY) return done("bad_request", 413, reply(413, { ok: false, error: "bad_request" }));
  let body: unknown;
  try { body = JSON.parse(text); } catch { return done("bad_request", 400, fail("bad_request")); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return done("bad_request", 400, fail("bad_request"));
  const b = body as Record<string, unknown>;

  // Honeypot: real visitors never see this field. Pretend success so bots don't adapt.
  if (typeof b.website === "string" && b.website.length > 0) return done("honeypot", 200, reply(200, { ok: true }));

  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 80 || CONTROL.test(name)) return done("name", 400, fail("name"));
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length < 6 || email.length > 254 || CONTROL.test(email) || !EMAIL.test(email)) return done("email", 400, fail("email"));
  const lang = typeof b.lang === "string" && isLocale(b.lang) ? b.lang : "mn";
  const source = typeof b.source === "string" && (SUBSCRIBE_SOURCES as readonly string[]).includes(b.source) ? b.source : "join_page";

  const result = await deliver({ name, email, lang, source, ts: new Date().toISOString() });
  if (result === "unavailable") return done("unavailable", 503, fail("unavailable"));
  if (result === "error") return done("delivery_failed", 502, fail("server"));
  return done("stored", 200, reply(200, { ok: true }));
}
