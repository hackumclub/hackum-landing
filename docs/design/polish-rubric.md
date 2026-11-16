# Polish rubric: how to review and fix a screen (Hackum look)

Walk each screen in your area as the real person would, at **390, 768 and 1280 px**, **light and dark**, with the right persona
(`dev-admin`, `dev-organizer`, `anuujin`, `temuulen`, `saraa`, `new-guest`). Screenshot it (throwaway Playwright spec, see
`docs/superpowers/agent-brief.md` §4), *look at the PNG*, list what is wrong, fix it, look again. Be harsh: the owner called the
first version "so dumb" because it was flat, white and generic. The reference is the public site (`/en`): a rounded brand-blue
stage with a huge white Montserrat title, glossy pills, floating Manuls, 3D icons, soft glows, generous radius.

## Sizes and positions
- Tap targets: **/me ≥ 44px** high; admin controls ≥ 40px; icon-only small buttons ≥ 28px. Nothing clickable closer than 8px to a neighbour.
- Radii: cards `var(--radius-md)` (20px), inner chips/inputs `var(--radius-sm)` (12px), buttons and pills `rounded-full`.
- Spacing on a 4/8 scale: gap between page sections 24px (`gap-6`), inside cards 12-16px, card padding `p-4` (phone) / `p-5` (desktop). No cramped rows, no big dead gaps.
- Alignment: labels, numbers and actions line up on a grid; numbers right-aligned with `tnum`; actions in the same corner on every screen of the same kind.
- Text: body ≥ 14px (admin) / 16px (/me); titles Montserrat; never truncate something the person needs (wrap it); long Mongolian words must not overflow (`[overflow-wrap:anywhere]` where needed).
- Phones: **no horizontal page scroll**; tables show at most 3 columns (hide the rest with `hideBelow`) with the row opening a drawer; tab rows scroll with the fade cue; bulk/selection bars and form submit bars **stick to the bottom** above the tab bar; filters fold behind `FilterDisclosure` (`src/components/ui/FilterDisclosure.tsx`): wrap every screen's chip groups in it.

## Flow
- One clear **primary action** per screen, visible without scrolling on a phone.
- After an action, say what happened (toast) and **what to do next** (a button to the natural next screen). Never leave the person on a dead end.
- Back/breadcrumb on every nested screen; the current section is highlighted in the nav.
- First-time guidance where a term is unclear (e.g. what "Send decisions" does, what "waitlisted" means): one sentence under the title or in an info row, not a manual.
- Every list: loading skeleton shaped like the result, empty state (mascot sticker + one-line + ONE action), no-results state with "Clear filters", error state with retry.
- Destructive or email-sending actions: confirm dialog naming the object, the count and the verb.
- Disabled states explain *why* (text or tooltip), never a silent grey button.

## Look (match the public site)
- Every page opens with the blue **Stage** (`src/components/ops/Stage.tsx`) with art (3D icon from `/public/img/icons3d` or a Manul sticker from `src/lib/manul.ts`). One h1.
- Use art at moments, not everywhere: stage art, KPI icons, empty/error/success/blocked states (stickers: build, checkin, comfort, feedback, grad, lock, mail, offline, queue, rsvp, search, team, trophy, writing; 3D icons: bell, camera, chart, clipboard, clock, flag, gift, grad-cap, handshake, id, link, lock, mail, passkey, pin, qr, shield, ticket, users, wifi, plus the older ones).
- Cards lift off the page (shadow) instead of sitting flat; tint cards by meaning with the soft washes (`--ops-accent-soft`, `ok`, `warn`, `ember`); status always via `StatusPill`.
- Primary buttons are the glossy `ops-gloss` pill (turn white on the stage automatically); secondary are white pills; never two primary buttons side by side.
- Colour only for state or data; tokens only (`bg-panel`, `text-fg`, `bg-accent-soft`…), never hard-coded hex. Dark mode must look as intentional as light.

## Features and components that need to improve (report, do not build)
After the fixes, write the **top 5 improvements still missing in your area**, ranked by impact ÷ effort, each with one sentence on why a
student or organizer needs it (think: new student discovering and joining, organizer running an event day, alumni staying in touch,
the board reading a quarterly report). Include missing components (e.g. a date-range picker, a sticky action bar, a combobox) and missing flows.
