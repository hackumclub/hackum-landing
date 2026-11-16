# Hackum database (Supabase Postgres 17)

Phase 1 of `docs/production-setup.md`: schema, row-level security and the rule functions that mirror the executable mock in `src/lib/mockdb/`. Local only so far: nothing here has been applied to the hosted project.

## Run it
```bash
supabase start                 # local stack (Docker); applies migrations
supabase db reset              # recreate + apply every migration (what CI should run)
supabase test db               # pgTAP: 11 files, 509 assertions (supabase/tests/*.test.sql)
supabase db lint --level warning --schema public,app
supabase gen types typescript --local --schema public --schema app > src/lib/db/types.ts
supabase/tests/concurrency.sh 20 5   # 20 parallel registrations into 5 seats, real sessions (not part of test db)
```
`supabase/tests/00_helpers.test.sql` installs the `tests` schema (fixtures, `tests.as_person('handle')`, `tests.as_anon()`, ...). It is dev-only and recreated by every reset; it is not a migration.

## Layout
| Migration | Content |
|---|---|
| `…100000_extensions_enums` | citext, schema `app`, closed default privileges, enums, domain `l_text` (`{mn,en}`) |
| `…100100` .. `…100500` | tables: profiles/staff/seasons/memberships, events/registrations/teams, applications/forms, outbox/inbox/subscribers/audit/timeline, polls/feedback |
| `…100600_helper_functions` | identity (`current_profile_id`, `is_staff`, `is_admin`, issuer pin), error helper, audit, outbox/inbox writers, question/answer validators |
| `…100700` .. `…101150` | rule functions (registrations, profile/members, events, engagement, merge, Clerk webhook helpers) |
| `…101200_rls_grants` | RLS on every table, restrictive issuer policy, views, table and function grants |
| `…101300_storage` | buckets + `storage.objects` policies |
| `…101400_cron` | pg_cron job (skipped when pg_cron/pg_net are unavailable) |

## Identity and roles
- Clerk third-party auth: the JWT `sub` is a Clerk user id (text). `profiles.clerk_user_id text unique`; `app.current_profile_id()` maps `auth.jwt() ->> 'sub'` to a non-deleted profile. Roles are read from `staff_roles` on every call (never from the token). Unclaimed legacy profiles have `clerk_user_id null` and are claimed by email in `app.upsert_clerk_profile` (service role, Clerk webhook).
- **Issuer pin.** Every table (and `storage.objects`) has a *restrictive* policy `issuer_pin` for `authenticated`, and `current_profile_id()` also requires it, so a token from another issuer is nobody. The issuer is read from `app.settings` (`key = 'clerk_issuer'`, wins) or the database GUC `app.clerk_issuer`. **Not configured = every signed-in token fails closed.** Set it once per environment:
  ```sql
  insert into app.settings (key, value) values ('clerk_issuer', 'https://<your-clerk-frontend-api>')
  on conflict (key) do update set value = excluded.value;
  ```
  pgTAP sets it per test (`tests.use_issuer()`); the value must equal the token's `iss` exactly (no trailing slash).
- `app.settings` has no grants and no policies: only the owner / SQL editor can read or write it.

## How the app talks to it
- Reads: PostgREST over RLS with the Clerk token (`supabase-js` `accessToken`). Writes to rule-governed tables: only through `app.*` RPCs: `supabase.schema("app").rpc("register_for_event", { p_event_id, p_answers, p_team })` (named arguments, `jsonb` for objects). `app` is in `[api] schemas`; **hosted: Dashboard → Project Settings → API → Exposed schemas must include `app`.**
- Failure convention: `raise exception using errcode = 'P0001', message = '<code>'` with `<code>` exactly one of `unauthenticated forbidden not_found invalid conflict full closed rate_limited ineligible server`. PostgREST returns `{ "code": "P0001", "message": "<code>" }`: map `message` to `ErrorCode`. `42501` (permission denied) means the role may not call it at all (anon calling a signed-in function).
- No service-role path for normal CRUD. The service role is for webhooks, cron and imports: it can call `app.upsert_clerk_profile`, `app.anonymize_clerk_user`, `app.enqueue_notification`, `app.enqueue_due_reminders`, `app.enqueue_feedback_requests`, `app.push_inbox`, `app.notify_staff` (nobody else can).

### What is readable by whom (RLS)
| Who | Reads |
|---|---|
| anon | published/completed/archived `events`, `seasons`, `forms`, `timeline_milestones`, `memberships` of public profiles, view `public_profiles` (id, handle, name, avatar_path, school, status) |
| signed in | own `profiles` row (all columns incl. email, calendar token), own `event_registrations`, `inbox`, `event_feedback`, `form_submissions`, `profile_semesters`; view `member_profiles` (public + members visibility, safe columns), view `my_membership_applications` (no staff note); teams they belong to (`app.team_roster(team_id)` for names); `event_online_links` only with a seat; cancelled events they registered for; polls of their audience (`app.poll_tallies` for results); shared semesters of visible profiles |
| staff | everything above for all people plus `notifications`, `email_*`, `subscribers`, `membership_applications` (with `review_note`), `staff_roles`, all `events` incl. drafts; `app.feedback_summary(event_id)` (aggregates; authors of anonymous answers stay hidden, raw `event_feedback` rows are not readable by staff); voters only on non-anonymous polls |
| admin | additionally `audit_log`, `grant_role`, `upsert_season`, `merge_profiles` |
Nobody updates `profiles` directly (no UPDATE grant at all): every write goes through the validating RPCs `update_profile`, `update_prefs`, `update_academic`, `complete_onboarding`, `set_avatar_path`. `notif_prefs` also has a table CHECK (exactly the booleans `reminders`, `updates`, `announcements`, no other keys) and every reader compares it as jsonb, never as text cast to boolean. No helper granted to API roles takes a profile id: `is_seated`/`has_registration` answer only about the caller, `visible_profile_ids()`, `staff_votable_poll_ids()` and `my_team_ids()` return fixed sets, `poll_eligible_me(audience)` looks only at the caller; the id-taking `poll_eligible_for(audience, uuid)` is internal. `subscribe` returns nothing (no who-is-subscribed oracle). Staff edit the timeline directly (trigger audits it); every other staff action is an RPC that writes `audit_log` itself.

## Mock rule → SQL function (schema `app`)
| Mock (`src/lib/mockdb/…`) | SQL |
|---|---|
| `registrations.registerForEvent` | `register_for_event(p_event_id, p_answers jsonb, p_team jsonb) → {status, team_id, invite_code}` (locks the event row; `p_team` = `{mode: create\|join\|solo, name?, code?}`) |
| `cancelRegistration` (+ waitlist promotion and mail) | `cancel_registration(p_event_id)` |
| `joinTeam`, `leaveTeam`, (new) | `join_team(p_code)`, `leave_team(p_team_id)`, `create_team(p_event_id, p_name)`, `team_roster(p_team_id)`, (see Invite codes: a miss returns `{ok:false,error:"not_found"}`) |
| `decideRegistrations`, `sendDecisions` | `decide_registrations(p_ids uuid[], p_decision, p_scope)`, `send_decisions(p_event_id)` |
| `members.completeOnboarding`, `updatePrefs` | `complete_onboarding(p_name, p_school, p_grad_year, p_locale)`, `update_prefs(p_notif_prefs, p_locale, p_visibility)` |
| `profile.updateProfile`, `academic.updateAcademic`, `setSemesterSubjects` | `update_profile`, `update_academic`, `set_semester_subjects` |
| `avatars`/`ext-avatar` (bytes now live in Storage) | `set_avatar_path(p_path)`, `remove_avatar()` |
| `applyForMembership`, `ext-membership.renewMembership`, `reviewMembership` | `apply_for_membership(p_motivation, p_team_interest, p_answers)`, `renew_membership`, `review_membership(p_id, p_approve, p_note)` (NUM + major rule → `ineligible`) |
| `setMemberStatus`, `mergeProfiles`, `grantRole`, `upsertSeason` | `set_member_status`, `merge_profiles`, `grant_role` (last-admin guard), `upsert_season(p_input jsonb)` |
| `events.createEvent`, `updateEvent`, `previewEventChange`, `setEventStatus` | `create_event(p_input jsonb)`, `update_event`, `preview_event_change`, `set_event_status` (`ics_sequence` bump, reminders skipped, mails) |
| `forms.updateForm`, `submitJoinForm`, `ext-subscribe.subscribe` | `update_form`, `submit_join_form`, `subscribe` (anon allowed, returns nothing) |
| `polls.createPoll`, `updatePoll`, `setPollStatus`, `vote`, `pollResults` | `create_poll`, `update_poll`, `set_poll_status`, `vote(p_poll_id, p_option_ids text[])`, `poll_tallies` |
| `feedback.submitFeedback`, `feedbackSummary`, `enqueueFeedbackRequests` | `submit_feedback`, `feedback_summary`, `enqueue_feedback_requests` (cron) |
| `notifications.markRead/markAllRead`, `outbox.retryNotification` | `mark_read(p_ids)`, `mark_all_read()`, `retry_notification` |
| `outbox.enqueueDueReminders` | `enqueue_due_reminders` (cron) |
| `announce.sendAnnouncement` | `send_announcement(p_key, p_audience jsonb, p_subject, p_body)` (5/hour/sender, dedupe by key, opt-outs) |
| `core.enqueue/pushInbox/notifyStaff/audit` | internal: `enqueue_notification`, `push_inbox`, `notify_staff`, `audit` |
| `auth.ts` (Clerk replaces it) | `upsert_clerk_profile(p_clerk_user_id, p_email, p_name, p_locale, p_email_verified)`, `anonymize_clerk_user` for the Clerk webhook (service role) |

Table renames: mock `registrations` is `event_registrations` (spec §4); `events.online_url` lives in `event_online_links` (events rows are public, the link is for seat holders and staff). Everything else keeps the mock's column names.

## Invite codes and guess throttling
- Format `HK-XXXX-XXXX-XXXX`: 12 characters (60 bits) from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1), generated with pgcrypto's `gen_random_bytes` (`app.gen_invite_code`). `app.normalize_invite_code` is applied at both lookup sites (`register_for_event` join branch and `join_team`): it strips non-alphanumerics and uppercases, so `hk abcd efgh jkmn` works. Codes are exactly this format; there is no legacy short-code branch in the database.
- Throttle, recorded inside the call so it cannot be skipped: when a code matches nothing, `register_for_event` (join branch) and `join_team` insert a row into the private `app.team_code_failures` and **return** `{"ok": false, "error": "not_found"}` instead of raising (a raised error would roll the row back). Nothing else has been written at that point (no registration, no team change). **The adapter must map a returned `{ok: false, error}` to the same `ErrorCode`** (successful results have no `ok` key). Ten misses in the last hour make the next attempt raise `P0001 rate_limited` (nothing to persist). Other join errors (`closed`, `full`, `forbidden`, `conflict`) still raise as before and are not counted. The log has RLS on, no policy and no privileges for API roles; `app.note_team_code_failure(uuid)` is internal and granted to nobody.

## Clerk identity: no takeover by email
`upsert_clerk_profile` takes `p_email_verified`: pass whether the *primary* address is verified in Clerk. Only a verified address is stored or used to claim an unclaimed legacy profile; an unverified one creates a separate profile with no email. A legacy profile that holds a `staff_roles` row is never auto-claimed: the Clerk user gets a fresh profile and an audit row `profile.claim_blocked` (diff: the legacy profile id) is written so an admin can fold them together with `merge_profiles`. A second Clerk id for an already claimed address raises `conflict`.

## Not ported (yet)
- **Dispatcher** (`outbox.dispatchOutbox`: skip reasons, daily budget 100/20 reserved, retry backoff, "staff failed email" inbox item): application code in `/api/cron/dispatch` using the service role. The tables (`notifications`, `email_daily_usage`, `email_suppressions`) and `app.notify_staff` are ready.
- **Read-side selectors / analytics / reports** (`queries.ts`, `analytics.ts`, `reports.ts`, `listPollsFor`, `inboxFor`): plain PostgREST queries over RLS for now; aggregate views/functions (KPIs, funnels, event reports) are not written.
- `ext-join.createAccount` (composed rule): Clerk sign-up replaces the email-code part; compose `upsert_clerk_profile` (webhook, with `p_email_verified`) + `update_academic` + `submit_join_form` + `apply_for_membership` + `subscribe` in the app.
- Import helpers (legacy events/members/timeline/subscribers): `scripts/import-legacy.ts` with the service role, idempotent upserts by slug/handle/email.
- Not in the mock either: check-in, push subscriptions, badges, documents (later slices).

## Manual steps that stay in the Dashboard
1. Authentication → Sign In / Providers → Third-Party Auth → add **Clerk** (Clerk domain). Then set `app.settings.clerk_issuer` to the same issuer (SQL above).
2. Project Settings → API → Exposed schemas: add `app`.
3. Vault (SQL editor): `select vault.create_secret('https://<site>', 'hackum_site_url'); select vault.create_secret('<CRON_SECRET>', 'hackum_cron_secret');` The 5-minute job `hackum-tick` queues reminders and feedback requests, then POSTs `/api/cron/dispatch` with header `x-cron-secret`. Without the secrets it only queues (and warns).
4. Database → Extensions: enable `pg_cron` and `pg_net` if the migration reports them unavailable; first admin: insert a `staff_roles` row (`role = 'admin'`) for the Clerk user's profile once.
5. Storage buckets are created by migration; nothing to click. SVG is not allowed anywhere.

## Notes and risks
- `public_profiles`, `member_profiles`, `my_membership_applications` are owner-privileged views on purpose (fixed safe columns, their own WHERE); the Supabase advisor flags "security definer view" for them. Accepted and documented here.
- `school_id` is self-declared and directly updatable (per brief); NUM eligibility therefore trusts the profile until staff review an application.
- `anonymize_clerk_user` also removes the person's staff roles; if the last admin deletes their account the club has no admin until one is inserted by SQL.
- FORCE ROW LEVEL SECURITY is not set: the owner `postgres` has BYPASSRLS on Supabase, so it would change nothing; the security-definer functions rely on that.
- `supabase db advisors` needs CLI v2.81.3+ (2.72.7 installed): run the Dashboard advisors after the first push.
