# Going to production: what you do by hand, every env var, and what I build

Status (2026-11-16): the app runs on a **local mock** of Supabase (`src/lib/mockdb`, same table and column names, executable rules with tests). Nothing talks to Supabase, Clerk or Resend yet. The Supabase project `ndjawhnjjlmrttxoniyl` exists but is **paused** (database, migrations and storage calls time out).

**Never paste secrets into the chat or into git.** Put them in `.env.local` (git-ignored) for local work and in Vercel → Settings → Environment Variables for deployments. I only need the *names* to exist.

## 1. What I need from you (in this order)
| # | You do | Why it blocks |
|---|---|---|
| 1 | *(optional, see 1b)* **A domain you control**, and who controls its DNS | Clerk production (passkeys only work on a real domain), Resend (verified sender for SPF/DKIM), `SITE_URL`, calendar organizer address. Without a domain I can only run on `*.vercel.app` with Clerk's development instance and Resend's test sender (mail reaches only your own address). |
| 2 | **Unpause / restore the Supabase project** (dashboard → project → Restore). Tell me the plan (Free is fine) | I cannot apply or test anything against it while it is paused. Free projects pause after 7 days of inactivity: I add a keep-alive, but the first restore is manual. |
| 3 | **Create a Clerk application** (clerk.com, Free: 10,000 monthly users). Enable: Email code, Passkeys, optionally Google. Copy the two keys into `.env.local` | Sign-in. Use the **Development** instance first, create **Production** when the domain exists. |
| 4 | **Connect Clerk to Supabase**: Clerk dashboard → Integrations → Supabase (activates the `role` claim) and Supabase dashboard → Authentication → Sign In / Providers → Third-Party Auth → Add **Clerk** with your Clerk domain | Row-level security reads the Clerk user id from the token. |
| 5 | **Create a Resend account** (Free: 100 emails a day, 3,000 a month). Add and verify the sending domain (three DNS records), create an API key, add a webhook to `https://<site>/api/webhooks/resend` and copy its signing secret | Real email (confirmations, reminders, decisions, announcements). The app already spreads sends over days to respect the daily limit. |
| 6 | **Vercel**: confirm the project, add the env vars below to *Production* and *Preview*, add the custom domain | Deploy. Do **not** set `ADMIN_PREVIEW` in production (it would turn the demo sign-in back on). |
| 7 | **Real data**: allow me to read `src/data/` (events, members, timeline, posters) and export the current newsletter subscriber list from the sheet behind `SUBSCRIBE_WEBHOOK_URL` as CSV (put it in a private folder, not git) | One-time import of the 2017–now history and subscribers. |
| 8 | Optional later: university public IP range (campus Wi-Fi check-in), VAPID keys for web push | Check-in and push slices. |

## 1b. Running on the Vercel address only (no custom domain)
Decision (2026-11-16): the site lives on its `*.vercel.app` address and no custom domain is bought for now. What that changes:
| Piece | Works? | Details |
|---|---|---|
| Supabase database, storage, row-level security | yes | domain independent |
| Clerk sign-in (email code, Google) | **yes, in a Development instance** | [Clerk production instances need a domain you own and do not accept `vercel.app`](https://clerk.com/docs/guides/development/deployment/production). Use the development keys on Vercel until a domain exists. Clerk labels development mode and treats it as a test environment, so plan to switch later (a key swap plus a user re-sign-in, no code change). |
| Passkeys | **limited** | In development a passkey is [tied to the domain it was created on](https://clerk.com/docs/guides/development/deployment/production) (Clerk's `accounts.dev`), so it works for testing but is not a stable member-facing feature. Email code stays the main sign-in until a domain exists. |
| Clerk's own emails (the sign-in code) | yes | Clerk sends them itself. |
| **App emails to members** (confirmations, reminders, decisions, announcements, calendar invites) | **no, not to other people** | [Resend's test sender `resend.dev` only delivers to the account owner's own address](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain); sending to members needs a verified domain. Until then the app stays in **in-app mode**: every message still lands in the member's bell and notification page (already built), the outbox keeps queued mail without failing, and the composer says "email delivery is off until a sending domain is verified". |
| Add to calendar | yes | the Google Calendar link and the personal calendar feed (webcal) are web features; only the emailed `.ics` invite needs email. |
| Storage, polls, feedback, reports, PDF export | yes | domain independent |
The one thing that unblocks real member email is **any domain you control** (a cheap one is enough: Resend needs three DNS records on it). Everything else is ready to run without one. Env: `SITE_URL` can stay unset (it defaults to the Vercel production address); set `EMAIL_DELIVERY=off` (default when no verified sender) and later `EMAIL_FROM`.

## 2. Environment variables
| Name | Where it comes from | Public? | Used for |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes | all database and storage calls (`https://ndjawhnjjlmrttxoniyl.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same page (publishable / anon key) | yes | browser and server calls that run **as the signed-in person** (row-level security applies) |
| `SUPABASE_SECRET_KEY` | same page (secret / service-role key) | **never public** | webhooks, cron and the import script only; never imported by pages or actions |
| `SUPABASE_DB_URL` | Project Settings → Database → connection string | secret | running migrations from CI or my machine (optional if I use the Supabase MCP) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys | yes | Clerk components |
| `CLERK_SECRET_KEY` | Clerk → API Keys | secret | server session checks |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk → Webhooks (endpoint `/api/webhooks/clerk`, events `user.created`, `user.updated`, `user.deleted`) | secret | create and link profiles, anonymise on delete |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `…SIGN_UP_URL` | fixed values `/en/sign-in`, `/en/join` | yes | redirects |
| `RESEND_API_KEY` | Resend → API Keys | secret | sending |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks | secret | bounces and complaints → suppression list |
| `EMAIL_FROM` | you choose, on the verified domain, e.g. `Hackum <hello@yourdomain>` | no | sender |
| `EMAIL_REPLY_TO` | optional | no | replies |
| `CRON_SECRET` | I generate (random 32+ chars), you paste into Vercel and Supabase Vault | secret | protects `/api/cron/*` |
| `SITE_URL` | your domain, `https://…` | no | links in emails, calendar files, sitemap |
| `NEXT_PUBLIC_CLUB_EMAIL` | optional public contact address | yes | alumni and contact links (falls back to Instagram) |
| `APP_ENV` | `production` / `preview` | no | log field |
| `ADMIN_PREVIEW` | **leave unset in production** | no | only for private preview deploys of the mock |
| later: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | I generate | mixed | web push |

## 3. Storage (Supabase Storage buckets I create by migration)
| Bucket | Visibility | Contents | Rules |
|---|---|---|---|
| `posters` | public read | event posters and covers, timeline images | staff-only write (storage policy checks staff role); images resized to ≤ 1600 px WebP before upload |
| `avatars` | **private** | member photos | each person writes only `avatars/<their profile id>`; reads go through `/api/avatar/[id]`, which checks profile visibility (public / members / private) and returns a short signed URL; JPEG/PNG/WebP only, ≤ 1 MB, EXIF stripped (the server checks already exist) |
| `private-docs` | private | rules (журам), minutes, report exports | staff and members by document visibility |
Free tier: 1 GB storage, 5 GB egress a month; images are resized on the client and by `next/image`, avatars cached immutably by version.

## 4. What I build (phases, each ends with tests)
1. **Schema and security (can start now, local Docker, needs nothing from you):** `supabase/migrations` for every table in `src/lib/mockdb/types.ts` plus enums, indexes and **row-level security on every table**; `security definer` functions that mirror the mock rules (register, cancel, decide, apply for membership with the NUM-only rule, review, vote, feedback, announcements, read/mark inbox); pgTAP tests for each rule and for who can read what; `supabase db reset && supabase test db` green.
2. **Data layer:** one repository interface the pages call; the mock stays as the development/test adapter, a Supabase adapter becomes production; the same contract tests run against both so behaviour cannot drift.
3. **Auth (Clerk + Supabase):** Clerk sign-in/sign-up (email code, passkey) replaces the mock at the same URLs; webhook creates/links profiles (legacy imported members are claimed by matching email); proxy guard keeps the honest 307/404; the persona picker disappears in production.
4. **Storage:** upload paths for avatars and posters, signed URLs, storage policies, tests.
5. **Email and jobs:** `/api/cron/dispatch` drains the outbox through Resend (priority, daily budget, suppression list, retries); `pg_cron` + `pg_net` every 5 minutes (Vercel Hobby cron is daily only); Resend webhook; Vercel daily keep-alive for the free-tier pause.
6. **Import and launch:** one-time import of history, members, subscribers and posters; Supabase advisors (security and performance) clean; preview deploy; smoke test of every persona; production checklist; mock code excluded from the production bundle.

## 5. Free-tier limits to know
Supabase: 500 MB database, 1 GB files, project pauses after 7 days idle. Resend: 100/day (20 kept for confirmations), 3,000/month. Clerk: 10,000 monthly users. Vercel Hobby: daily cron only, image-optimisation allowance. A blast to 170 members takes three days at 80 a day: the composer already says so.

## 6. Launch checklist
- [ ] domain chosen and DNS records added (Vercel, Clerk, Resend)
- [ ] Supabase restored, third-party auth for Clerk on, migrations applied, advisors clean
- [ ] env vars set in Production and Preview, `ADMIN_PREVIEW` unset
- [ ] legacy data and subscribers imported, posters in `posters`
- [ ] first admin created (Clerk user → `staff_roles` row by a one-time script)
- [ ] test email received with a working calendar file, bounce handled
- [ ] passkey registered and used on the production domain
- [ ] `/me` and `/admin` redirect when signed out, member gets 404 on `/admin`
- [ ] keep-alive and 5-minute dispatcher running

## 7. Progress note: phase 1 (schema and security), 2026-11-16
Done locally (Docker, Postgres 17, nothing applied to the hosted project): `supabase/` with 15 migrations (22 tables, enums, indexes on every foreign key and list filter, RLS on every table plus a restrictive Clerk-issuer policy, three safe-column views, Storage buckets `posters`/`avatars`/`private-docs`, pg_cron job), 40 RPC rule functions (plus 7 service-role-only jobs and webhook helpers) in schema `app`, all `security definer`, that mirror the mock and fail with `P0001` + the shared error codes, and pgTAP tests (`supabase db reset && supabase test db`: 10 files, 435 assertions, green; `supabase db lint --level warning --schema public,app` clean; `supabase gen types typescript --local` works). Run, layout, the mock-rule to SQL table, the issuer setup and the remaining Dashboard steps are in `supabase/README.md`.
Still manual for you: Clerk third-party auth in the Supabase dashboard, set `app.settings.clerk_issuer`, expose schema `app` in API settings, create the two Vault secrets (`hackum_site_url`, `hackum_cron_secret`), insert the first admin. Not ported yet: the dispatcher (app code), analytics/report aggregates, import helpers (see README).
