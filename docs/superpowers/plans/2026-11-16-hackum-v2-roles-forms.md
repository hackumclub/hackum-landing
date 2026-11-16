# Hackum v2: roles, forms, NUM-only membership, semesters, notifications. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the polished mock app into a role-aware system: real sign-in/join forms, NUM-only membership with majors, two-semester calendar, editable forms, in-app notifications, profile photos, analytics diagrams, and a consistent themed UI.

**Architecture:** Domain rules first (mockdb, TDD, Supabase-shaped), then shared UI parts, then screens built on them. Each task ends green (unit + its e2e) so agents can take tasks 6–12 in parallel after tasks 1–5.

**Tech Stack:** Next.js 16.4 (cacheComponents, `proxy.ts`, server actions via `act()`), React 19.3, Tailwind 4 (`.ops` tokens), lucide-react, zod, Vitest 5, Playwright + axe. Read `node_modules/next/dist/docs/` before touching routing/caching APIs (AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-11-16-hackum-v2-roles-forms-design.md` (decisions, assumptions, route map, data delta). Visual rules: `docs/design/polish-rubric.md`.

## Global Constraints
- Mock only: no network call to Clerk/Supabase/Resend; NUM data is a **static bundled JSON**, never fetched at request time.
- Demo/auth surfaces gated by `mockEnabled()`; production without `ADMIN_PREVIEW=1` must 404 them (existing e2e `first-request-404`, `demo-reset`).
- Bilingual: every string in `src/i18n/areas/*` with mn + en; missing EN fails tsc. Numbers/dates via UB timezone helpers in `src/lib/time.ts`.
- Tokens only (`bg-panel`, `text-fg`…), AA contrast (`tests/unit/tokens.test.ts` stays green), light + dark, 360–1536 px, no horizontal page scroll, tap targets /me ≥44 px, admin ≥40 px.
- Icons: `lucide-react` only, through `src/components/ui/icons.ts` (Task 4). No emoji icons.
- Logging (org standard): structured JSON via `src/lib/log.ts`, constant `message`, snake_case fields, never log email/code/token/PII.
- Security: authz in every server action (`requireSession`/`requireStaffAction`), validate with zod, error codes via `Result<T, ErrorCode>`.
- Media: images re-encoded client-side, magic-byte validated server-side, no SVG uploads, `URL.revokeObjectURL` on replace/unmount.
- Gate per task: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, task's e2e. Full serial `npx playwright test` at Task 13.

## Review Focus
1. Non-NUM user calls the membership or NUM-only-event server action directly (UI hidden is not enough) → `ineligible`, nothing written. *(Task 2)*
2. Email code brute force / replay / expiry / resend flood → locked after 5 wrong tries, single use, 5 sends per hour per email, constant-time compare. *(Task 5)*
3. Avatar upload: SVG or HTML renamed `.png`, >5 MB, EXIF GPS, 20 000×20 000 px bomb, private-visibility profile fetched by anon → all rejected / not served. *(Task 8)*
4. CSV export with cells starting `=`, `+`, `-`, `@`, commas, newlines, Mongolian Ө/Ү → safe and round-trips. *(Task 9)*
5. Semester edges: event at 2026-12-31 23:30 UB vs UTC, Jan 1, Aug 31, Sep 1; subjects list dupes/empty/over-length; organizer opening `/admin/settings` or `/admin/audit` by URL → 404. *(Tasks 2, 8, 7)*
6. Removing a question from a form that already has responses must not lose or hide historical answers. *(Task 9)*

---

## File Structure
- Domain: `src/lib/mockdb/{types,seed,members,registrations,events,outbox,forms,auth,avatars,notifications,analytics,queries}.ts`, `src/lib/semester.ts`, `src/lib/num/{programs.ts,schools.ts}`, `src/data/num-programs.json`, `scripts/build-num-programs.py`.
- UI parts: `src/components/ui/{Drawer,Tag,CountBadge,SegmentedTabs,DateRangePicker,FilterBar,DataTable,icons}.ts(x)`, `src/components/charts/*`, `src/components/notifications/*`, `src/components/profile/*`, `src/components/auth/*`.
- Screens: sign-in, join, `/me/*`, `/admin/{forms,analytics,inbox}`, shells, dashboard.

---

### Task 1: Baseline commit
**Files:** none (git only).
- [ ] **Step 1:** Confirm the gate is green on the working tree: 620 unit, 198 e2e, tsc, eslint (done 2026-11-16).
- [ ] **Step 2:** With the owner's OK, commit everything since `4058897` as `feat(ui): polish pass across member app, backoffice and public hero` (attribution trailer per session reminder). New work below starts from a clean tree on branch `feat/hackum-os`.

### Task 2: Domain, school / major / eligibility, semesters
**Files:**
- Create: `src/lib/semester.ts`, `src/lib/num/schools.ts`, `tests/unit/semester.test.ts`, `tests/unit/mockdb-eligibility.test.ts`
- Modify: `src/lib/mockdb/{types,seed,members,registrations,events}.ts`, `src/lib/result.ts` (add `"ineligible"` to `ErrorCode`), and the per-area i18n error maps that already list `rate_limited` (`src/i18n/areas/{public,me,admin-members}.ts`).

**Interfaces:**
- Produces: `type Term = "autumn" | "spring"`; `semesterOf(at: Date): { year: number; term: Term }` (academic year starts Sept: Sep–Dec → autumn of that year, Jan–Aug → spring of previous year; computed on the UB wall clock); `semesterLabel(s, lang): string`.
- Produces: `type SchoolId = "num" | "must" | "ufe" | "mnums" | "other"`; `SCHOOLS: { id: SchoolId; name: L }[]`; `type MajorTrack = "software" | "cs" | "is" | "it" | "other"`.
- Produces: `Profile += school_id: SchoolId | null; major_track: MajorTrack | null; program_index: string | null; passkeys: { id: string; label: string; created_at: string }[]`; `EventRow += school_scope: "num" | "all"`; `ProfileSemester { profile_id; year: number; term: Term; subjects: string[]; shared: boolean }`, `Db.profile_semesters`.
- Produces rules: `applyForMembership` returns `err("ineligible")` unless profile `school_id === "num"` and `major_track` set; `registerForEvent` returns `err("ineligible")` when `event.school_scope === "num"` and profile `school_id !== "num"`; `setSemesterSubjects(ctx, { year, term, subjects, shared }): Result<ProfileSemester>` (trim, drop empty, case-insensitive dedupe, ≤12 items, each ≤80 chars, actor only edits own row).

- [ ] **Step 1: Failing tests.** `semester.test.ts`: `semesterOf(new Date("2026-12-31T16:30:00Z"))` (= 2027-01-01 00:30 UB) → `{year: 2026, term: "spring"}`; `2026-08-31T15:59:00Z` → spring 2025; `2026-08-31T16:00:00Z` (Sep 1 UB) → autumn 2026. `mockdb-eligibility.test.ts`: other-school guest `applyForMembership` → `ineligible` and no application row; same guest `registerForEvent` on a `school_scope: "num"` event → `ineligible`, on `all` → ok; NUM member ok on both; `setSemesterSubjects` normalises `[" Algorithms ", "algorithms", ""]` → `["Algorithms"]`, rejects 13 items and an 81-char item with `invalid`, and cannot target another profile.
- [ ] **Step 2:** Run `npx vitest run tests/unit/semester.test.ts tests/unit/mockdb-eligibility.test.ts`; expect FAIL (modules missing).
- [ ] **Step 3:** Implement the interfaces above. Seed: anuujin/saraa/dev personas `school_id: "num"` with tracks (software, cs, it, software); temuulen `school_id: "must"`, track `other`; new-guest null. Mark two seeded events `school_scope: "num"` (one members-only meetup, one workshop). Add `school_scope` to `eventInputSchema` + `updateEvent`/`previewEventChange` diff (changing scope after registrations lists "N non-NUM registrants" in the preview).
- [ ] **Step 4:** Run the two files + `npx vitest run` (existing seed-count assertions may need the new fields); expect PASS.
- [ ] **Step 5:** Commit `feat(domain): NUM eligibility, majors, school scope, semesters`.

### Task 3: NUM program data and school/major pickers
**Files:**
- Create: `scripts/build-num-programs.py`, `src/data/num-programs.json`, `src/lib/num/programs.ts`, `src/components/profile/SchoolMajorFields.tsx`, `tests/unit/num-programs.test.ts`, `tests/unit/school-major-fields.test.tsx`

**Interfaces:**
- Produces: `type NumProgram = { index: string; name: L; level: "bachelor" | "master" | "doctor"; unit: string; track: MajorTrack }`; `searchPrograms(q: string, lang: Locale, opts?: { level?: NumProgram["level"]; limit?: number }): NumProgram[]` (diacritic/case-insensitive, matches mn+en+index, default limit 8); `trackOf(program): MajorTrack` (Программ хангамж/Software engineering → software, Компьютерын ухаан → cs, Мэдээллийн систем → is, Мэдээллийн технологи → it, else other).
- Produces: `<SchoolMajorFields value onChange lang errors? />` controlled component emitting `{ school_id, school_name, major_track, program_index, major_label }`; choosing school ≠ NUM hides the program search and shows a free-text field plus the note "Members must study at NUM; you can still join as a guest."

- [ ] **Step 1:** `build-num-programs.py` (run with `python3 -I`): downloads the latest `programdata` CSV from `data.num.edu.mn` (CC BY-SA), keeps bachelor/master/doctor rows, de-dupes on index+name, writes `src/data/num-programs.json` (≈ 600 rows, < 120 KB) with `{ source, license, fetched_at, programs[] }`. Output file is committed; script is not run at build.
- [ ] **Step 2: Failing tests.** `searchPrograms("программ", "mn")` includes index `D 061302` first for bachelor; `searchPrograms("software", "en", {level:"bachelor"})` returns only bachelor rows; `trackOf` mapping table above; component test: choosing "Other school" removes the program combobox and shows the guest note; choosing NUM + typing "comp" lists "Computer science" and selecting emits `major_track: "cs"`.
- [ ] **Step 3:** Run; expect FAIL. Implement `programs.ts` (lazy `import()` of the JSON inside the client combobox so it stays out of the initial bundle) and the component using the existing `Field` and a keyboard-accessible combobox (arrow keys, `aria-activedescendant`). Footer line in the listbox: "Source: МУИС Нээлттэй Өгөгдөл, CC BY-SA".
- [ ] **Step 4:** Run the two tests; expect PASS. Commit `feat(num): bundled program list and school/major fields`.

### Task 4: UI foundations (drawer, tags, icons, segmented tabs, date range, filter bar, table) and "live" removal
**Files:**
- Create: `src/components/ui/{icons.ts,Tag.tsx,CountBadge.tsx,SegmentedTabs.tsx,DateRangePicker.tsx,FilterBar.tsx}`, matching `tests/unit/*.test.tsx`
- Modify: `src/components/ui/{Drawer,DataTable,StatusPill}.tsx`, remove `src/components/public/LivePill.tsx` and its call sites, strip visible "live"/realtime copy from `src/i18n/**` and `LiveRefresh` (keep the silent SSE refresh), `src/app/globals.css` (drawer shadow token).

**Interfaces:**
- Produces: `icons` map `{ event, member, form, analytics, inbox, settings, audit, comms, school, major, semester, passkey, email, upload, filter, date, … }: LucideIcon` and `eventKindIcon(kind)`, `statusIcon(status)`.
- Produces: `<Tag tone? icon?>` (category/label, `rounded-full`, never colour-only), `<CountBadge n max?=99>` (renders `99+`, `aria-label` with the full count).
- Produces: `<SegmentedTabs items={{key,label,count?}[]} value onChange | hrefs ariaLabel />` (one component for both routed and in-page tabs; roving tabindex; mobile horizontal scroll with fade).
- Produces: `<DateRangePicker value={{from,to}|null} onChange presets={("thisSemester"|"lastSemester"|"last30"|"thisYear")[]} lang />` (UB dates, semester presets via `semesterOf`, native date inputs for custom).
- Produces: `<FilterBar search? chips? dateRange? onClear activeCount />` (wraps `FilterDisclosure` on phones, inline ≥ md; "Clear filters" always visible when `activeCount > 0`).
- DataTable gains `pageSize?: number` (client pagination with page buttons + "Showing a–b of n"), `selectionBar?: (ids: string[]) => ReactNode` (sticky bottom bar above the tab bar on phones).

- [ ] **Step 1: Failing tests.** Drawer: content has `rounded-[28px]` and `sm:right-3` classes and still traps focus/returns focus (existing behaviour). `CountBadge n={120}` text `99+`, accessible name `120`. `SegmentedTabs`: arrow keys move selection, `aria-selected` correct, routed variant renders links with `aria-current`. `DateRangePicker`: choosing "This semester" on 2026-11-16 emits `from=2026-09-01 to=2026-12-31`. `DataTable`: 25 rows with `pageSize=10` shows rows 1–10 and "Showing 1–10 of 25"; selecting rows shows `selectionBar` output; selection survives page change. e2e `no-live-ui.spec.ts`: no element on `/en`, `/en/me`, `/en/admin` has text matching `/\blive\b/i` or `animate-pulse` dots (allow the words in event copy via an explicit allowlist test id).
- [ ] **Step 2:** Run unit files; expect FAIL.
- [ ] **Step 3:** Implement per Interfaces. Drawer: desktop floating panel (`sm:inset-y-3 sm:right-3 sm:rounded-[28px] sm:border sm:shadow-[var(--shadow-float)]`), phones bottom sheet (`inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[28px]`) with grab handle. `StatusPill` keeps state only; migrate category chips (event kind, school, scope) to `Tag` via search of `StatusPill`/ad-hoc chip usages (list them in the commit message).
- [ ] **Step 4:** Run unit + `npx playwright test tests/e2e/a11y.spec.ts tests/e2e/no-live-ui.spec.ts`; expect PASS. Commit `feat(ui): rounded drawer, Tag/CountBadge, SegmentedTabs, DateRange, FilterBar, paginated table; remove live UI`.

### Task 5: Auth and Join forms
> **Status:** rules done (`src/lib/mockdb/auth.ts`: `requestEmailCode` → `{code}`, `verifyEmailCode(ctx, email, code, create?: NewAccount)`, `addPasskey`, `signInWithPasskey`; limits tested). Remaining: actions, pages and components. `createAccountAction` must chain: `verifyEmailCode` (with `create`) → `updateAcademic` → `submitJoinForm` → `applyForMembership` only when eligible (NUM + major) else subscriber, as the actor of the new profile. (tall.so-style split screen)
**Files:**
- Create: `src/lib/mockdb/auth.ts`, `src/components/auth/{AuthShell,EmailCodeForm,PasskeyButton,CreateAccountForm,DemoAccounts}.tsx`, `src/components/auth/slides.ts`, `tests/unit/mockdb-auth.test.ts`, `tests/e2e/auth-join.spec.ts`
- Modify: `src/app/[lang]/(site)/sign-in/page.tsx`, `src/app/[lang]/(site)/join/page.tsx`, `src/lib/server/auth-actions.ts`, `src/i18n/areas/public.ts`.

**Interfaces:**
- Produces (rules, `Ctx`-style, `Result`): `requestEmailCode(ctx, email): Result<{ devCode?: string }>`; `verifyEmailCode(ctx, email, code): Result<{ profile_id: string; created: boolean }>`; `addPasskey(ctx, label): Result<Passkey>` (actor only); `signInWithPasskey(ctx, email): Result<{ profile_id: string }>` (`not_found` when the profile has no passkey).
- Limits: 6-digit code, 10 min TTL, max 5 wrong attempts per code then `rate_limited`, max 5 sends/hour/email, single use, constant-time compare; `devCode` returned only when `mockEnabled()`.
- Produces (actions in `auth-actions.ts`, all through `act()`): `requestCodeAction`, `verifyCodeAction`, `passkeyAction`, `createAccountAction` (name mn/en, email, `SchoolMajorFields` value, optional motivation + site `join` form answers; NUM+major → also files a membership application; other school → guest + subscriber), each redirecting to `next` or role home.
- Presentation panel: `slides.ts` exports 3 `{ title: L; body: L; sticker: StickerName }` entries; auto-advance 6 s, paused on hover/focus, static under `prefers-reduced-motion`.

- [ ] **Step 1: Failing tests** (`mockdb-auth.test.ts`): correct code signs in; reused code → `invalid`; 6th attempt → `rate_limited` even with the right code; 6th send within an hour → `rate_limited`; expired code (clock +11 min) → `invalid`; `signInWithPasskey` for an email without passkey → `not_found`; unknown email on verify creates nothing unless created through `createAccountAction`. e2e: `/en/sign-in` shows Email code and Passkey tabs and a collapsed "Demo accounts"; entering `anuujin`'s email then the shown dev code lands on `/en/me`; `dev-admin` lands on `/en/admin`; `/en/join` as a MUST student creates a guest and shows the "guest" explanation, as a NUM software student files an application visible in `/admin/members` Applications; wrong code shows an inline error next to the field with `aria-describedby`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. Layout: left column max-w 440 px form card (logo, h1, tabs, fields with visible labels, primary gloss button, secondary link to the other page); right ≥ lg rounded-[40px] blue stage panel with slides + stickers; below lg the panel collapses to a short banner above the form. Visual check against tall.so at 390/768/1280 in screenshots before finishing. Demo accounts = the existing persona cards inside a `<details>`, dev-only.
- [ ] **Step 4:** Run `npx vitest run tests/unit/mockdb-auth.test.ts` and `npx playwright test tests/e2e/auth-join.spec.ts tests/e2e/sign-in-landing.spec.ts`; expect PASS. Commit `feat(auth): email-code and passkey sign-in, create-account and join forms`.

### Task 6: In-app notifications
> **Status:** domain done (`src/lib/mockdb/notifications.ts`, `pushInbox`/`notifyStaff` in `core.ts`, table `inbox`, tests in `mockdb-notifications.test.ts`). Remaining: server actions, bell, panel, pages. The text below says `channel: "in_app"` on the outbox; the build uses the separate `inbox` table (`InboxItem`), whose API is `inboxFor(db, profileId, {limit?, before?})`, `unreadCount`, `markRead(ctx, ids)`, `markAllRead(ctx)`.
**Files:**
- Create: `src/lib/mockdb/notifications.ts`, `src/components/notifications/{NotificationBell,NotificationPanel,NotificationList}.tsx`, `src/app/[lang]/me/notifications/page.tsx`, `src/app/[lang]/admin/inbox/page.tsx`, `tests/unit/mockdb-notifications.test.ts`, `tests/e2e/notifications.spec.ts`
- Modify: `src/lib/mockdb/{types,registrations,members,events,outbox}.ts`, `src/lib/server/*` actions, i18n.

**Interfaces:**
- Produces: `Notification.channel: "email" | "push" | "in_app"`, `read_at: string | null`; `inboxFor(db, profileId, { limit?: number; before?: string }): Notification[]` (in_app only, newest first); `unreadCount(db, profileId): number`; `markRead(ctx, ids: string[])`, `markAllRead(ctx)` (actor's rows only).
- Emission: wherever a transactional email is enqueued (`rsvp_confirmed`, `waitlist_promoted`, `application_accepted/rejected`, `membership_approved/rejected`, `event_updated`, `event_cancelled`, `announcement`) also enqueue an `in_app` row with the same template + payload, `status: "sent"`, dispatcher ignores it. Staff in-app rows: new membership application, failed email batch (≥ 1 `failed`).
- `NotificationBell` shows `CountBadge`, opens a popover panel (last 8, "Mark all read", "See all" link); keyboard and screen-reader friendly (`aria-live="polite"` count change, no sound).

- [ ] **Step 1: Failing tests:** accepting a registration creates one `in_app` row for the applicant; `markRead` of another profile's id is a no-op; `unreadCount` drops after `markAllRead`; dispatcher run does not change `in_app` rows nor count against the daily email budget. e2e: Anuujin sees bell count after the admin sends decisions (use `/api/dev/reset` first), opening the panel marks nothing until "Mark all read" is pressed, `/en/me/notifications` lists with unread tint.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. **Step 4:** Run unit + e2e; expect PASS. Commit `feat(notifications): in-app inbox, bell and pages`.

### Task 7: Shells: role switch, avatar menu, themed dashboard, laptop layout
**Files:**
- Create: `src/components/shell/{ContextSwitch,AvatarMenu}.tsx`, `tests/unit/context-switch.test.tsx`, `tests/e2e/shells-roles.spec.ts`
- Modify: `src/components/admin/AdminShell.tsx`, `src/components/me/MeShell.tsx`, `src/lib/admin/nav.ts` (add `forms`, `analytics`, `inbox`; `settings` + `audit` flagged `adminOnly`), `src/components/admin/Dashboard.tsx`, `src/app/globals.css`, `src/components/live/PersonaSwitcher.tsx` (moves into `AvatarMenu`, dev only).

**Interfaces:**
- Produces: `<ContextSwitch current="admin" | "me" lang roles />` renders for roles `admin` and `organizer` only: segmented "Dashboard · Hackum · Site" (Site opens `/${lang}` in the same tab). `<AvatarMenu profile roles lang />` items: Profile (`/me/profile`), Notifications, Settings, Switch demo account (mockEnabled), Sign out.
- `adminNav(lang, roles)`: organizer gets Dashboard, Events, Members, Forms, Analytics, Comms, Inbox; admin additionally Settings, Audit. Direct URL to an admin-only page as organizer → `notFound()` through `requireStaffPage({ admin: true })`.
- /me ≥ 1024 px: left rail (nav + next-event card) 260 px, content grid `minmax(0,1fr) 340px` (right column = notifications + badges). < 1024 keeps floating header + bottom tab bar.

- [ ] **Step 1: Visual audit.** Screenshot `/en/admin` and `/en/me` light+dark at 390/1280/1536 (throwaway spec, see agent-brief §4); list every flat-white surface and write them in the commit message. Fix: `ops-canvas` glows on the page, tinted card washes by meaning, stage on every page, sidebar chrome continuous with page.
- [ ] **Step 2: Failing tests.** `context-switch.test.tsx`: renders nothing for role `member`; for `organizer` shows Dashboard and Hackum with `aria-current` on the current one. e2e: `dev-organizer` sees the switch in both shells, switching keeps the session, has no Settings/Audit nav items and gets 404 on `/en/admin/settings`; `dev-admin` sees all; Anuujin has no switch and `/en/admin` → 404; at 1280 `/en/me` shows the left rail and has no horizontal scroll.
- [ ] **Step 3:** Implement. **Step 4:** Run unit + `tests/e2e/shells-roles.spec.ts admin.spec.ts member-app.spec.ts a11y.spec.ts`; expect PASS. Commit `feat(shell): role switch, avatar menu, themed dashboard, laptop member layout`.

### Task 8: Profile, photo, semester subjects
> **Status:** rules done (`updateProfile` in `profile.ts`, `updateAcademic` + `setSemesterSubjects` in `academic.ts`, `saveAvatar`/`avatarFor` in `avatars.ts`, `src/lib/media/image.ts`). Remaining: client resize, upload action, `/api/avatar/[id]` route (use `avatarFor`, `Cache-Control: public, max-age=31536000, immutable` only when `cacheable` and `?v` equals the etag, else `private, no-store`; `X-Content-Type-Options: nosniff`), ProfileForm, SemesterSubjects, ProfilePreview.
**Files:**
- Create: `src/lib/mockdb/avatars.ts`, `src/app/api/avatar/[id]/route.ts`, `src/components/profile/{ProfileForm,AvatarUploader,SemesterSubjects,ProfilePreview}.tsx`, `src/lib/media/resizeImage.ts`, `tests/unit/mockdb-avatars.test.ts`, `tests/unit/resize-image.test.ts`, `tests/e2e/profile.spec.ts`
- Modify: `src/app/[lang]/me/profile/page.tsx`, `src/lib/me/actions.ts`, `src/lib/me/queries.ts`.

**Interfaces:**
- Produces: `sniffImage(bytes: Uint8Array): "png" | "jpeg" | "webp" | null` (magic bytes; SVG/HTML → null); `saveAvatar(ctx, bytes, declaredMime): Result<{ avatar_path: string }>` (≤ 1 MB after resize, ≤ 2048 px per side read from headers, sets `avatar_path = /api/avatar/<id>?v=<etag>`); `resizeImage(file: File, max = 512): Promise<Blob>` (createImageBitmap + OffscreenCanvas/canvas fallback, WebP 0.85, drops EXIF by re-encode, never upscales, rejects > 5 MB source).
- Route: `GET /api/avatar/[id]`: `Cache-Control: public, max-age=31536000, immutable` when `visibility !== "private"` and `?v` matches etag; owner/staff only with `private, no-store` otherwise; always `X-Content-Type-Options: nosniff`, 404 on unknown.
- `ProfileForm` fields: name mn/en, `SchoolMajorFields`, grad year, links, visibility, language; `SemesterSubjects` per `semesterOf(now)` and last 3 semesters: chip input (Enter/comma adds, Backspace removes), optional course suggestions from the NUM course names when school is NUM (static list, optional), "Share on my profile" switch; `ProfilePreview` shows "How others see you" including school, major track `Tag`, shared subjects.

- [ ] **Step 1: Failing tests:** `sniffImage` accepts real PNG/JPEG/WebP headers, rejects `<svg`, `<html`, a PNG renamed text; `saveAvatar` rejects declared `image/png` with SVG bytes, > 1 MB, 4097×4097 header; route returns 404 for private profile to anon and 200 + immutable for public; `resizeImage` output ≤ 512 px and has no EXIF segment (unit with a fixture JPEG containing an APP1 marker). e2e: Anuujin uploads a fixture PNG, avatar appears in profile, app bar and admin directory; saves subjects with share on → visible in preview, off → hidden in preview.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement (concurrency 1, object URL revoked on replace/unmount, optimistic preview, error text inline). **Step 4:** Run unit + `tests/e2e/profile.spec.ts`; expect PASS. Commit `feat(profile): photo upload pipeline, school/major, semester subjects`.

### Task 9: Forms: admin editor, responses, guest registration form
> **Status:** domain + CSV done (`forms.ts`: `listForms`, `listResponses`, `formDefinition`, `orphanKeys`, `updateForm`, `submitJoinForm`; `src/lib/forms/csv.ts: responsesToCsv(questions, rows, lang, orphans?)`; `applyForMembership` now takes `answers`). Remaining: admin pages, editor, responses table, CSV download route, guest registration form wiring.
**Files:**
- Create: `src/lib/mockdb/forms.ts`, `src/lib/forms/csv.ts`, `src/app/[lang]/admin/forms/page.tsx`, `src/app/[lang]/admin/forms/[id]/page.tsx`, `src/components/admin/forms/{FormsList,FormEditor,ResponsesTable}.tsx`, `tests/unit/{mockdb-forms,forms-csv}.test.ts`, `tests/e2e/admin-forms.spec.ts`
- Modify: `src/lib/mockdb/{types,seed,queries}.ts`, `src/components/admin/events/EventForm.tsx` (reuse `FormEditor` for the question builder), `src/app/[lang]/me/events/[slug]/apply/page.tsx`, `src/components/me/ApplyFlow.tsx`, public event page RSVP panel.

**Interfaces:**
- Produces: `Form { id: string; kind: "membership_application" | "join"; title: L; questions: Question[]; updated_at: string; updated_by: string | null }`; `listForms(db): FormSummary[]` where `FormSummary { id: string; kind: "event_registration" | "membership_application" | "join"; title: L; event_id: string | null; question_count: number; responses: number; last_response_at: string | null }` (event forms derived from events with `reg_mode` or questions); `updateForm(ctx, id, questions): Result<Form>` (staff, `questionsSchema`, ≤ 20 questions, audit entry); `listResponses(db, id): { profile_id: string; submitted_at: string; status: string; answers: Answers }[]`; `responsesToCsv(questions: Question[], rows): string` (header = question labels in the viewer's language, UTF-8 BOM, CRLF, quotes doubled, cells beginning `= + - @` or tab prefixed with `'`).
- Rule: removing a question keeps stored answers; `ResponsesTable` renders orphan answer keys under "Removed question: <id>".
- Guest registration: the public event page and `/me/events/[slug]/apply` render the event's questions through one `QuestionFields` component with the same validation as the server (`answersSchema`), signed-out guests see the form after a one-line "create account (30 s)" step that reuses Task 5's `CreateAccountForm` inline.

- [ ] **Step 1: Failing tests:** `responsesToCsv` escapes `=1+1` → `'=1+1`, keeps `a,"b"` quoting, newlines inside cells, and Mongolian text; `updateForm` as organizer ok, as member `forbidden`, 21 questions `invalid`; `listForms` counts responses for a seeded hackathon; removed-question case above. e2e: organizer opens `/en/admin/forms`, sees three kinds, edits the membership form adding a required "short" question, a new applicant then sees it in `/en/join`; responses tab shows seeded answers and "Export CSV" downloads a file whose first line is the header.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. **Step 4:** Run; expect PASS. Commit `feat(forms): admin forms hub, editor, responses and CSV`.

### Task 10: School scope on events (admin, member, public)
**Files:** Modify `src/components/admin/events/EventForm.tsx`, `EventsList.tsx`, `src/components/me/*` event cards and apply page, `src/lib/public/select.ts`, public event page, i18n; Test `tests/e2e/school-scope.spec.ts`.

- [ ] **Step 1: Failing e2e:** organizer creates an event with scope "МУИС only" (segmented control "All schools / МУИС only" with helper text), the list shows a `Tag` "МУИС"; Temuulen (MUST guest) sees it in `/me/events` with a lock `Tag` and the RSVP button replaced by the explanation "This event is for МУИС students" (no dead end: link to "Browse open events"); Anuujin can RSVP; a direct POST of the action as Temuulen returns `ineligible` (unit already covers the rule, e2e covers the UI message).
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement UI only (rule exists from Task 2). **Step 4:** Run; expect PASS. Commit `feat(events): МУИС-only vs all-schools audience in admin, member app and public site`.

### Task 11: Analytics diagrams
> **Status:** `analytics(db, range)` done in `src/lib/mockdb/analytics.ts` with tests. Remaining: chart components, page, dashboard.
**Files:**
- Create: `src/lib/mockdb/analytics.ts`, `src/components/charts/{AreaChart,BarChart,FunnelChart,DonutChart,HeatStrip,ChartFigure}.tsx`, `src/app/[lang]/admin/analytics/page.tsx`, `tests/unit/{mockdb-analytics,charts}.test.ts(x)`, `tests/e2e/admin-analytics.spec.ts`
- Modify: `src/components/admin/Dashboard.tsx` (replace ad-hoc charts with the shared ones).

**Interfaces:**
- Produces: `analytics(db, range: { from: string; to: string }): { registrationsByDay: {day: string; n: number}[]; funnel: { registered: number; going: number; attended: number }; showRateByKind: {kind: EventKind; rate: number | null; n: number}[]; membersBySchool: {school_id: SchoolId; n: number}[]; membersByTrack: {track: MajorTrack; n: number}[]; bySemester: {year: number; term: Term; events: number; registrations: number; attended: number}[]; retention: { cohort: string; returned: number; total: number }[] }`. `rate` is `null` (not 0) when no completed events.
- Charts take plain data + `label` + `unit`, render an SVG with `role="img"` and an adjacent visually-hidden `<table>` of the same numbers; colours from tokens `c1–c5` + a pattern/label (never colour alone); empty data shows the "no data for this range" state with the mascot.
- Page: `DateRangePicker` (default this semester) + `SegmentedTabs` Overview · Events · Members · Semesters; range in the URL (`?from&to`).

- [ ] **Step 1: Failing tests:** `analytics` over the seed: funnel is non-increasing; `showRateByKind` is `null` for kinds with no completed events; `bySemester` splits an event at 2026-12-31 23:30 UB into spring; charts render a table fallback with identical numbers; `DonutChart` with a single slice and with zero total do not produce `NaN` paths. e2e: analytics page loads at 1280/390 without horizontal scroll, axe clean, range change updates URL and numbers.
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement per the `dataviz` skill (hand-rolled SVG, no chart library). **Step 4:** Run; expect PASS. Commit `feat(analytics): accessible charts, analytics page, dashboard upgrade`.

### Task 12: Adopt the shared parts across admin lists
**Files:** Modify members (`MembersDirectory`, `ApplicationsQueue`, `MemberDrawer`), event registrations (`RegistrationsView`), comms (`OutboxTable`, `StatusTabs`), audit (`AuditTable`, `AuditFilters`), events list, settings tabs; Test: extend each area's e2e, add `tests/e2e/lists-consistency.spec.ts`.

- [ ] **Step 1: Failing e2e (`lists-consistency`):** every admin list page has `FilterBar`, shows "Clear filters" once a filter is active, preserves filters in the URL, rows open the preview drawer by click and by keyboard (Enter on the row's name button), selection bar sticks above the tab bar at 390 px, tabs are `SegmentedTabs` (assert role/arrow-key behaviour on one page per area), drawers are rounded (computed `border-radius` ≥ 24 px on ≥ sm).
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Migrate each list: search + `Tag` chips + `DateRangePicker` where a date exists (registrations, comms, audit, members "joined"), `pageSize` 25, `onRowClick` → drawer, school/track/semester columns and filters on Members. **Step 4:** Run the full admin e2e set; expect PASS. Commit `feat(admin): consistent filters, tabs, selection and previews`.

### Task 13: Delivery hardening and final verification
**Files:** Create `tests/e2e/route-matrix.spec.ts`; Modify `next.config.ts` headers (avatar route cache), `docs/design/polish-rubric.md` (add `Tag`/`CountBadge`/forms rules), `docs/superpowers/agent-brief.md` if gotchas appear.

- [ ] **Step 1: Route matrix test:** for each persona × each route in the spec §3 assert expected outcome (200 / redirect target / 404), including signed-out redirects with `next`, new-guest → onboarding, organizer 404 on admin-only pages, MUST guest 200 on `/me` and `ineligible` copy on membership page.
- [ ] **Step 2: Load/media checks:** `curl -sI /api/avatar/<id>?v=…` shows `immutable` on the second request; initial JS of `/en/sign-in` does not include `num-programs.json` (assert via build output size or a network log in Playwright: the JSON is requested only when the major field is focused); search inputs debounce 250 ms and cancel stale requests (unit with fake timers); SSE reconnect backs off with jitter and pauses when `document.hidden`.
- [ ] **Step 3:** Full gate: `npx vitest run && npx tsc --noEmit && npx eslint . && npx playwright test` (serial); `npm run build` succeeds and demo surfaces 404 without `ADMIN_PREVIEW=1`; Lighthouse mobile on `/en/sign-in`, `/en/admin`, `/en/me` a11y ≥ 98, CLS 0.
- [ ] **Step 4:** Screenshots at 390/768/1280/1536, light + dark, of sign-in, join, admin dashboard, analytics, forms, members drawer, /me home, profile, notifications; review each against the rubric; fix, then commit `chore: route matrix, delivery checks, final polish`.

## Parallelism
Tasks 2 → 3 → 4 are sequential (shared interfaces). Task 5 needs 2–4. Tasks 6, 8, 9, 11 can run in parallel agents after 5; 7 after 4 and 6 (bell); 10 after 2 and 9; 12 after 4 and 9; 13 last. Shared files (`AdminShell`, `DataTable`, i18n areas) are owned by Tasks 7, 4 and per-area files respectively; agents must not edit another task's owned file without a message to the owner.
