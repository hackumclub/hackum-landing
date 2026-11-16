# Hackum OS — Backoffice + Member App (design + phased plan)

> On approval: this file is copied to `docs/superpowers/specs/2026-11-16-hackum-backoffice-design.md` (committed), then `superpowers:writing-plans` produces the task-level plan for **Slice 1** in `docs/superpowers/plans/`.

## 1. Context — why

Hackum (university hackathon club, est. 2017) has a polished public site (Next 16.4 / React 19.3 / Tailwind 4 / GSAP, bilingual mn/en) but **everything is static files** (`src/data/events.json`, `members.ts`, `club.ts` TIMELINE, posters) and there is no backend, auth, or member relationship. The club needs one system that:

- lets organizers run events end-to-end (create → RSVP → reminders → check-in → feedback → photos → analytics),
- gives **students** (current, prospective, temporary/guest) a profile, badges and an app-like experience,
- keeps **alumni** connected (calendar, email, web push, directory),
- produces **quarterly / annual reports** from real data,
- holds the club's rules (журам), big-event history and timeline.

Stack decided by user: **Supabase** (Postgres/Storage), **Clerk** (passkeys), **Resend** (email). Deploy: Vercel (`docs/deploy.md`).

### Decisions made with the user
| Decision | Choice |
|---|---|
| First usable slice | **Foundation + Events** |
| Non-member RSVP | **Quick Clerk account** (passkey / email code / Google) + 3 profile fields → "guest" (temporary member) |
| Architecture | **A: one Next.js app** — public site + `/[lang]/me` member PWA + `/[lang]/admin` backoffice |
| Membership | **Apply → board approves**, per season (guest → pending → member) |
| Hackathon registration | **Application + teams** for hackathons (apply → accepted/rejected/waitlisted, custom questions, team formation); workshops/meetups stay simple RSVP |
| Domain | **Club's own domain** (user provides); Clerk production, passkeys and Resend bound to it |
| Budget | **Free tiers only** → keep-alive, graceful degradation, email send budget |

### Builder calls (settled without the user — check while reading)
- Outbox can target a profile **or** a bare email (subscribers without accounts); existing webhook-sheet subscribers are imported.
- Legacy `members.ts` people: one unclaimed profile per distinct (name.mn, name.en) across seasons; admin **Merge profiles** tool fixes mistakes; public About page renders exactly as today.
- Unknown event slug 404: the page awaits a `use cache`d slug lookup **outside** any Suspense boundary and calls `notFound()` there (avoids the soft-200 noted in `src/proxy.ts`); proxy keeps only locale logic.
- Passkeys enabled only on the production domain instance; dev uses email code.

### Goals / non-goals / anti-goals
- **Goals:** single source of truth in Postgres; every person = one profile across guest→member→alumni; organizer workflows ≤3 clicks for common tasks; bilingual everywhere; analytics from day one (registrations/attendance captured correctly from S1).
- **Non-goals (for now):** native iOS/Android app (PWA only); payments/ticketing; chat/forum; multi-club tenancy.
- **Anti-goals:** admin bypassing RLS via service-role for normal CRUD; storing raw GPS / IP history; logging PII; breaking the existing public site's look, static performance, or SEO; "three glass cards" generic-AI UI.

### Approaches considered
- **A (picked):** one app, route-split areas, Supabase RLS keyed to Clerk `sub`. Reuses tokens/i18n/stickers/motion; one deploy.
- B: monorepo with separate admin app — cleaner isolation, but restructures a working site and duplicates config.
- C: logic in Supabase Edge Functions/RPC — only worth it if a native app is imminent; splits logic into Deno, harder to test.

---

## 2. Current state (what we reuse)

- **Design tokens** `src/app/globals.css`: `brand #0085ca` (+dark/deep/tint), `leaf #00ab84`, `sun #e5bf03`, `ink #071b29`, surfaces `fur/paper/card/chip`, `--radius-card 20px`, shadows; classes `.glass*`, `.btn-*`, `.perforation`, `mark.kw`. Fonts: Montserrat (display) + Nunito Sans, latin+cyrillic. No dark mode.
- **Components** `src/components`: `EventTicket`, `Timeline`, `PosterWall`, `Sticker` (10 Мануул poses, `src/lib/manul.ts`), `Icon3D`, `Members` (season tabs + Flip), `Lightbox`, `PhotoStack`, `Header`, `Footer`, `SubscribeForm`, motion (`Split`, `RevealGroup`, `TiltCard`, …).
- **i18n** `src/i18n`: `L = Record<Locale,string>`, `t/href/fill`, typed `Dict` (missing EN key fails tsc). `src/proxy.ts` handles locale redirect + unknown-slug 404 (matcher skips `/api`).
- **Logging** `src/lib/log.ts`: `log(level, logger, message, requestId, fields)` → JSON with `@timestamp, level, message, service, env, request_id, logger` (matches org standard; constant messages, snake_case fields, no PII).
- **API pattern** `src/app/api/subscribe/route.ts`: same-origin check, JSON-only, body cap, honeypot, rate limit, constant log messages — reuse as the template for all route handlers.
- `next.config.ts`: `cacheComponents: true`; security headers block camera/mic/geolocation; `sw.js/route.ts` is a **kill-switch**, not a real SW.
- Next 16: middleware is now **`proxy.ts`** (Node runtime, optimistic checks only); auth guide = `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` (read before coding).
- Supabase project `ndjawhnjjlmrttxoniyl` (in `.mcp.json`) — **currently unreachable (likely paused)**; no tables yet.

---

## 3. Architecture

```
Browser ──Clerk session──► Next.js (Vercel, Node)
  public  /[lang]/...        RSC, 'use cache' + cacheTag('events'|'timeline'|'members')
  member  /[lang]/me/...     dynamic, <Suspense>, Clerk auth()
  admin   /[lang]/admin/...  dynamic, requireStaff() in every action
  api     /api/webhooks/clerk  /api/webhooks/resend  /api/cron/dispatch  /api/calendar/[token]
        │ supabase-js (accessToken = Clerk session token)  → RLS enforced
        │ service-role client (server-only) → ONLY webhooks, cron, import scripts
        ▼
Supabase Postgres (RLS on every table) + Storage (public-media, private-docs)
  pg_cron (every 5 min) → pg_net POST /api/cron/dispatch (x-cron-secret)
Resend (email, .ics attachments)   Web Push (VAPID, S2)
```

- **Auth:** `@clerk/nextjs`; passkeys + email code (+ Google optional) enabled in Clerk dashboard. Supabase **Third-Party Auth: Clerk** (native integration; Clerk session token carries `role: authenticated`). RLS identifies user by `auth.jwt()->>'sub'` (text, **not** `auth.uid()` — Clerk ids aren't UUIDs). Add a restrictive policy pinning `iss` to the Clerk issuer.
- **App roles live in Postgres**, not JWT claims (no staleness): `staff_roles` table + `security definer` helpers `app.current_profile_id()`, `app.is_staff()`, `app.is_admin()`.
- **Proxy:** compose `clerkMiddleware` with existing locale logic in `src/proxy.ts`; extend matcher to run Clerk on `/api/(?!webhooks|cron)` while keeping locale logic page-only. Optimistic redirect for `/admin` & `/me` when signed-out; real authz in DAL.
- **DAL** `src/lib/server/` (`import 'server-only'`): `getSession()`, `requireProfile()`, `requireStaff()`, `requireAdmin()`, `db()` (user-scoped client), `serviceDb()` (service role, only importable from `webhooks/`, `cron/`, `scripts/`). Mutations = **Server Actions** validated with **zod**, returning typed `Result<T, ErrorCode>`.
- **Caching:** public pages keep static/`use cache` with `cacheTag`; admin mutations call `revalidateTag`. Member/admin pages dynamic behind Suspense (per Next 16 cache-components auth guide).
- **Jobs:** one **outbox** table `notifications`; `pg_cron` enqueues due reminders in SQL and pings `/api/cron/dispatch`, which drains the outbox via Resend/web-push with idempotency keys. (Vercel Hobby cron is daily-only → pg_cron avoids plan dependency.)
- **Migrations:** `supabase/migrations/*.sql` via Supabase CLI; generated types → `src/lib/db/types.ts`; RLS tests with pgTAP (`supabase/tests/*.sql`).

---

## 4. Data model (Postgres, all tables RLS-enabled)

Enums: `member_status(guest, member, alumni)`, `staff_role(organizer, admin)`, `event_kind(hackathon, workshop, meetup, competition, knowledge_day, outing, other)`, `event_mode(offline, online, hybrid)`, `event_audience(open, members, alumni, invite)`, `event_status(draft, published, cancelled, completed, archived)`, `reg_status(applied, going, waitlisted, rejected, cancelled, attended, no_show)` (`going` = confirmed seat; for application events `accepted ⇒ going`), `reg_mode(rsvp, application)`, `team_mode(none, optional, required)`, `application_status(pending, approved, rejected, withdrawn)`, `checkin_method(qr, geo, network, manual)`, `notif_channel(email, push)`, `notif_status(queued, sending, sent, failed, skipped)`.

**Slice 1 tables**
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id uuid pk`, `clerk_user_id text unique null`, `email citext unique null`, `handle citext unique`, `name jsonb L`, `avatar_path`, `school`, `major`, `grad_year int`, `status member_status default 'guest'`, `visibility (public/members/private)`, `locale`, `links jsonb`, `notif_prefs jsonb`, `calendar_token text unique`, `onboarded_at`, `deleted_at` | `clerk_user_id null` = **unclaimed legacy profile** (imported members); claimed by email match on sign-up or admin link. |
| `memberships` | `profile_id`, `season int`, `team`, `role_title jsonb L`, `unique(profile_id, season)` | Season roster = history; replaces `members.ts`. |
| `staff_roles` | `profile_id`, `role staff_role`, `granted_by`, `granted_at` | admin-only writes. |
| `membership_applications` | `profile_id`, `season`, `motivation text`, `team_interest text[]`, `answers jsonb`, `status application_status`, `reviewed_by`, `reviewed_at`, `review_note` (staff-only), `unique(profile_id, season)` | Approve (via `app.review_membership()`) → insert `memberships` row + `profiles.status='member'` + `membership_approved` email. Feeds Dashboard "pending approvals". End of season: admin bulk "roll over" or mark alumni. |
| `events` | `id`, `slug unique`, `kind`, `title/tagline/description jsonb L`, `starts_at/ends_at timestamptz`, `tz default 'Asia/Ulaanbaatar'`, `mode`, `venue_name`, `venue_address`, `venue_lat/lng`, `geofence_m`, `online_url` (revealed to registrants only), `audience`, `capacity null`, `waitlist bool`, `reg_opens_at/closes_at`, `status`, `cover_path`, `poster_path`, `themes text[]`, `external_url`, `legacy_participants int null`, `checkin_secret bytea`, `ics_sequence int`, `created_by`, **`reg_mode`**, **`questions jsonb`** (ordered list `{id, type: short/long/select/multi/checkbox/url, label L, required, options?}`), **`team_mode`**, `team_size_min/max`, `decision_deadline` | `legacy_participants` keeps imported counts separate from real registrations in analytics. `audience=invite` → no public RSVP; staff add registrants. |
| `event_registrations` | `event_id`, `profile_id`, `status reg_status`, `source (web/admin/import)`, `answers jsonb` (validated against `events.questions` by zod built from the schema), `team_id null`, `decided_by`, `decided_at`, `created_at`, `cancelled_at`, `unique(event_id, profile_id)` | Writes only via security-definer fns: `app.register(event_id, answers)` (rsvp → `going`/`waitlisted` under `FOR UPDATE` lock on event row; application → `applied`), `app.decide_registrations(ids[], decision)` (staff, bulk accept/reject/waitlist, capacity-checked), `app.cancel_registration()` (frees seat → auto-promote waitlist). |
| `teams` | `event_id`, `name`, `invite_code unique`, `captain_profile_id`, `looking_for text[]`, `locked bool` | Created by a registrant; others join with invite code; size enforced by trigger vs `team_size_max`; "looking for team" list for solo applicants. Staff can accept/reject a whole team at once. |
| `notifications` (outbox) | `profile_id null`, `to_email citext null` (CHECK exactly one), `channel`, `template`, `payload jsonb`, `priority smallint` (0 transactional, 1 reminder, 2 announcement), `scheduled_at`, `status`, `attempts`, `last_error`, `dedupe_key unique` | dedupe e.g. `reminder24:{event}:{profile}:{starts_at}` → rescheduled events get a fresh reminder, no duplicates. |
| `email_daily_usage` | `day date pk`, `sent int` | Free-tier send budget (Resend 100/day, 3k/month); dispatcher stops lower priorities when near cap. |
| `email_suppressions` | `email`, `reason`, `at` | from Resend bounce/complaint webhook. |
| `subscribers` | `email unique`, `name`, `lang`, `source`, `created_at` | replaces webhook/JSONL in `/api/subscribe` (keep its hardening). |
| `timeline_milestones` | `year`, `title/note jsonb L`, `url`, `front_path`, `back_path`, `sort` | replaces `TIMELINE`/`TIMELINE_MEDIA`. |
| `audit_log` | `actor_profile_id`, `action`, `entity`, `entity_id`, `diff jsonb`, `at` | trigger on staff-writable tables. |

**Later slices:** `event_checkins` (S2: `registration_id`, `method`, `distance_m` int null, `network_match bool`, `at` — no raw coords/IP), `feedback_forms`/`feedback_responses` (S2: rating 1–5, NPS 0–10, `answers jsonb`, `anonymous bool`), `push_subscriptions` (S2), `checkin_networks` (S2: CIDR list), `badges`/`profile_badges` (S3), `media` (S4), `documents` (S4: журам/policies/minutes, `body jsonb L` markdown, visibility), `reports` (S5: period, frozen `snapshot jsonb`, `pdf_path`).

**RLS summary**
- anon: `select` published/completed/archived events, timeline, public profiles' public fields (via view `public_profiles`).
- authenticated: own profile r/w (except `status`, `clerk_user_id`); own registrations select; RSVP only through `app.register`.
- staff (`app.is_staff()`): all events/registrations/members r/w; admin-only: `staff_roles`, deletions, settings.
- Restrictive issuer policy on every table. Service role used only in webhooks/cron/import.

**Analytics views (S1 seeds, S5 expands):** `v_event_stats` (registered, attended, show_rate, waitlisted, new_vs_returning, by school/year), `v_member_engagement` (events attended, last_seen, streak), `v_kpis` (active members 90d, upcoming events, RSVPs 30d, show rate, MoM deltas).

---

## 5. Key flows

**Sign-up / onboarding:** Clerk sign-in → Clerk webhook (`user.created/updated/deleted`, svix-verified) upserts `profiles` (lazy upsert in `requireProfile()` as fallback) → if email matches an unclaimed legacy profile, link it → onboarding sheet (name mn/en, school, grad year) → status `guest`. `user.deleted` → anonymize profile, keep aggregates.

**RSVP ("I'm going", Facebook-event style):** public event page shows capacity bar + opt-in attendee avatars → signed-out click = Clerk modal then return → `app.register()` → `going` or `waitlisted` → enqueue `rsvp_confirmed` email with **.ics attachment** (`METHOD:REQUEST`, stable `UID=event-id@hackum`, `SEQUENCE=ics_sequence`) + "Add to Google Calendar" link. Cancel → frees seat → auto-promote waitlist → `waitlist_promoted` email.

**Hackathon application:** event page "Apply" → custom questions + team step (create team / join with code / solo, "looking for team") → `applied` + `application_received` email (no .ics yet). Staff review in Registrations tab (filter by answers, team view, bulk accept/reject/waitlist, capacity meter) → `application_accepted` (+ .ics, then same reminder pipeline as `going`) / `application_rejected` (kind, bilingual) — decisions emailed only when staff click **Send decisions** (staged, shows counts), never on each click.

**Membership application:** `/me` "Become a member" (open while a season's application window is set in Settings) → pending → reviewed in Members › Applications tab → approved/rejected email.

**Calendar sync:** per-user subscribable feed `GET /api/calendar/{calendar_token}.ics` (all their going events, `webcal://` link in profile) + public club feed `/api/calendar/club.ics`. Event edits bump `ics_sequence` and send `event_updated` email; cancel sends `METHOD:CANCEL`.

**Reminders:** pg_cron every 5 min: insert `reminder_24h` rows for `going` registrations whose event starts in (23h, 25h] (dedupe key includes `starts_at`), also `reminder_1h` (push only, S2) → ping dispatch. Dispatcher re-checks event status/registration before sending (skip if cancelled), respects `notif_prefs` and suppressions, retries with backoff (max 5), Resend idempotency key = `dedupe_key`.

**Check-in (S2) — "school wifi or map":** browsers cannot read wifi SSID, so per-event policy combines:
1. **QR (primary):** organizer opens *Projector mode* → rotating QR (HMAC(checkin_secret, 30 s window)) → student scans with native camera → `/me/checkin/[event]?t=…` → server verifies window (±1), registration, time window (starts−30 min … ends).
2. **Geofence:** browser geolocation, distance to venue ≤ `geofence_m` (store only distance).
3. **Network:** request IP ∈ `checkin_networks` CIDR (university egress) → "on campus wifi".
4. **Manual:** organizer searches attendee list.
Event setting: `qr` | `qr+geo` | `any`. `Permissions-Policy` relaxed to `geolocation=(self)` only (no camera needed). Walk-ins: sign-in + instant registration if capacity allows.

**Feedback (S2):** after `ends_at` (+1 h) enqueue `feedback_request` (email + push); per-event form = default template (rating, NPS, best/worst, free text) + optional custom questions; one response per profile; optional anonymous (stored with profile for dedupe, hidden from staff UI). Completing feedback can award badges.

**Badges (S3):** `badges.rule jsonb` → `{type:'attendance_count',gte:5}`, `{type:'feedback_count',gte:3}`, `{type:'kind_count',kind:'hackathon',gte:1}`, `{type:'first_event'}`, `{type:'seasons',gte:2}`, `{type:'organizer'}`, `{type:'manual'}`. `app.evaluate_badges(profile_id)` (idempotent, `on conflict do nothing`) fired by triggers on attendance/feedback/membership; backfill on import. Badge art = Мануул stickers + 3D icons; award → push + profile toast.

**Web push (S2):** replace kill-switch `sw.js` with a versioned real SW (keep the stale-worker cleanup for other origins' localhost scopes), `app/manifest.ts` (PWA), VAPID + `web-push`; iOS requires "Add to Home Screen" → install prompt in `/me`.

**Reports (S5):** `/admin/reports/[period]` (Q1–Q4, year) composes SQL aggregates (events, unique attendees, new members, retention, show rate, avg rating/NPS, top events, photo highlights) → **freeze** into `reports.snapshot` → print-styled page + "Download PDF" (print CSS first; server PDF later if needed).

---

## 6. Information architecture

### Backoffice `/[lang]/admin` (staff only) — left sidebar, top glass bar (search ⌘K, locale, avatar)
| Page | Tabs / contents |
|---|---|
| **Dashboard** | KPI row (tabular nums, signed deltas): active members 90d, upcoming events, RSVPs 30d, show rate, avg rating · upcoming events list · "Needs attention" (missing cover, failed emails, pending member approvals, events without feedback form) · recent feedback |
| **Events** | Table/Calendar toggle; status pills; RSVP/capacity bar; filters (kind, status, season); "New event" |
| **Event detail** | Overview (bilingual side-by-side form + live public preview) · Registrations (list, CSV export, manual add, waitlist promote, message attendees) · Check-in (S2: projector QR, live counter, manual) · Feedback (S2: builder + results) · Media (S4) · Analytics (funnel registered→attended→feedback; new vs returning; school/year) · Comms log |
| **Members** | Tabs: **Directory** · **Applications** (pending membership, approve/reject with note) · **Merge** (legacy duplicates). Directory table: status pill (guest/member/alumni), season, team, events attended, last seen; filters; bulk: promote to member, mark alumni, add to season, email segment; row → drawer |
| **Member detail** | Profile · Activity timeline · Badges (S3) · Staff notes · Roles (admin) |
| **Alumni** (S3) | Directory (opt-in "where now"), outreach segments |
| **Comms** | Announcement composer (segment × channel, preview mn/en, schedule) · Outbox log (status, retries) · Template previews |
| **Badges** (S3) | Catalog, rule editor, manual award |
| **Content** (S4) | Timeline milestones · Documents (журам, policies, minutes) · Media library · Code of conduct |
| **Reports** (S5) | Period picker → generate/freeze → print/PDF |
| **Settings** | Seasons · Staff roles · Check-in networks (S2) · Integrations status (Clerk / Resend / Push / Cron — render every state: connected, misconfigured, failing) |
| **Audit log** | Filterable actor/entity/action |

### Member app `/[lang]/me` (PWA, bottom nav ≤4)
- **Home:** next event as `EventTicket` (reuse) with countdown; "Check in now" CTA when live; pending feedback cards; new badges.
- **Events:** Upcoming · Going · Past (with "give feedback").
- **Profile:** badges grid, season history, attended events, links, visibility, calendar feed link, passkeys (Clerk `<UserProfile/>`).
- **Settings/Notifications:** email/push prefs per category, language, install-app prompt, delete account.

### Public site changes
- `/events`, `/events/[slug]` read from DB (`use cache` + `cacheTag('events')`); `[slug]` gains RSVP button, capacity, attendees, add-to-calendar; `proxy.ts` unknown-slug check moves to `notFound()` in the page (DB-backed).
- Home timeline + About members read from DB.
- `/join` → "Create account" CTA + existing subscribe (now → `subscribers` table).
- S3: public profiles `/[lang]/u/[handle]`; S4: `/[lang]/docs` (журам, policies), event photo galleries.

---

## 7. Design system extension (backoffice + app)

Keep brand tokens/fonts; add an **"ops" density layer** — the generic generator suggested dark/Fira; rejected as off-brand. Adopted from reference sites (hallmark, hue, jakub.kr, tasteskill, supaframe, uizze):
- **Tokens added:** `danger #d93a3a`, `warn` (= `sun` darkened for text contrast), `line` (hairline borders), dense spacing scale 4/8/12/16/24/32, `--radius-sm 10px` / `--radius-md 14px` (concentric radii inside 20px cards), `font-variant-numeric: tabular-nums` utility.
- **One status vocabulary** (pills) shared by admin & member UI: draft·muted, published·brand, live·leaf, waitlisted·sun, completed·ink, cancelled·danger; member: guest·chip, member·brand, alumni·ink.
- **Glass = one surface per screen** (top bar / projector), cards are flat `paper` with hairline + `shadow-soft`.
- **Colour only for data/state**; KPI cards: label above, big tabular number, signed delta.
- **Empty states:** Мануул sticker + title + one line + one verb CTA.
- **Destructive dialogs** name object + count + verb ("Cancel 'DevHack 2026' and email 84 attendees").
- **Staged edits** for risky changes (event time/venue change shows diff + "will email N people") before commit.
- Icons: **lucide-react** (SVG) for UI; 3D icons/stickers only for empty states, badges, celebrations.
- Motion: GSAP only for member-app delight (badge award, check-in success); admin = 150–200 ms CSS transitions, no overshoot on tables; `prefers-reduced-motion` honored.
- A11y: 4.5:1 contrast, visible focus, 44 px touch targets in `/me`, labels on every field, errors inline. Responsive checks at 390 / 768 / 1440.
- **Primitives** (`src/components/ui/`, Radix primitives for Dialog/Popover/Dropdown/Tabs, styled with tokens): Button, IconButton, Input, Textarea, Select, Combobox, DateTimeField (native, UB tz), **BilingualField** (mn|en side-by-side, "copy from mn"), DataTable (sort, sticky header, selection, pagination), FilterBar (chips), StatusPill, KpiCard, Tabs, Drawer, ConfirmDialog, Toast, EmptyState, Skeleton, Avatar/AvatarStack, CapacityBar, BadgeMedal, Sparkline/BarChart (hand-rolled SVG per `dataviz` skill), FileDrop (signed upload to Storage), CalendarMonth, QRProjector (S2).

---

## 8. Phased delivery

### Slice 1 — Foundation + Events (build first)
1. **Supabase**: unpause project; init `supabase/` (CLI), migrations for S1 tables, enums, helpers, `app.register/cancel_registration`, views, RLS + issuer policy, audit triggers; pgTAP RLS tests; generate types.
2. **Clerk**: install `@clerk/nextjs`; compose with `src/proxy.ts`; Supabase third-party auth; DAL (`src/lib/server/*`); webhook `/api/webhooks/clerk` (svix); onboarding sheet.
3. **Legacy import** `scripts/import-legacy.ts` (service role, idempotent upsert by slug/handle): `events.json` → events (`status archived`, `legacy_participants`), `members.ts` → unclaimed profiles + memberships, `club.ts` TIMELINE → milestones, posters → Storage. Static files stay as fallback until parity verified, then removed.
4. **Design primitives** listed in §7 needed by S1 + admin shell layout (sidebar, top bar, breadcrumbs) + `/me` shell (bottom nav).
5. **Admin**: Dashboard (KPI row + upcoming + needs-attention), Events list/create/edit (bilingual, staged edit for time/venue, **question builder**, reg mode, team settings), Event detail tabs Overview/Registrations (**application review + team view + Send decisions**)/Analytics(basic)/Comms, Members (Directory + drawer, **Applications**, **Merge**), Settings (seasons + application window, staff roles), Comms outbox log with **email budget meter**, Audit log.
6. **Public**: events + timeline + members from DB with cache tags; RSVP/Apply button + capacity + add-to-calendar on event page; `/api/subscribe` → `subscribers` (import existing sheet).
7. **Member app**: Home, Events (upcoming/going/applied/past), **Apply flow + Team page** (invite code, members, leave), **Become a member**, Profile (basic), Settings (email prefs, calendar feed, language).
8. **Email**: Resend + React Email bilingual templates `welcome`, `rsvp_confirmed` (+ics), `waitlist_promoted`, `application_received`, `application_accepted` (+ics), `application_rejected`, `membership_approved/rejected`, `event_updated` (+ics SEQUENCE), `event_cancelled` (METHOD:CANCEL), `reminder_24h`; `/api/cron/dispatch` + pg_cron/pg_net with priority + daily budget; `/api/webhooks/resend` → suppressions; calendar feeds.
9. **Free-tier resilience**: Vercel daily cron → `/api/cron/keepalive` (trivial query; Supabase free pauses after 7 days idle and pg_cron does not run while paused); public pages keep last-good cached render when DB is unreachable (`use cache` + build-time prerender, error boundary falls back to static snapshot); Storage uploads resized client-side (≤1600 px WebP) to stay under 1 GB.

**S1 done when:** an organizer creates a hackathon with custom questions + teams of 2–4, two students apply as a team, staff accept the team and **Send decisions**, both get accepted emails with .ics; a guest applies for membership and is approved; and an organizer creates a bilingual meetup, a non-member signs up with a passkey and RSVPs, receives a confirmation with a working .ics (Google + Apple Calendar), receives the 24 h reminder, an event time change re-sends an updated invite, and the dashboard shows the RSVP. Legacy events/members/timeline render on the public site from the DB, visually identical.

### Slice 2 — Check-in, feedback, web push, PWA
Check-in (QR/geo/network/manual + projector), feedback forms & results, `event_checkins`/`feedback_*`/`push_subscriptions`/`checkin_networks`, real SW + manifest + install prompt, `reminder_1h` & feedback push, attended/no_show finalization job, Permissions-Policy update.

### Slice 3 — Profiles, badges, alumni
Public profiles + visibility, badge catalog + rule engine + backfill, award notifications, alumni directory (opt-in "where now"), alumni segment outreach, claim-legacy-profile flow via invite link.

### Slice 4 — Content & media
Documents (журам, policies, discussions/minutes, big-event writeups) public `/docs`, media library + per-event galleries (Storage, signed uploads, `next/image`), timeline editor, posters, code-of-conduct editor.

### Slice 5 — Analytics & reports
Event funnel, cohort retention (by season/first event), engagement leaderboard (opt-in), school/major distribution, feedback trends; quarterly/annual report generator with frozen snapshots + PDF.

---

## 9. Security, privacy, ops
- Authz in **every** Server Action / route (`requireStaff()`), RLS as second wall; service-role key in `server-only` modules only; never `NEXT_PUBLIC_`.
- Webhooks: svix signature (Clerk), Resend signature; cron: `x-cron-secret` constant-time compare.
- Rate limits on RSVP, check-in, subscribe (Postgres-backed counter, not in-memory, for serverless correctness).
- Input validation with zod on all actions; markdown rendered sanitized; Storage uploads: MIME/size allow-list, signed URLs.
- PII: no phone/student-ID in S1; no raw GPS/IP stored; emails never logged (`log()` fields = ids/outcomes only); account deletion anonymizes.
- Logging: reuse `src/lib/log.ts`, constant `message`, snake_case fields, `request_id` per request, ERROR logged once at the boundary.
- Env (documented in `docs/deploy.md`): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `CRON_SECRET`, (S2) `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`.

## 10. Edge cases handled
Capacity race (row lock in `app.register` and `app.decide_registrations`); team over-size / team member rejected individually (team decision applies to all; individual override allowed with warning); applicant withdraws after acceptance → seat freed, waitlist promoted; membership re-application next season; Resend daily cap hit mid-blast (remaining announcements roll to next day, transactional always reserved ~20/day); waitlist auto-promote; event rescheduled after reminder sent (dedupe key includes `starts_at`); cancelled event mid-outbox (dispatcher re-checks); timezone fixed `Asia/Ulaanbaatar` (UTC+8, no DST) shown explicitly; duplicate people (legacy unclaimed profile ↔ new sign-up, merge by email or admin link); user deletes Clerk account; bounced email → suppression; online-event link only to registrants; bilingual fields with one language missing (fallback to mn, flag in admin "needs EN"); imported legacy counts not mixed with real attendance.

## 11. Left to the builder
Exact Radix vs Base UI choice per primitive; table virtualization threshold; React Email layout; chart implementation details; CSV column sets; copy (via `design:ux-copy`); file layout within `src/components/ui`.

## 12. Open items needing the user (not blocking the plan)
1. **Unpause Supabase** project `ndjawhnjjlmrttxoniyl` (DB currently unreachable).
2. **Allow reading `src/data/`** (currently permission-denied) for the import script.
3. **Production domain name** (user will provide) → Resend sending domain + DNS (SPF/DKIM), Clerk production DNS (CNAMEs), `SITE_URL`.
4. **Clerk instance** + enable passkeys (production instance); connect Supabase third-party auth.
4b. Export of current subscriber sheet (from `SUBSCRIBE_WEBHOOK_URL` target) for import.
5. (S2) University **public egress IP range** for "on campus wifi" check.
6. (S3) Badge catalog wording/art.

---

## 13. Verification
- `npx tsc --noEmit && npm run lint && npm run build` — clean.
- `supabase db reset && supabase test db` — migrations apply, pgTAP RLS tests pass (anon cannot read drafts/registrations; guest cannot read others' registrations or change own `status`; organizer cannot grant roles; capacity race test with concurrent `app.register`).
- pgTAP also covers: applicant cannot read others' answers; non-captain cannot lock team; team size trigger; `decide_registrations` respects capacity; membership approve sets status + roster atomically.
- `npx vitest run` — unit: question-schema → zod builder, dispatcher priority/budget logic, ics builder (UID/SEQUENCE/CANCEL, UB tz), dedupe keys, zod schemas, badge rule evaluator (S3), QR token window (S2).
- `npx playwright test` — e2e: sign-up (Clerk testing token) → onboarding → RSVP → confirmation in Resend test mode; admin creates/edits event → updated invite enqueued; signed-out `/admin` redirects; guest hitting `/admin` gets 404/forbidden.
- Manual: import .ics into Google & Apple Calendar; trigger `/api/cron/dispatch` with secret and observe outbox → `sent`; compare public pages before/after DB switch (screenshots at 390/768/1440); Supabase advisors (`get_advisors` security + performance) show no RLS gaps.
