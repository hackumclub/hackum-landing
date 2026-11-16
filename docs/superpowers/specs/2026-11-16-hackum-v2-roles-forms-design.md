# Hackum v2: roles, forms, NUM-only membership, semesters, notifications (design)

Extends `2026-11-16-hackum-backoffice-design.md`. Still 100% local mock (`src/lib/mockdb`); every new table/rule keeps the Supabase shape so it ports later.

## 1. What the owner asked for (2026-11-16) and how it maps

| Ask | Decision |
|---|---|
| Forms in join + login | `/join` = one "Join Hackum" form (account + school + major + motivation + club questions). `/sign-in` = email code, passkey, create account. Persona picker moves into a dev-only "Demo accounts" disclosure and the avatar menu. |
| Login like the presentation / tall.so | Split screen: clean form card left, big rounded brand-blue "presentation" panel right (mascot, 3 value slides, reduced-motion safe). Tabs: Email code · Passkey. |
| Dashboard all white, needs theme | Visual audit first (light+dark, 1280); give every admin surface the Hackum treatment (canvas glow, tinted washes, stage). No flat white page. |
| Right-side dialog rounded | `Drawer` floats: `sm:inset-y-3 sm:right-3 rounded-[28px]` + shadow; bottom sheet with `rounded-t-[28px]` on phones. |
| Tabs, previews, filters, tables, selection, date | New shared `SegmentedTabs`, `DateRangePicker` (semester/30 days/custom), `FilterBar`, `DataTable` pagination + selection bar, row-click opens preview drawer. Adopted in every admin list. |
| Text/icon positions, member app bar | One icon map (`lucide-react` only), 20px icon + 8px gap rule, app bar rebuilt: logo · section title · bell · avatar menu. |
| Guest registration form; admin edits and sees all forms | Event registration form already lives on `events.questions`; add site forms (`membership_application`, `join`) in a `forms` table. `/admin/forms` lists all three kinds, edits questions, shows responses, exports CSV. |
| Mail + auth + passkey login | Mock email one-time code (6 digits, 10 min, 5 tries, single use) + mock passkey (profile holds `passkeys[]`); both replaced by Clerk later at the same URLs. |
| Member app responsive on laptop | `/me` ≥1024px: left rail + two-column content, not a stretched phone layout. |
| Club leader + sub-leader see Dashboard; header switch Dashboard ↔ Hackum; profile | `ContextSwitch` segmented control in both shells for roles admin (club leader) and organizer (sub-leader); avatar menu: Profile, Notifications, Settings, Switch demo account (dev), Sign out. Staff land on `/admin`. |
| More feature pages on header | Admin nav gains Forms, Analytics; both shells gain Notifications. |
| Analysis diagrams | Hand-rolled accessible SVG charts (line/area, bars, funnel, donut, heat) with table fallback; `/admin/analytics` with semester picker; dashboard uses the same parts. |
| Remove "live" stuff | Remove every *visible* "live"/realtime label, pulse dot and `LivePill`. The SSE refresh stays, silent. (Assumption: this is what "live shit" meant. Say so if you meant the demo persona switcher.) |
| Best icons, labels, badges | Three roles, three components: `StatusPill` (state), `Tag` (category: kind, school, scope), `CountBadge` (numbers). Achievements keep the name "badge" (BadgeMedal) only. |
| Notifications | In-app channel in the outbox table (`channel: "in_app"`, `read_at`), bell with unread count + panel, `/me/notifications` and `/admin/inbox`. |
| Profile image | Upload ≤ 5 MB source, resized client-side to 512px WebP (EXIF stripped by re-encode), server re-validates magic bytes, versioned immutable URL. |
| Two semesters a year | `Term = "autumn" | "spring"`; `semesterOf(date)`; analytics, reports and subjects group by semester. |
| Share the subjects I learn this semester (optional) | `profile_semesters` rows `{profile_id, year, term, subjects[], shared}`; shown on the profile only when `shared`. |
| NUM open data | Bundle a trimmed bachelor-level program list from data.num.edu.mn `programdata` (CC BY-SA 4.0 compatible: attribution shown in the picker footer) as static JSON via a script; never fetch NUM at request time. |
| Only NUM students can be members; other schools = guest | `school_id === "num"` and a major required to apply for membership; enforced in the rule (`ineligible`), not just the UI. |
| Majors: software, CS, other | `MajorTrack = software | cs | is | it | other`; NUM program picker fills `program_index`; "other" takes free text. |
| Event for МУИС only or all schools | `events.school_scope: "num" | "all"` (default `all`); `registerForEvent` returns `ineligible` for non-NUM on `num`; lists show a "МУИС" Tag. |

## 2. Assumptions made (flag if wrong)
1. "muis" = МУИС, the National University of Mongolia (NUM).
2. "Sub-leader" = existing `organizer` role; "club leader" = `admin`. No new role.
3. Semester windows: autumn Sep–Dec, spring Jan–Aug, academic year starts in September. One constant, easy to change.
4. Guests from other schools keep every guest right (open events, subscribe, calendar) and can apply nowhere for membership.
5. Passkey and email code are mocks that mimic Clerk's UX; no real WebAuthn ceremony until Clerk.

## 3. Route map (after this work)
Public: `/` `/events` `/events/[slug]` `/about` `/join` `/sign-in` · Member: `/me` `/me/events` `/me/events/[slug]/apply` `/me/teams/[id]` `/me/membership` `/me/profile` `/me/notifications` `/me/settings` `/me/onboarding` · Staff: `/admin` `/admin/events[/id]` `/admin/members` `/admin/forms[/id]` `/admin/analytics` `/admin/comms` `/admin/inbox` `/admin/settings` (admin only) `/admin/audit` (admin only).
Landing: staff → `/admin`; member/guest → `/me`; new account → `/me/onboarding`; signed-out hit on `/me|/admin` → `/sign-in?next=…`; organizer on admin-only page → 404.

## 4. Data model delta (mock, Supabase-shaped)
`profiles += school_id, major_track, program_index, passkeys[]` · `events += school_scope` · `profile_semesters` · `forms` (site forms only) · `form_responses` is *derived* (event registrations' answers, membership applications' answers, join submissions) not stored twice · `notifications.channel += "in_app"`, `read_at` · `auth_codes` (mock only, never ported) · `avatars` blob store (mock only; Storage later).
New `ErrorCode`: `ineligible`.

## 5. Non-goals
Real Clerk/Supabase/Resend wiring; real WebAuthn; importing NUM student records (only the public program list); feedback/check-in slice.
