# Hackum OS — Slice 1 (Foundation + Events) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Hackum from static files to Supabase. Add Clerk accounts, an organizer backoffice, and a member app covering events (RSVP and hackathon applications with teams), membership applications, email with calendar invites, and reminders.

**Architecture:** There is one Next.js 16 app with three areas: the public site `/[lang]`, the member app `/[lang]/me`, and staff pages `/[lang]/admin`.
- **Supabase:** Postgres with RLS keyed to the Clerk JWT `sub`. All multi-row or capacity-sensitive writes go through `security definer` RPCs.
- **Server Actions:** call those RPCs with a user-scoped client.
- **Outbox:** an outbox table is drained by `/api/cron/dispatch`, which pg_cron pings through pg_net.
- **Public pages:** stay prerendered with `use cache` and `cacheTag`.

**Tech Stack:** Next 16.4 (App Router, `cacheComponents`, `proxy.ts`), React 19.3, Tailwind 4, `@clerk/nextjs`, `@supabase/supabase-js`, Supabase CLI 2.72 (migrations, pgTAP), `zod`, `resend` + `@react-email/components`, `lucide-react`, Radix primitives, Vitest, Playwright + `@clerk/testing`.

**Spec:** `docs/superpowers/specs/2026-11-16-hackum-backoffice-design.md`. Read §3–§8 before any task.

## Global Constraints

- **Next 16 conventions:**
  - Read the relevant guide in `node_modules/next/dist/docs/` before using a Next API.
  - Middleware is `src/proxy.ts`, which exports `proxy`.
  - Reading `cookies()`/`auth()` outside `<Suspense>` is a build error under `cacheComponents`.
  - Never read `cookies()` inside plain `use cache`.
- **TypeScript:** strict, no `any`. Server components by default.
- **i18n:**
  - Every user-facing string goes in `src/i18n/mn.ts` with a matching key in `src/i18n/en.ts`, or is stored as a bilingual `L` value in the DB.
  - Content fallback is `mn` when `en` is empty.
- **Logging:** use `log()` from `src/lib/log.ts` only.
  - `message` is a constant snake_case string, and fields are snake_case.
  - Never log emails, names, tokens, answers, or IPs.
  - Log an ERROR once, at the route or action boundary.
  - Every route or action gets a `request_id` from `crypto.randomUUID()`.
- **Secrets:**
  - The service-role client is importable only from `src/app/api/webhooks/**`, `src/app/api/cron/**` and `scripts/**`. It is enforced by `import "server-only"` plus the ESLint `no-restricted-imports` rule in Task 5.
  - No `NEXT_PUBLIC_` secret.
- **Identity in RLS:** `(select auth.jwt()->>'sub')` (text). Never `auth.uid()`.
- **Time:** the timezone is `Asia/Ulaanbaatar` (UTC+8, no DST). Store `timestamptz`, and display with the tz label.
- **Free tiers:** Resend allows 100 emails/day. Reserve 20/day for priority-0 (transactional) mail. Supabase Storage is 1 GB total, and uploads are ≤1600px WebP.
- **Design:**
  - Use existing tokens in `src/app/globals.css` plus the additions in Task 10.
  - Lucide icons for UI. Мануул stickers only for empty states.
  - Glass on one surface per screen.
  - Status pill vocabulary per spec §7.
  - 44px touch targets in `/me`.
  - `prefers-reduced-motion` is respected.
- **Commits:** one per task minimum, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Unknown event slug on the DB-backed page must return HTTP 404, not a streamed 200 "soft 404".** Covered by a curl assertion in Task 15.
2. **Two people taking the last seat at the same moment must yield exactly one `going` and one `waitlisted`.** Covered by the concurrent integration test in Task 2.
3. **Changing an event's time after the 24h reminder was sent must produce one reminder for the new time and no repeat for the old one.** Changing it to `cancelled` must skip queued reminders. Covered by pgTAP in Task 4 and the dispatcher test in Task 8.
4. **Mongolian Cyrillic in .ics and email subjects** must not be corrupted. The ICS line folding at 75 octets must not split a UTF-8 code point. Covered by Task 7.
5. **A signed-in user whose Clerk webhook hasn't arrived yet must not get a 500** when opening `/me` or RSVPing. The lazy profile upsert handles this, covered in Task 5.
6. **A guest calling staff RPCs directly through PostgREST (bypassing the UI) is denied.** Covered by pgTAP in Tasks 2–3.

## Prerequisites (user, before Task 1 runs against remote; local work can start)

- Docker running (local Supabase).
- Supabase project `ndjawhnjjlmrttxoniyl` unpaused.
- Read access to `src/data/` granted (Task 6).
- A Clerk dev instance created (keys in `.env.local`).
- A Resend API key (test mode is fine until the domain exists).

## File Structure

```
supabase/
  config.toml                         # [auth.third_party.clerk], seed, pg_cron/pg_net extensions
  migrations/0001_core.sql            # extensions, enums, app helpers, profiles, memberships, staff_roles, seasons, issuer policy
  migrations/0002_events.sql          # events, teams, event_registrations, RPCs
  migrations/0003_membership.sql      # membership_applications, review RPC, audit_log + triggers
  migrations/0004_outbox.sql          # notifications, usage, suppressions, subscribers, timeline, rate_limits, reminders, change triggers, views
  migrations/0005_cron.sql            # pg_cron schedule → pg_net (reads vault secrets)
  tests/*.test.sql                    # pgTAP
  seed.sql                            # local-only: 1 admin, 1 organizer, 2 guests, 2 events
scripts/import-legacy.ts              # static data → DB (idempotent)
src/lib/env.ts                        # zod-validated env
src/lib/result.ts                     # Result<T,E>
src/lib/db/{types.ts,user.ts,service.ts,public.ts}
src/lib/server/session.ts             # Clerk + profile DAL
src/lib/calendar/{ics.ts,gcal.ts}
src/lib/events/{questions.ts,queries.ts,actions.ts,format.ts}
src/lib/members/{queries.ts,actions.ts}
src/lib/notify/{dedupe.ts,plan.ts,dispatch.ts,resend.ts}
src/emails/{Layout.tsx,templates.tsx,render.ts}
src/components/ui/*                   # primitives (Task 10)
src/components/admin/*                # shell, tables, forms
src/components/me/*                   # bottom nav, ticket cards, apply flow
src/app/[lang]/admin/**               # backoffice routes
src/app/[lang]/me/**                  # member routes
src/app/[lang]/sign-in/[[...sign-in]]/page.tsx
src/app/api/webhooks/{clerk,resend}/route.ts
src/app/api/cron/{dispatch,keepalive}/route.ts
src/app/api/calendar/[token]/route.ts # also handles token "club"
tests/unit/**  tests/integration/**  tests/e2e/**
vitest.config.ts  playwright.config.ts  vercel.ts
```

---

### Task 1: Tooling + core schema (profiles, roles, seasons)

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/0001_core.sql`, `supabase/tests/core.test.sql`, `supabase/seed.sql`, `vitest.config.ts`, `src/lib/env.ts`, `src/lib/result.ts`, `.env.example`
- Modify: `package.json` (scripts `test`, `test:db`, `db:types`, `typecheck`), `.gitignore` (`supabase/.temp`, `.env*.local`)

**Interfaces:**
- Produces (SQL):
  - Schema `app`, not exposed by PostgREST.
  - Enums `member_status`, `staff_role`, `profile_visibility('public','members','private')`.
  - Tables `profiles`, `memberships`, `staff_roles(profile_id, role, granted_by, granted_at, primary key(profile_id))`, `seasons(year int pk, label jsonb, application_opens_at timestamptz, application_closes_at timestamptz, is_current bool)`.
  - Functions: `app.current_profile_id() returns uuid`, `app.is_staff() returns bool`, `app.is_admin() returns bool`. All are `stable security definer set search_path=''`.
- Produces (TS):
  - `serverEnv(): ServerEnv` (zod, throws once with the missing var names, never their values).
  - `publicEnv: { supabaseUrl: string; supabasePublishableKey: string; clerkPublishableKey: string; siteUrl: string }`.
  - `type Result<T, E extends string = ErrorCode> = { ok: true; data: T } | { ok: false; error: E }`.
  - `type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict" | "full" | "closed" | "rate_limited" | "server"`.

- [ ] **Step 1: Init.** Run `npx supabase init`. Add `[auth.third_party.clerk] enabled = true, domain = "env(CLERK_DOMAIN)"` to `supabase/config.toml`. Install the dev deps `vitest @vitest/coverage-v8 tsx` and `zod`.
- [ ] **Step 2: Write the failing pgTAP test** `supabase/tests/core.test.sql`. It uses `set local role authenticated; set local request.jwt.claims = '{"sub":"user_guest","role":"authenticated","iss":"<clerk issuer>"}'` helpers, and asserts:
  - `has_table('public','profiles')`, plus the same for `memberships`, `staff_roles` and `seasons`.
  - As a guest: `select count(*) from profiles` returns only their own row, plus rows with `visibility='public'` through view `public_profiles`.
  - As a guest: `update profiles set status='member' where id=app.current_profile_id()` → `throws_ok` (column privilege revoked; status is writable only by staff RPCs).
  - As a guest: `insert into staff_roles` → throws.
  - As an organizer: `insert into staff_roles` → throws.
  - As an admin: the insert succeeds.
  - A token with `iss` = `https://evil.example` sees 0 rows (restrictive issuer policy).
- [ ] **Step 3: Run** `npx supabase start && npx supabase test db`. Expected: FAIL (tables missing).
- [ ] **Step 4: Write `0001_core.sql`.**
  - Extensions `citext`, `pgcrypto`.
  - `profiles` columns per spec §4. `handle` is unique citext, generated from the name on insert by a trigger, deduped with a `-2`, `-3` suffix. `calendar_token` defaults to `encode(gen_random_bytes(24),'hex')`.
  - RLS enabled on every table.
  - A restrictive policy `issuer_guard` on every table: `(select auth.jwt()->>'iss') = current_setting('app.clerk_issuer', true)` OR the role is `service_role`. The issuer is set with `alter database postgres set app.clerk_issuer = '…'` in seed/config docs.
  - Column-level grants: `authenticated` may update only `name, avatar_path, school, major, grad_year, visibility, locale, links, notif_prefs, onboarded_at`.
- [ ] **Step 5: Run** `npx supabase db reset && npx supabase test db`. Expected: PASS.
- [ ] **Step 6: Write `src/lib/env.ts` and `src/lib/result.ts`,** and add a unit test `tests/unit/env.test.ts`:
  - `serverEnv()` with `RESEND_API_KEY` unset throws an error whose message contains `RESEND_API_KEY`.
  - The error message does not contain any env value.
- [ ] **Step 7: Run** `npx vitest run tests/unit/env.test.ts`. Expected: PASS.
- [ ] **Step 8: Commit** `feat(db): core schema, roles, issuer guard, test tooling`.

### Task 2: Events, teams, registrations + RPCs

**Files:**
- Create: `supabase/migrations/0002_events.sql`, `supabase/tests/events.test.sql`, `tests/integration/capacity.test.ts`, `tests/integration/helpers.ts` (`clientAs(sub: string): SupabaseClient`, which signs a local test JWT with the local Supabase JWT secret — **test-only**)

**Interfaces:**
- Consumes: `app.current_profile_id()`, `app.is_staff()`.
- Produces (SQL):
  - Enums `event_kind, event_mode, event_audience, event_status, reg_status, reg_mode, team_mode`.
  - Tables `events`, `teams`, `event_registrations` (spec §4 columns, plus `decision_notified_at timestamptz` on registrations).
  - View `public_events`: rows with status in (published, completed, archived), excluding `online_url` and `checkin_secret`.
  - Public RPCs (security definer, `set search_path=''`):
    - `register_for_event(p_event uuid, p_answers jsonb, p_team uuid default null) returns reg_status`
    - `cancel_registration(p_event uuid) returns void`
    - `decide_registrations(p_ids uuid[], p_decision text) returns int`. `p_decision` ∈ `accept|reject|waitlist`. Raises `forbidden` unless staff, raises `full` when accepts would exceed capacity.
    - `create_team(p_event uuid, p_name text) returns uuid`
    - `join_team(p_code text) returns uuid`
    - `leave_team(p_team uuid) returns void`
  - Errors are raised as `raise exception using errcode='P0001', message='<ErrorCode>'`, so TS can map `message` → `ErrorCode`.

- [ ] **Step 1: Write the failing pgTAP test** `events.test.sql`:
  - Anon sees a published event through `public_events`, does not see a draft, and never sees `online_url`.
  - A guest RSVP on an rsvp event with capacity 1 → `going`. A second guest → `waitlisted`.
  - The first guest cancels → the second becomes `going`.
  - On an application event, RSVP → `applied`.
  - A guest calling `decide_registrations` → throws `forbidden`.
  - An organizer accepting 2 on capacity 1 → throws `full`.
  - `register_for_event` on `audience='invite'` → throws `closed`. Same after `reg_closes_at`.
  - On `audience='members'` by a guest → `forbidden`.
  - Team max 2: a third `join_team` → throws `full`.
  - A guest cannot `select` another guest's registration or `answers`.
  - Answers missing a `required` question id → throws `invalid`. Server-side check: every required id is present and non-empty. Full typing is in zod in Task 7.
- [ ] **Step 2: Run** `npx supabase test db`. Expected: FAIL.
- [ ] **Step 3: Write `0002_events.sql`.**
  - `register_for_event` does `select … from events where id=p_event for update`. It counts `status in ('going')` against `capacity`. If full, it uses `waitlisted` when `waitlist` is true, else raises `full`. Re-registering after a cancel updates the row.
  - `cancel_registration` promotes the oldest `waitlisted` row when a `going` seat frees.
  - `decide_registrations` sets `decided_by/decided_at` and leaves `decision_notified_at` null (emails go out in Task 4's `send_decisions`).
  - Accepting a registration with `team_id` accepts every `applied` member of that team, unless the caller passes the individual ids only. In that case only those ids change.
- [ ] **Step 4: Write the integration test** `tests/integration/capacity.test.ts`. It seeds an event with capacity 1, then fires `Promise.all` of 10 different guests calling `register_for_event`. Assertions:
  - Exactly 1 `going`, 9 `waitlisted`.
  - Run 5 times.
- [ ] **Step 5: Run** `npx supabase db reset && npx supabase test db && npx vitest run tests/integration/capacity.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(db): events, teams, registrations with capacity-safe RPCs`.

### Task 3: Membership applications + audit log

**Files:**
- Create: `supabase/migrations/0003_membership.sql`, `supabase/tests/membership.test.sql`

**Interfaces:**
- Produces:
  - `membership_applications` (spec §4).
  - `apply_for_membership(p_motivation text, p_team_interest text[], p_answers jsonb) returns uuid`. Requires the current season's window to be open, else `closed`.
  - `review_membership(p_app uuid, p_approve bool, p_note text) returns void`. Staff only. Approve → upsert `memberships(profile, season)` + `profiles.status='member'` atomically.
  - `merge_profiles(p_keep uuid, p_drop uuid) returns void`. Admin only. Moves memberships, registrations and applications, conflict → keep earliest, then soft-deletes the dropped profile.
  - `set_member_status(p_ids uuid[], p_status member_status) returns int`. Staff.
  - `audit_log` + trigger `app.audit()` on `events, event_registrations (status changes only), memberships, staff_roles, membership_applications, profiles (status only)`. It records `actor_profile_id = app.current_profile_id()` and a jsonb diff of changed columns.

- [ ] **Step 1: Write the failing pgTAP test:**
  - A guest applies → `pending`.
  - Applying a second time in the same season → `conflict`.
  - Applying when the window is closed → `closed`.
  - An organizer approves → membership row exists, profile status `member`, one `audit_log` row with `entity='membership_applications'`.
  - A guest calling `review_membership` → `forbidden`.
  - An organizer calling `merge_profiles` → `forbidden`.
  - An admin merges two profiles each with season 2023 → one membership remains, and the dropped profile has `deleted_at` set.
  - A guest cannot read `review_note`. A column grant excludes it, and staff read via view `membership_applications_staff`.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Write `0003_membership.sql`.**
- [ ] **Step 4: Run** `npx supabase db reset && npx supabase test db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): membership applications, merge, audit log`.

### Task 4: Outbox, reminders, change notifications, rate limit, views, cron

**Files:**
- Create: `supabase/migrations/0004_outbox.sql`, `supabase/migrations/0005_cron.sql`, `supabase/tests/outbox.test.sql`

**Interfaces:**
- Produces (tables):
  - `notifications` (spec §4; CHECK `num_nonnulls(profile_id,to_email)=1`; index on `(status, priority, scheduled_at)`).
  - `email_daily_usage`, `email_suppressions`, `subscribers`, `timeline_milestones`.
  - `rate_limits(key text, window_start timestamptz, hits int, primary key(key, window_start))`.
- Produces (functions):
  - `app.enqueue(p_profile uuid, p_email citext, p_template text, p_payload jsonb, p_priority int, p_at timestamptz, p_dedupe text) returns void`. Uses `on conflict (dedupe_key) do nothing`.
  - `app.enqueue_due_reminders() returns int`. Covers `going` registrations for published events with `starts_at` in (now()+23h, now()+25h]. Dedupe is `reminder24:{event}:{profile}:{extract(epoch from starts_at)::bigint}`.
  - `send_decisions(p_event uuid) returns int`. Staff only. Enqueues `application_accepted`/`application_rejected`/`waitlist_notice` for decided rows where `decision_notified_at is null`, then stamps them.
  - `hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns bool`. Returns true when the call is allowed.
  - `claim_outbox(p_limit int) returns setof notifications`. Service role only. Does `update … set status='sending' … for update skip locked`.
- Produces (triggers):
  - `events` after update: if `starts_at|ends_at|venue_name|venue_address|mode` changed on a published event, `ics_sequence += 1` (before-update trigger) and enqueue `event_updated` for every going registrant. Dedupe `event_updated:{event}:{profile}:{ics_sequence}`.
  - Status → `cancelled`: enqueue `event_cancelled`.
  - `register_for_event`/`cancel_registration` paths: enqueue `rsvp_confirmed`, `waitlist_promoted` or `application_received`. Implemented by an after-insert/update trigger on `event_registrations` keyed on the status transition.
  - `review_membership`: enqueue `membership_approved`/`membership_rejected`.
- Produces (views, `security_invoker=on`, staff-only via RLS on base tables):
  - `v_event_stats(event_id, registered, going, waitlisted, applied, attended, new_attendees, returning_attendees)`.
  - `v_kpis(active_members_90d, upcoming_events, rsvps_30d, rsvps_prev_30d, members_total, guests_total)`.
- `0005_cron.sql`: `create extension pg_cron, pg_net`. Every 5 min: `select app.enqueue_due_reminders(); select net.http_post(url := vault 'dispatch_url', headers := jsonb_build_object('x-cron-secret', vault 'cron_secret'))`. Document the `select vault.create_secret(...)` setup in `docs/deploy.md`.

- [ ] **Step 1: Write the failing pgTAP test** `outbox.test.sql`:
  - An RSVP enqueues exactly 1 `rsvp_confirmed`.
  - `enqueue_due_reminders()` run twice → 1 row.
  - Moving `starts_at` +2h then running again → a second `reminder24` row with a different dedupe key, and the old queued row's status becomes `skipped` (the trigger skips queued reminders whose key no longer matches).
  - Setting the event `cancelled` → queued reminders `skipped` and 1 `event_cancelled` per going registrant.
  - `send_decisions` twice → emails enqueued once.
  - `hit_rate_limit('k',60,2)` returns true, true, false.
  - The `notifications` check rejects both `profile_id` and `to_email` set together.
  - A guest cannot select `notifications`.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Write `0004_outbox.sql` and `0005_cron.sql`.** pg_cron is local-optional: guard with `if exists (select 1 from pg_available_extensions where name='pg_cron')`.
- [ ] **Step 4: Run** `npx supabase db reset && npx supabase test db`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): outbox, reminders, change notifications, rate limits, KPI views, cron`.

### Task 5: Typed DB clients, Clerk, proxy, session DAL, Clerk webhook

**Files:**
- Create: `src/lib/db/types.ts` (generated: `npx supabase gen types typescript --local > src/lib/db/types.ts`), `src/lib/db/user.ts`, `src/lib/db/service.ts`, `src/lib/db/public.ts`, `src/lib/db/errors.ts`, `src/lib/server/session.ts`, `src/app/api/webhooks/clerk/route.ts`, `src/lib/members/sync.ts`, `src/app/[lang]/sign-in/[[...sign-in]]/page.tsx`, `tests/unit/sync.test.ts`
- Modify: `src/proxy.ts` (wrap with `clerkMiddleware`), `src/app/[lang]/layout.tsx` (`<ClerkProvider>` with `localization` from `@clerk/localizations` for `en`; Mongolian falls back to en plus our own overrides object), `eslint.config.mjs` (restrict `@/lib/db/service` imports to the allowed paths)

**Interfaces:**
- Produces:
  - `userDb(): Promise<SupabaseClient<Database>>`. Server only. Uses `accessToken: async () => (await auth()).getToken()`.
  - `publicDb(): SupabaseClient<Database>`. Anon, for `use cache` reads; no cookies.
  - `serviceDb(): SupabaseClient<Database>`. `import "server-only"`.
  - `toErrorCode(e: PostgrestError | null): ErrorCode`. Maps `P0001` messages, else `"server"`.
  - `type Session = { clerkUserId: string; profileId: string; status: "guest"|"member"|"alumni"; staffRole: "organizer"|"admin"|null; locale: Locale; onboarded: boolean }`.
  - `getSession(): Promise<Session | null>`. Wrapped in `cache()` from React; lazy-upserts the profile via `upsertProfileFromClerk` if no row exists.
  - `requireSession(lang: Locale): Promise<Session>` (page helper). Redirects to `/{lang}/sign-in?redirect_url=…` when signed out.
  - `requireStaffPage(lang: Locale, role?: "admin"): Promise<Session>`. Calls `notFound()` for non-staff, so admin pages are invisible.
  - `requireStaffAction(role?: "admin"): Promise<Result<Session>>` (action helper).
  - `upsertProfileFromClerk(db: SupabaseClient<Database>, u: ClerkUserLike): Promise<{ profileId: string; claimed: boolean }>`. Matches an existing row by `clerk_user_id`, else claims the unclaimed profile with the same verified primary email, else inserts.
  - `anonymizeProfile(db, clerkUserId: string): Promise<void>`.
  - On a profile insert (not on claim or update), `upsertProfileFromClerk` also inserts a `welcome` notification row (priority 0, dedupe `welcome:{profileId}`).
- Proxy behavior:
  - Keep all existing locale logic intact as `localeProxy(req)`.
  - `export const proxy = clerkMiddleware(async (auth, req) => { … })`.
  - Optimistic redirect only: for paths matching `^/(mn|en)/(admin|me)(/|$)`, if `!(await auth()).userId` → redirect to sign-in. Otherwise return `localeProxy(req)`.
  - The matcher is unchanged (API routes use their own auth; the webhook and cron must not run Clerk).
  - Remove the `EVENTS` import from the proxy; Task 15 moves the slug check.

- [ ] **Step 1: Install** `@clerk/nextjs @clerk/localizations @supabase/supabase-js`. Read `node_modules/@clerk/nextjs` README sections on `clerkMiddleware` with Next 16 `proxy.ts` and on `verifyWebhook` from `@clerk/nextjs/webhooks`. Use `verifyWebhook` (svix under the hood).
- [ ] **Step 2: Write the failing unit tests** `tests/unit/sync.test.ts`, with the DB faked by an in-memory stub implementing the 3 queries used:
  - A new user with no match → insert. Returns `claimed:false`.
  - An unclaimed profile with the same email (case-insensitive) → link. Returns `claimed:true`, and `clerk_user_id` is set.
  - An unverified email never claims.
  - Running twice is idempotent (a single row).
  - `anonymizeProfile` blanks `email, name, school, major, links, avatar_path`, sets `deleted_at`, and keeps the `id`.
  - A new insert queues exactly one `welcome` notification. A claim queues none.
- [ ] **Step 3: Run** `npx vitest run tests/unit/sync.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** `sync.ts`, the db clients, `session.ts`, the webhook route, the proxy change, the layout provider and the sign-in page (Clerk `<SignIn/>` inside the glass card, using the existing `.glass` class).
  - The webhook handles `user.created`, `user.updated` and `user.deleted`.
  - It logs `clerk_webhook_handled` with `{ event_type, outcome }`.
  - Bad signature → 400.
- [ ] **Step 5: Run** `npx vitest run && npx tsc --noEmit && npm run lint`. Expected: PASS. The lint rule fails if `src/app/[lang]/**` imports `@/lib/db/service` (verify by temporarily adding such an import, then remove it).
- [ ] **Step 6: Manual check.** `npm run dev`, then sign in with an email code:
  - `/mn/me` shows a placeholder, and a profile row exists in local Supabase.
  - The webhook was not configured locally, which proves the lazy upsert works (Review Focus 5).
  - `/mn/admin` as a guest → 404.
- [ ] **Step 7: Commit** `feat(auth): Clerk + Supabase third-party auth, session DAL, webhook sync`.

### Task 6: Legacy import

**Files:**
- Create: `scripts/import-legacy.ts`, `tests/unit/import-map.test.ts`, `src/lib/members/legacy-map.ts`

**Interfaces:**
- Consumes: `serviceDb()`, `EVENTS` (`src/lib/events.ts`), `MEMBERS`/`SEASONS` (`src/data/members.ts`), `TIMELINE`/`TIMELINE_MEDIA` (`src/lib/club.ts`), `EVENT_STICKER` (`src/lib/manul.ts`).
- Produces:
  - `mapLegacyEvent(e: Event): EventInsert`: `status:'archived'`, `reg_mode:'rsvp'`, `legacy_participants: e.participants`, `starts_at` parsed from `e.year` (year-only → `YYYY-01-01T00:00+08`, with an `approximate_date` boolean column added to `events` in this task's migration `0006_legacy.sql`).
  - `groupLegacyMembers(members: Member[]): LegacyPerson[]`: one person per normalized `(name.mn, name.en)`, where normalization is trim, collapse spaces and lowercase. Each person carries `{ seasons: {season, team, role}[] }`.
  - The script: `npx tsx scripts/import-legacy.ts [--dry-run]` upserts events by `slug`, profiles by `handle` (`clerk_user_id null`, `visibility:'public'`), memberships, and timeline by `(year, sort)`. Posters/photos stay in `/public` (paths stored as-is), so no Storage upload is needed in S1. It also imports subscribers from a CSV given with `--subscribers <file.csv>`.

- [ ] **Step 1: Write the failing tests:**
  - `mapLegacyEvent` on a fixture event with `dates:"2024"` → `starts_at` is `2024-01-01T00:00:00+08:00` and `approximate_date: true`.
  - `participants: null` → `legacy_participants: null`.
  - `groupLegacyMembers` on a fixture of the same name in 2022 and 2023 → 1 person with 2 seasons. Names differing only by whitespace or case → 1 person.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the map functions and the script. `--dry-run` prints counts only (events, people, memberships, milestones); never print names.
- [ ] **Step 4: Run** `npx vitest run tests/unit/import-map.test.ts && npx tsx scripts/import-legacy.ts` against local, then run it again. Expected: identical counts on both runs, and `select count(*) from events` equals `EVENTS.length`.
- [ ] **Step 5: Commit** `feat(data): idempotent legacy import`.

### Task 7: Pure libs — ICS, Google Calendar link, questions → zod, dedupe

**Files:**
- Create: `src/lib/calendar/ics.ts`, `src/lib/calendar/gcal.ts`, `src/lib/events/questions.ts`, `src/lib/notify/dedupe.ts`, `tests/unit/ics.test.ts`, `tests/unit/questions.test.ts`

**Interfaces:**
- Produces:
  - `type IcsEvent = { uid: string; sequence: number; start: Date; end: Date; title: string; description: string; location: string; url: string; method: "REQUEST" | "CANCEL" | "PUBLISH"; organizerEmail: string }`.
  - `buildIcs(events: IcsEvent[], calName?: string): string`.
  - `googleCalendarUrl(e: Pick<IcsEvent,"title"|"start"|"end"|"description"|"location">): string`.
  - `type Question = { id: string; type: "short"|"long"|"select"|"multi"|"checkbox"|"url"; label: L; required: boolean; options?: L[] }`.
  - `questionsSchema: z.ZodType<Question[]>`, used by the admin builder; ids are unique and match `^[a-z0-9_]{1,32}$`, with at most 20 questions.
  - `answersSchema(qs: Question[]): z.ZodType<Record<string, string | string[] | boolean>>`. Limits: short ≤200, long ≤2000, url is http(s), select ∈ options index as a string, multi a subset.
  - `dedupe.reminder24(eventId, profileId, startsAt: Date)` must equal the SQL format in Task 4.

- [ ] **Step 1: Write the failing tests** `ics.test.ts`:
  - The output uses CRLF line endings.
  - `UID:` equals the input.
  - `SEQUENCE:3` is present.
  - `METHOD:CANCEL` produces `STATUS:CANCELLED`.
  - DTSTART is in UTC `Z` form (e.g. `20261201T100000Z` for `2026-12-01T18:00+08:00`).
  - Commas, semicolons and newlines are escaped.
  - No line is longer than 75 octets.
  - A title of 60 Cyrillic characters folds without splitting a code point: `Buffer.from(unfolded,'utf8').toString()` round-trips and has no `�`.
  - `googleCalendarUrl` contains `dates=20261201T100000Z/20261201T120000Z`.
- [ ] **Step 2: Write the failing tests** `questions.test.ts`:
  - A required short answer missing → error at path `[id]`.
  - A select with an out-of-range index → error.
  - Extra unknown keys are stripped.
  - Duplicate question ids → `questionsSchema` error.
  - `dedupe.reminder24` equals `reminder24:e1:p1:1795600800` for `2026-11-25T10:00:00Z`.
- [ ] **Step 3: Run** `npx vitest run tests/unit/ics.test.ts tests/unit/questions.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** all four modules (no ICS library; folding is done at UTF-8 code-point boundaries).
- [ ] **Step 5: Run** the tests. Expected: PASS.
- [ ] **Step 6: Commit** `feat(lib): ics builder, gcal links, question schemas, dedupe keys`.

### Task 8: Email templates + dispatcher + keepalive + Resend webhook

**Files:**
- Create: `src/emails/Layout.tsx`, `src/emails/templates.tsx`, `src/emails/render.ts`, `src/lib/notify/plan.ts`, `src/lib/notify/resend.ts`, `src/lib/notify/dispatch.ts`, `src/app/api/cron/dispatch/route.ts`, `src/app/api/cron/keepalive/route.ts`, `src/app/api/webhooks/resend/route.ts`, `vercel.ts`, `tests/unit/plan.test.ts`, `tests/unit/render.test.ts`, `tests/integration/dispatch.test.ts`

**Interfaces:**
- Consumes: `claim_outbox` RPC, `buildIcs`, `googleCalendarUrl`, `serviceDb()`.
- Produces:
  - `type TemplateName = "welcome"|"rsvp_confirmed"|"waitlist_promoted"|"waitlist_notice"|"application_received"|"application_accepted"|"application_rejected"|"membership_approved"|"membership_rejected"|"event_updated"|"event_cancelled"|"reminder_24h"|"announcement"`.
  - `renderEmail(t: TemplateName, payload: EmailPayload, lang: Locale): Promise<{ subject: string; html: string; text: string; ics?: IcsEvent }>`. ICS is attached for `rsvp_confirmed`, `application_accepted`, `waitlist_promoted`, `event_updated` (REQUEST) and `event_cancelled` (CANCEL).
  - `planBatch(rows: OutboxRow[], sentToday: number, opts: { daily: 100; reserve: 20 }): { send: OutboxRow[]; defer: OutboxRow[] }`. Priority 0 may use the full 100; priorities 1–2 may use only up to 80. Within budget, rows are ordered by priority then `scheduled_at`.
  - `dispatchOnce(limit = 50): Promise<{ sent: number; skipped: number; failed: number; deferred: number }>`. Before sending, it re-reads each registration/event and marks the row `skipped` if the event is cancelled (except `event_cancelled`), the registration is no longer `going` (for reminders), the address is suppressed, or `notif_prefs` opts out (category map is in `plan.ts`). The Resend `idempotencyKey` is `dedupe_key`. On failure: `attempts+1`, status back to `queued` with `scheduled_at = now() + 2^attempts minutes`, then `failed` after 5. It increments `email_daily_usage`.
  - `/api/cron/dispatch`:
    - POST; header `x-cron-secret` compared with `timingSafeEqual`, else 401.
    - Calls `dispatchOnce`.
    - Logs `outbox_dispatched` with the counts.
  - `/api/cron/keepalive`: GET with `Authorization: Bearer ${CRON_SECRET}` (the Vercel cron convention). It runs `select 1` via `serviceDb`.
  - `vercel.ts`: `crons: [{ path: '/api/cron/keepalive', schedule: '0 3 * * *' }]`.
  - `/api/webhooks/resend`: verifies the signature with `RESEND_WEBHOOK_SECRET` (svix headers). On `email.bounced` or `email.complained`, it upserts `email_suppressions`.

- [ ] **Step 1: Write the failing tests:**
  - `plan.test.ts`:
    - `sentToday=79` with 3 priority-2 rows → send 1, defer 2.
    - `sentToday=95` with 1 priority-0 and 1 priority-1 → send the priority-0 only.
    - `sentToday=100` → send none.
  - `render.test.ts`:
    - Every `TemplateName` renders in `mn` and `en` with a non-empty subject.
    - `rsvp_confirmed` includes a gcal link and an ICS object with method `REQUEST`.
    - `event_cancelled` produces an ICS object with method `CANCEL`.
    - The `mn` subject for `rsvp_confirmed` contains the Cyrillic event title unchanged.
  - `dispatch.test.ts` (local Supabase, Resend mocked by injecting a `send` function into `dispatchOnce({ send })`):
    - A cancelled event's queued reminder becomes `skipped`, and `send` is not called.
    - A send failure sets `attempts=1`, status `queued` and a future `scheduled_at`.
    - A suppressed email becomes `skipped`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Install `resend @react-email/components`. The email layout uses brand blue `#0085ca`, the logo `public/img/brand/logo-128.png` as an absolute URL from `SITE_URL`, and an unsubscribe/preferences link to `/{lang}/me/settings`.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Manual check.**
  - With `npm run dev`, an RSVP via SQL then `curl -X POST localhost:3000/api/cron/dispatch -H "x-cron-secret: $CRON_SECRET"` delivers to the Resend test inbox.
  - Opening the .ics in Apple Calendar and importing it into Google Calendar shows the correct UB local time.
- [ ] **Step 6: Commit** `feat(notify): email templates, outbox dispatcher, keepalive, bounce suppression`.

### Task 9: Calendar feeds

**Files:**
- Create: `src/app/api/calendar/[token]/route.ts`, `tests/integration/calendar-feed.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/calendar/{calendar_token}.ics` returns the user's `going` events, using the RPC `calendar_feed(p_token text)`, which is security definer, granted to anon, and returns event rows only.
  - `GET /api/calendar/club.ics` returns all published upcoming events.
  - Headers: `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900`. An unknown token returns 404 with a body that does not reveal whether the token exists.
  - Rate limit 60/h per token via `hit_rate_limit`.

- [ ] **Step 1: Write the failing test.**
  - A valid token returns 200 with 1 VEVENT for a going event and none for a cancelled registration.
  - An invalid token returns 404.
  - `club` excludes drafts.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the route (add `calendar_feed` to migration `0007_calendar.sql`).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(calendar): personal and club ICS feeds`.

### Task 10: Design tokens + UI primitives

**Files:**
- Modify: `src/app/globals.css` (add tokens: `--color-danger: #d93a3a`, `--color-warn: #8a6d00` (sun darkened, 4.5:1 on paper), `--color-line: color-mix(in srgb, var(--color-ink) 10%, transparent)`, `--radius-sm: 10px`, `--radius-md: 14px`, utility `.tnum { font-variant-numeric: tabular-nums }`)
- Create in `src/components/ui/`: `Button.tsx`, `IconButton.tsx`, `Field.tsx` (label + hint + error wrapper; Input, Textarea and Select use it), `BilingualField.tsx`, `DateTimeField.tsx`, `StatusPill.tsx`, `KpiCard.tsx`, `CapacityBar.tsx`, `DataTable.tsx`, `FilterBar.tsx`, `Tabs.tsx`, `Drawer.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `Avatar.tsx` (incl. `AvatarStack`), `src/app/[lang]/admin/_kit/page.tsx` (a staff-only gallery rendering every primitive in every state)
- Test: `tests/unit/ui.test.tsx` (Vitest + `@testing-library/react` + jsdom)

**Interfaces:**
- Produces:
  - `StatusPill({ status }: { status: EventStatus | RegStatus | MemberStatus | ApplicationStatus | "live" })`. The colour/label map lives in one `STATUS_STYLE` record; labels come from `dict.status`.
  - `BilingualField({ name, label, value: L, onChange, multiline?, required?: "mn" | "both" })`: mn and en side by side (stacked under 768px), a "copy from mn" IconButton, and an "EN missing" hint.
  - `DateTimeField({ name, value: Date | null, onChange })`. A native `datetime-local` interpreted as Asia/Ulaanbaatar regardless of the browser tz, with the "UTC+8" label shown.
  - `DataTable<T>({ rows, columns: Column<T>[], getId, selectable?, onSelectionChange?, empty: ReactNode })`. Sticky header, sortable columns, keyboard row focus. Client-side for ≤500 rows; pagination is passed by the server above that.
  - `ConfirmDialog({ title, body, confirmLabel, tone: "danger"|"default", onConfirm })`. The copy must name the object and count, per spec §7.
  - `EmptyState({ sticker: StickerName, title, line, action? })` reuses `Sticker`.
  - Install `lucide-react @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-dropdown-menu @radix-ui/react-popover @radix-ui/react-toast`, and the dev deps `@testing-library/react jsdom`.

- [ ] **Step 1: Write the failing tests:**
  - `DateTimeField`: typing `2026-12-01T18:00` emits a Date equal to `2026-12-01T10:00:00Z` with `process.env.TZ='America/New_York'`.
  - `BilingualField`: "copy from mn" copies the value, and the EN-missing hint shows when en is empty.
  - `ConfirmDialog`: confirm is not called on Escape, and focus returns to the trigger.
  - `StatusPill`: every enum value has a style (a type-level exhaustiveness check via `satisfies Record<…>`, plus a runtime iteration test).
  - `DataTable`: the header click toggles aria-sort.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the primitives and add `dict.status`, `dict.ui` keys to `mn.ts` and `en.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/ui.test.tsx && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Visual check.** Open `/mn/admin/_kit` at 390, 768 and 1440 widths (Playwright screenshots in `tests/e2e/kit.spec.ts`, kept as a smoke test). Check focus rings are visible and there is no horizontal scroll.
- [ ] **Step 6: Commit** `feat(ui): ops design tokens and primitives`.

### Task 11: Admin shell + Dashboard

**Files:**
- Create: `src/app/[lang]/admin/layout.tsx`, `src/app/[lang]/admin/page.tsx`, `src/components/admin/{Sidebar.tsx,TopBar.tsx,NeedsAttention.tsx,UpcomingList.tsx}`, `src/lib/admin/dashboard.ts`
- Modify: `src/app/[lang]/layout.tsx`. Admin and me routes must not render the public `Header`/`Footer`/`Cursor`/`SmoothScroll`; move those into a route group `src/app/[lang]/(site)/layout.tsx` and move the existing public pages into `(site)` with **no URL change**.

**Interfaces:**
- Consumes: `requireStaffPage`, `userDb`, `v_kpis`, `v_event_stats`, `KpiCard`, `StatusPill`, `EmptyState`.
- Produces:
  - `getDashboard(): Promise<{ kpis: Kpis; upcoming: UpcomingEvent[]; attention: AttentionItem[] }>`.
  - `type AttentionItem = { kind: "missing_cover"|"failed_emails"|"pending_members"|"pending_applications"|"needs_en"; count: number; href: string }`.
  - The sidebar nav items for S1 are Dashboard, Events, Members, Comms, Settings and Audit. Pages from later slices are not shown.
  - Layout: a sticky glass `TopBar` (the one glass surface), a paper sidebar collapsing to a drawer under 1024px, and a session read inside `<Suspense>`.

- [ ] **Step 1: Write the failing test** `tests/unit/dashboard.test.ts` for the pure `toAttention(raw)`:
  - Zero counts are omitted.
  - Items are ordered failed_emails > pending_applications > pending_members > missing_cover > needs_en.
  - KPI delta: `rsvps_30d=12, prev=8` → `+50%`. `prev=0` → shows `new`, not `Infinity`.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the shell, the route-group move and the dashboard.
- [ ] **Step 4: Run** `npx vitest run && npm run build`. Expected: PASS, and the build still prerenders public pages (check the build output lists `/[lang]` routes as static/partial).
- [ ] **Step 5: Commit** `feat(admin): shell, route groups, dashboard`.

### Task 12: Admin Events — list, create, edit (questions, teams, staged edit)

**Files:**
- Create: `src/app/[lang]/admin/events/page.tsx`, `src/app/[lang]/admin/events/new/page.tsx`, `src/app/[lang]/admin/events/[id]/layout.tsx` (tabs), `src/app/[lang]/admin/events/[id]/page.tsx` (Overview), `src/components/admin/events/{EventForm.tsx,QuestionBuilder.tsx,StagedChangeDialog.tsx,EventsTable.tsx}`, `src/lib/events/actions.ts`, `src/lib/events/schema.ts`, `tests/unit/event-schema.test.ts`

**Interfaces:**
- Consumes: `requireStaffAction`, `userDb`, `questionsSchema`, `BilingualField`, `DateTimeField`, `DataTable`, `ConfirmDialog`.
- Produces:
  - `eventInputSchema: z.ZodType<EventInput>`. Rules:
    - `slug` matches `^[a-z0-9-]{3,60}$`.
    - `title.mn` is required.
    - `ends_at > starts_at`.
    - `capacity` is null or 1..5000.
    - `reg_closes_at ≤ starts_at`.
    - Application mode requires `decision_deadline`.
    - `team_mode !== 'none'` ⇒ `1 ≤ team_size_min ≤ team_size_max ≤ 10`.
    - Online/hybrid requires `online_url` (https).
  - Server actions:
    - `createEvent(input: EventInput): Promise<Result<{ id: string }>>`
    - `updateEvent(id: string, input: EventInput): Promise<Result<{ notified: number }>>`
    - `previewEventChange(id: string, input: EventInput): Promise<Result<{ changed: string[]; willNotify: number }>>`
    - `setEventStatus(id: string, status: "published"|"cancelled"|"completed"|"draft"): Promise<Result<void>>`
  - Every mutation calls `revalidateTag("events")` and `revalidateTag(\`event:${slug}\`)`.
  - UI rules:
    - Saving a published event whose time/venue/mode changed opens `StagedChangeDialog`. It shows a diff and "N people will get an updated invite", and commits only on confirm.
    - Cancel uses `ConfirmDialog` with the title and going count in the copy.
    - The events list shows a status pill, date (UB), kind, RSVP/capacity `CapacityBar`, and filters for status, kind and season. The calendar toggle is deferred to S5.

- [ ] **Step 1: Write the failing tests** `event-schema.test.ts`, one assertion per rule above. Each invalid case fails at the expected path.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, actions and UI. Actions: `requireStaffAction()` first, zod parse, then the DB write via `userDb()` (RLS: staff insert/update on `events`). Map errors with `toErrorCode`, and log `event_saved` with `{ event_id, outcome }`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Manual check.** As an organizer:
  - Create a hackathon with 3 questions and teams of 2–4, then publish it.
  - Edit its time: the staged dialog shows "0 people". RSVP a seed guest, edit again: it shows "1", and an `event_updated` row is queued.
- [ ] **Step 6: Commit** `feat(admin): event list, create/edit with question builder and staged changes`.

### Task 13: Admin Event detail — Registrations, Analytics, Comms

**Files:**
- Create: `src/app/[lang]/admin/events/[id]/registrations/page.tsx`, `src/app/[lang]/admin/events/[id]/analytics/page.tsx`, `src/app/[lang]/admin/events/[id]/comms/page.tsx`, `src/components/admin/events/{RegistrationsTable.tsx,TeamView.tsx,DecisionBar.tsx,SendDecisionsDialog.tsx}`, `src/app/[lang]/admin/events/[id]/registrations/export/route.ts`, `src/lib/events/registrations.ts`, `tests/unit/csv.test.ts`

**Interfaces:**
- Consumes: the `decide_registrations` and `send_decisions` RPCs, `v_event_stats`, `notifications` (staff select policy added here if missing).
- Produces:
  - `decide(eventId: string, ids: string[], decision: "accept"|"reject"|"waitlist"): Promise<Result<{ changed: number }>>`
  - `sendDecisions(eventId: string): Promise<Result<{ queued: number }>>`
  - `addRegistrant(eventId: string, profileId: string): Promise<Result<void>>` (for invite audience)
  - `toCsv(rows: RegistrationRow[], questions: Question[], lang: Locale): string`. RFC 4180 quoting, UTF-8 BOM (Excel + Cyrillic), one column per question.
  - The export route uses `requireStaffAction` and returns `Content-Disposition: attachment; filename="<slug>-registrations.csv"`.
  - UI rules:
    - Filters: status, team/no-team, and per-question answer filters for select questions.
    - The Team view groups by team with team-level accept/reject.
    - `DecisionBar` shows `accepted / capacity` live.
    - "Send decisions (N accepted · M rejected · K waitlisted)" opens a confirm and then calls `sendDecisions`.
    - Analytics tab: KPI cards (registered, going, waitlisted, applied, new vs returning) plus a by-school bar (hand-rolled SVG; follow the `dataviz` skill).
    - Comms tab: the outbox rows for this event with a status pill, template, scheduled/sent time and attempts. It never shows email addresses, only names.

- [ ] **Step 1: Write the failing tests** `csv.test.ts`:
  - The output starts with a BOM.
  - A value with a comma, quote or newline is quoted and escaped.
  - Multi answers are joined with `; `.
  - The header uses question labels in `lang`.
  - Formula injection: values starting with `= + - @` are prefixed with `'`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Manual check.** Two seed guests form a team and apply. The organizer accepts the team in Team view, then clicks Send decisions: 2 `application_accepted` rows are queued. Clicking again queues 0.
- [ ] **Step 6: Commit** `feat(admin): registrations review, teams, decisions, CSV, event analytics`.

### Task 14: Admin Members, Settings, Comms outbox, Audit

**Files:**
- Create: `src/app/[lang]/admin/members/page.tsx` (Directory), `src/app/[lang]/admin/members/applications/page.tsx`, `src/app/[lang]/admin/members/merge/page.tsx`, `src/components/admin/members/{MembersTable.tsx,MemberDrawer.tsx,ApplicationCard.tsx,MergePicker.tsx}`, `src/lib/members/actions.ts`, `src/app/[lang]/admin/settings/page.tsx` (Seasons + Staff roles tabs), `src/app/[lang]/admin/comms/page.tsx` (Outbox + budget meter), `src/app/[lang]/admin/audit/page.tsx`, `src/lib/admin/duplicates.ts`, `tests/unit/duplicates.test.ts`

**Interfaces:**
- Consumes: the `review_membership`, `merge_profiles` and `set_member_status` RPCs; `staff_roles`, `seasons`, `email_daily_usage`, `audit_log`.
- Produces:
  - `reviewApplication(id: string, approve: boolean, note: string): Promise<Result<void>>`
  - `setStatus(ids: string[], status: MemberStatus): Promise<Result<{ changed: number }>>`
  - `mergeProfiles(keep: string, drop: string): Promise<Result<void>>` (admin)
  - `upsertSeason(input: SeasonInput): Promise<Result<void>>` (admin; exactly one `is_current`, enforced with a partial unique index added in `0008_admin.sql`)
  - `grantRole(profileId: string, role: StaffRole | null): Promise<Result<void>>` (admin; cannot remove own admin role, error `conflict`)
  - `suggestDuplicates(people: { id: string; name: L; email: string | null }[]): { a: string; b: string; score: number }[]`. Normalized-name equality = 1.0, Levenshtein ≤2 on the normalized mn name = 0.8, same email = 1.0. Returns pairs with score ≥0.8, sorted descending.
  - Directory columns: name, status pill, current-season team, events attended, last seen. Bulk actions: promote to member, mark alumni, add to season. Row → `MemberDrawer` with the profile, season history and registrations.
  - The Comms page shows the outbox table (filters: status, template), "Retry" on failed rows (resets to queued; staff policy), and a budget meter `sent today / 100` with the 20 reserved shown.
  - The Audit page shows a filterable table of actor, action, entity and time, with the diff in a Drawer.

- [ ] **Step 1: Write the failing tests** `duplicates.test.ts`:
  - "Бат-Эрдэнэ" vs "бат-эрдэнэ " → 1.0.
  - "Батболд" vs "Батбold" → not matched.
  - Levenshtein 2 → 0.8.
  - There are no self-pairs, and each pair appears once.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the pages and actions.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Manual check.**
  - An admin opens a season application window. A guest applies via the SQL RPC; the organizer approves it in Applications; the member's status pill flips; and the audit row shows.
  - An organizer opening `/admin/settings` → 404 (admin only).
- [ ] **Step 6: Commit** `feat(admin): members directory, applications, merge, settings, outbox, audit`.

### Task 15: Public site reads from DB

**Files:**
- Create: `src/lib/events/queries.ts`, `src/lib/club/queries.ts`, `tests/e2e/public.spec.ts`
- Modify: `src/lib/events.ts` (keep the `Event` type and `findEvent` signature, but source from DB), `src/app/[lang]/(site)/events/page.tsx`, `src/app/[lang]/(site)/events/[slug]/page.tsx`, `src/app/[lang]/(site)/page.tsx`, `src/app/[lang]/(site)/about/page.tsx`, `src/app/api/subscribe/route.ts` (`deliver()` → insert into `subscribers` via `serviceDb`; keep all existing hardening; replace the in-memory `limited()` with `hit_rate_limit`), `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `publicDb()`, `public_events`, `timeline_milestones`, `public_profiles` + `memberships`.
- Produces:
  - `getPublicEvents(): Promise<Event[]>` — `'use cache'`, `cacheTag('events')`, `cacheLife('hours')`
  - `getPublicEvent(slug: string): Promise<PublicEvent | null>` — `'use cache'`, `cacheTag('events', \`event:${slug}\`)`
  - `getTimeline(): Promise<Milestone[]>` — `cacheTag('timeline')`
  - `getRoster(): Promise<{ members: Member[]; seasons: number[] }>` — `cacheTag('members')`
  - Each returns the **exact shapes** existing components already take (`Event`, `Milestone`, `Member`), so `EventTicket`, `Timeline` and `Members` don't change.
  - On DB error each falls back to the static import (`src/data/*` stays until S1 sign-off) and logs `public_data_fallback` at WARN.
  - `[slug]/page.tsx`: `generateStaticParams` from `getPublicEvents()`. The `getPublicEvent(slug)` + `notFound()` happen **at the top level of the page component, outside any Suspense**. Remove the slug check from `proxy.ts`.

- [ ] **Step 1: Write the failing e2e test** `public.spec.ts`:
  - `/mn/events` lists `EVENTS.length` tickets.
  - `/en/events/<known-slug>` returns 200 and shows the English name.
  - `request.get('/mn/events/does-not-exist')` returns status **404** (Review Focus 1).
  - `/mn/events/%E0%A4%A` → redirects to the 404 page, as today.
  - The home page timeline has 16 items.
  - The About page shows member names.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/public.spec.ts` against `npm run build && npm start` with local Supabase seeded by Task 6. Expected: the 404 assertion FAILs before the change, after the proxy check is removed.
- [ ] **Step 3: Implement.** Compare screenshots before and after at 390, 768 and 1440 for `/mn`, `/mn/events`, `/mn/about`; they must look identical (the Playwright `toHaveScreenshot` baseline is taken before the change).
- [ ] **Step 4: Run** `npm run build && npx playwright test tests/e2e/public.spec.ts`. Expected: PASS, including the 404 status and the screenshots.
- [ ] **Step 5: Commit** `feat(site): public pages and subscribe backed by Supabase`.

### Task 16: Member app — onboarding, RSVP/Apply, teams, membership, profile, settings

**Files:**
- Create: `src/app/[lang]/me/layout.tsx` (bottom nav: Home, Events, Profile, Settings), `src/app/[lang]/me/page.tsx`, `src/app/[lang]/me/onboarding/page.tsx`, `src/app/[lang]/me/events/page.tsx` (tabs Upcoming · Going · Applied · Past), `src/app/[lang]/me/events/[slug]/apply/page.tsx`, `src/app/[lang]/me/teams/[id]/page.tsx`, `src/app/[lang]/me/membership/page.tsx`, `src/app/[lang]/me/profile/page.tsx`, `src/app/[lang]/me/settings/page.tsx`, `src/components/me/{BottomNav.tsx,RsvpButton.tsx,ApplyForm.tsx,TeamStep.tsx,OnboardingForm.tsx,PrefsForm.tsx}`, `src/lib/me/actions.ts`, `tests/e2e/member.spec.ts`
- Modify: `src/app/[lang]/(site)/events/[slug]/page.tsx` (add a `<Suspense>`-wrapped `RsvpButton` island, `CapacityBar`, and add-to-calendar links; the static shell is unchanged); `src/app/[lang]/(site)/join/page.tsx` (primary CTA "Create account" → `/{lang}/sign-in`; the subscribe form stays as the secondary option; copy in `dict.join`)

**Interfaces:**
- Consumes: `requireSession`, the `register_for_event`/`cancel_registration`/`create_team`/`join_team`/`leave_team`/`apply_for_membership` RPCs, `answersSchema`, `googleCalendarUrl`, `hit_rate_limit`.
- Produces:
  - `completeOnboarding(input: { name: L; school: string; grad_year: number; locale: Locale }): Promise<Result<void>>`. `grad_year` is 2000..2040 and `name.mn` is required.
  - `rsvp(eventId: string): Promise<Result<{ status: RegStatus }>>`. Rate-limited to 10/min per profile.
  - `cancelRsvp(eventId: string): Promise<Result<void>>`
  - `apply(eventId: string, answers: unknown, team: { mode: "create"; name: string } | { mode: "join"; code: string } | { mode: "solo" }): Promise<Result<{ status: RegStatus; teamId?: string; inviteCode?: string }>>`. Answers are parsed with `answersSchema(event.questions)` before the RPC.
  - `applyMembership(input: { motivation: string; team_interest: string[] }): Promise<Result<void>>`
  - `updatePrefs(input: { notif_prefs: NotifPrefs; locale: Locale; visibility: Visibility }): Promise<Result<void>>`
  - `RsvpButton` states: signed-out → "I'm going" opens the Clerk sign-in with a `redirect_url` back to the event; not onboarded → `/me/onboarding?next=`; `going` → "You're going ✓ · Cancel"; `waitlisted` → position text; `closed`/`full`/`invite` → disabled with the reason. Application events show "Apply" linking to the apply page.
  - Home: the next going event as an `EventTicket` (reused) with a countdown, pending application statuses, and a membership CTA when the season window is open and the user is a guest.
  - Settings: email prefs per category (reminders, event updates, announcements), the calendar feed with a `webcal://` link and copy button (300ms icon swap), language, and Clerk `<UserProfile/>` for passkeys and delete.
  - Onboarding gate: `requireSession` + `!onboarded` → redirect to onboarding from every `/me` page except onboarding itself.

- [ ] **Step 1: Write the failing e2e test** `member.spec.ts`, using `@clerk/testing/playwright` `setupClerkTestingToken`:
  - A new user signs up with an email code (`+clerk_test` address), gets redirected to onboarding, and lands on `/mn/me` after submitting.
  - On the seed rsvp event, "I'm going" → the button shows going, and `notifications` has `rsvp_confirmed` (checked via a test-only `serviceDb` query in the spec).
  - Cancelling shows the button again.
  - On the seed hackathon: the user creates a team and gets an invite code. A second test user joins with the code and applies → both are `applied`.
  - Submitting with a required answer missing shows an inline error on that field, with focus moved to it.
  - Membership apply → the status shows pending.
  - A guest visiting `/mn/admin` → 404. A signed-out user visiting `/mn/me` → the sign-in page.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/member.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Install `@clerk/testing` and `@playwright/test` as dev deps.
- [ ] **Step 4: Run** `npx playwright test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(me): onboarding, RSVP, applications with teams, membership, settings`.

### Task 17: Slice sign-off — docs, advisors, full verification

**Files:**
- Modify: `docs/deploy.md` (env table from spec §9; Clerk ↔ Supabase third-party setup; `alter database … set app.clerk_issuer`; vault secrets for pg_cron; Resend domain + webhook; Clerk webhook URL; Vercel cron), `README.md` (replace the boilerplate with local dev: `supabase start`, `.env.local`, `npm run dev`, test commands)
- Delete (only after all checks below pass): the static fallbacks `src/data/events.json` and `src/data/members.ts`, plus the `TIMELINE*` parts of `src/lib/club.ts`. Keep them if the user prefers a longer fallback period, and ask first.

- [ ] **Step 1: Run** `npx tsc --noEmit && npm run lint && npm run build`. Expected: clean.
- [ ] **Step 2: Run** `npx supabase db reset && npx supabase test db && npx vitest run && npx playwright test`. Expected: all PASS.
- [ ] **Step 3: Run the Supabase advisors** (`get_advisors` security + performance) against local/remote. Expected: no RLS-disabled tables, no `security definer` function without `search_path`, and no unindexed FKs on `event_registrations`, `notifications` or `memberships`.
- [ ] **Step 4: Walk through the spec §8 "S1 done when" scenario end to end on a Vercel preview** with the remote Supabase and Resend test domain. Record each step's pass/fail in the PR description.
- [ ] **Step 5: Commit** `docs: deploy + local dev for Hackum OS slice 1`, then use superpowers:finishing-a-development-branch.

---

## Self-review notes
- **Spec §8 S1 coverage:**
  - Items 1–9 map to Tasks 1–4, 5, 6, 10, 11–14, 15, 16, 8–9, and 8 (keepalive) + 15 (fallback).
  - The client-side resize in item 9 applies only to uploads, which arrive in S4; S1 has no uploads (posters stay in `/public`).
- **Deferred within S1 (YAGNI):**
  - Staff notes on members, the events calendar view and the Comms announcement composer.
  - The `announcement` template exists, but the composer UI is S3 alumni outreach.
  - Member public profiles are S3.
- **Name consistency checked:** `register_for_event`, `decide_registrations`, `send_decisions`, `requireStaffAction`, `requireStaffPage`, `userDb`/`publicDb`/`serviceDb`, `answersSchema`, `buildIcs`, `planBatch`, `dispatchOnce`.
