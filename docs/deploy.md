# Deploying to Vercel

Framework preset: **Next.js** (auto-detected). Build command `next build`, no output-directory override.

## Environment variables (Project → Settings → Environment Variables)
| Name | Required | Purpose |
|---|---|---|
| `SUBSCRIBE_WEBHOOK_URL` | for the Join form | HTTPS endpoint that receives `{ name, email, lang, ts }` per sign-up (Google Apps Script → Sheet, Zapier, your API). Without it the form says "temporarily unavailable". See `docs/subscribe.md`. |
| `SUBSCRIBE_WEBHOOK_SECRET` | optional | Sent as `Authorization: Bearer <secret>` to the webhook. |
| `SITE_URL` | optional | Canonical origin for metadata/sitemap/robots (e.g. `https://hackum.club`). Defaults to Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`). Also the origin inside event links in Google Calendar and `.ics` downloads, so set it in production; locally it falls back to `http://localhost:3000`, so the port in those links is wrong when the dev server runs elsewhere. |
| `NEXT_PUBLIC_CLUB_EMAIL` | optional | Public contact address for alumni and visitors (mailto links). Leave unset until the club domain exists: links then fall back to the club's Instagram. |
| `APP_ENV` | optional | Value of the `env` field in structured logs (defaults to `NODE_ENV`). |

## What the platform does for us
- **Images:** every photo, poster, sticker and 3D icon goes through `next/image` → AVIF/WebP at the slot's width, cached 31 days (`next.config.ts` → `images`). About 60 source images; check your plan's image-optimisation allowance.
- **Static pages:** both languages of every page are prerendered at build time; `proxy.ts` only adds the `/mn` or `/en` prefix and turns unknown event slugs / malformed URLs into real 404s.
- **Security headers** on all routes (`next.config.ts` → `headers()`): nosniff, referrer policy, no framing, permissions policy.
- `/robots.txt` and `/sitemap.xml` are generated at build with the production domain.

## Known limits
- The sign-up rate limit is in-memory per function instance (best-effort on serverless).
- `_archive/` holds retired pages and unused images; it is not routed or served.
