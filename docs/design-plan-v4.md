# Hackum — design plan v4

## Inputs
- **Devfolio:** clean header (wordmark left, centred links, CTAs right). Footer with a big "We love software and the people who build them" headline, social icons, three link columns and an organic curved two-tone background. Community/join block surrounded by floating illustrated icons. Blue band with a tiled icon pattern.
- **Logo colours:** `#0085CA` (theme), `#00AB84`, `#E5BF03`, white and black.
- **Requests:** glass surfaces, GSAP motion, 3D icons, a better cursor, English + Mongolian, `/hackathons` → `/events`, members by year with search, revert "Бид юу хийдэг вэ?", same-size timeline cards with the poster behind, and an Instagram phone preview on hover.

## Tokens
| token | value | use |
|---|---|---|
| brand | `#0085CA` | theme: CTAs, links, hero band, focus |
| brand-deep | `#005B8C` | hover, gradients |
| night | `#071B29` | dark bands (timeline), text on light |
| leaf | `#00AB84` | small accents only (success, tags) |
| sun | `#E5BF03` | small accents only (highlights, stars) |
| mist | `#EEF4F8` | page background |
Glass = `bg-white/10` + `backdrop-blur-xl` + `ring-1 ring-white/20` on dark; `bg-white/60` + blur on light.

## Routes (bilingual)
```
/            → proxy redirects to /mn or /en (Accept-Language, default mn)
/[lang]                  home
/[lang]/events           (was /hackathons)   /[lang]/events/[slug]
/[lang]/about            story, goals, members by year
/[lang]/join             (was /organize)
/[lang]/code-of-conduct
```
Old URLs (`/hackathons/*`, `/organize`) get permanent redirects. The Devfolio-template leftovers (blog, jobs, changelog, signin, terms) aren't linked anywhere, so they move to `_archive/` instead of being deleted.
Text lives in typed dictionaries `src/i18n/{mn,en}.ts`. `en` must satisfy the `mn` shape, so a missing translation fails the type check.

## Components
1. **Header** (Devfolio-style): logo + wordmark | Events · About · Join | MN/EN switch + Instagram + Join CTA. Transparent at the top, glass after scrolling.
2. **Cursor:** a dot plus a trailing ring (GSAP `quickTo`). The ring grows over links and shows a label from `data-cursor` ("Drag", "View", "Open"). Only on fine pointers, never with reduced motion.
3. **Hero:** a brand-blue band with the logo-gradient glow, a glass stat chip row, the draggable Мануулs (3), and magnetic CTA buttons.
4. **Programs ("Бид юу хийдэг вэ?"):** reverted to the earlier ruled list with a hover sticker.
5. **Timeline:** every year is the **same size** square stack: front card plus back card (the year's poster, or a second photo of the same year), peeking out. Hovering brings the back card forward. Years with no media get a logo card of the same size.
6. **Join ("community") section:** a glass card in the centre, ringed by **3D icons** (3dicons.co, CC0) that float (GSAP) and drift with the mouse (parallax).
7. **Instagram button:** hovering or focusing opens a **phone mock-up** of @hackumclub (logo avatar, bio and a scrollable grid of our posters). Clicking opens Instagram. On touch it's just a link.
8. **Events:** a glass search with an animated placeholder, a `/` shortcut, a clear button, filter chips (type and year), and a live result count.
9. **About:** story, goals and mission/vision, then **Members**: a year selector (2017→2026), a search box that finds anyone by name or team across all years, and member cards (photo or initials, name, role, team).
10. **Footer** (Devfolio-style): a big headline, social icons, three link columns, a curved two-tone background, and the logo.

## Motion budget
Hero entrance, floating icons, timeline scrub, cursor and magnetic buttons. Everything respects `prefers-reduced-motion`.

## Implemented (2026-10-08): where to edit things
| What | File |
|---|---|
| UI text (both languages) | `src/i18n/mn.ts` (defines the shape), `src/i18n/en.ts` (must match, enforced by `tsc`) |
| Events | `src/data/events.json` (`tagline` + `tagline_en`); English names for Cyrillic titles in `src/lib/events.ts` |
| Timeline milestones + per-year front/back images | `src/lib/club.ts` (`TIMELINE`, `TIMELINE_MEDIA`) |
| Members by season | `src/data/members.ts`: add `{ season, role, team, name: { mn, en }, photo: "/img/members/x.jpg" }` |
| Instagram phone feed | `src/lib/feed.ts` (static posters for now; swap in Graph API data with the same shape) |
| Posters | `public/img/posters/` + `src/lib/posters.ts` |
| 3D icons | `public/img/icons3d/` (3dicons.co, CC0) |
| Old routes → new | `next.config.ts` `redirects()`; locale prefixing in `src/proxy.ts` |
| Archived template pages | `_archive/` (not routed, excluded from tsc/eslint) |
