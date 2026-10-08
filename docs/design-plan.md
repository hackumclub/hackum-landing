# Hackum — design plan (v2)

## Subject, audience, job
- **Subject:** Hackum Students Club. It's a student tech club (МУИС / NUM) founded in 2017, and its mascot is the Мануул: grumpy-cute, a bit lazy, codes with coffee.
- **Audience:** first- and second-year IT students deciding whether to join, plus partners checking out the club.
- **Primary job:** show who the club is in 5 seconds (real people, the Мануул, real events), then get students to "Клубт нэгдэх".

## Concept — "a laptop lid covered in stickers"
Every member's laptop is covered in Мануул stickers. The site is that lid: a calm, single-theme surface, with the stickers as the only playful element. You can grab them and drag them around.

## Tokens (one theme)
| name | hex | role |
|---|---|---|
| ink | `#0E1A2B` | the navy of the Figma sticker sheet; big blocks, headings |
| fur | `#EEF0F4` | the Мануул's grey fur; page background |
| paper | `#FFFFFF` | cards, tickets |
| stone | `#69758A` | secondary text |
| whisker | `#2F6BFF` | the **only** accent (links, CTAs, focus); the blue of the Мануул's whiskers |

The stickers keep their own green tail and yellow toast. They're the only extra colour on purpose, so they stand out.
The old tokens (`sand`, `peri`, `mint`, `sun`, `teal`, `lav`) are mapped onto this palette, so every page goes monochrome without per-page rewrites.

**Type:** Montserrat 900 for display (the same face as the "МАНУУЛ" wordmark in the brand deck), Nunito Sans for body. No all-caps eyebrow labels, and no single-word colour accents in headlines.

## Layout
```
nav   Hackum ............ Эвентүүд  Бидний тухай  [Клубт нэгдэх]
┌ ink block, 48px rounded bottom ───────────────────────────────┐
│ Сайн уу? Бид Hackum.                                          │
│ Технологид дурлагч                                            │
│ оюутнуудын клуб.        ← huge, white, left aligned           │
│ [Клубт нэгдэх] [Эвентүүд]       Мануул stickers scattered,    │
│                                   draggable ("чирээд үз")     │
└───────────────────────────────────────────────────────────────┘
 2017 оноос · 3 их сургууль · 8+ тэмцээн   (one sentence)
 [photo stack]  | who we are (mission, short)
 ── "Бидний бүтээсэн дурсамж": pinned horizontal timeline ──
    year → photo card, scrubbed by scroll (GSAP ScrollTrigger)
 Events: typographic TICKETS (no photos). Big year, name,
         tagline, perforated stub, a Мануул peeking over the edge
 "Бид юу хийдэг вэ": list rows; hovering a row shows a sticker
 ink block CTA: "Мануулын багт нэгдээрэй" + sticker pile
 footer
```
Everything is left aligned, with one 1200px column.

## Motion (GSAP, one idea each)
1. **Load:** the headline lines rise in, then the stickers "slap" onto the lid (scale 1.4→1, small rotate, stagger). This is the one orchestrated moment.
2. **Timeline:** horizontal scroll pinned to vertical scroll. The photos only appear here, each next to its correct year.
3. **Drag:** hero stickers use GSAP Draggable with inertia-like throw. This only runs when the user acts.

Nothing else animates on its own (no fade-up on every section). Reduced motion turns off 1 and 2, and the timeline becomes a normal horizontal scroller.

## Events without photos
`EventTicket` is a typographic ticket built only from our own data: the year in giant type, the name, the tagline, a perforated stub with the mode and type, and one Мануул sticker matched to the event (laptop → hackathon, torch → C Battle, toast → Typerace…). The same ticket, made bigger, is the header of each event page.

## v3 additions
- **Logo** (`public/img/brand/`, `app/icon.png`): it appears in the header and footer and as the favicon. Its gradient is the one multi-colour brand moment: the hero glow and the timeline progress rail. Everything else stays navy, fur grey and whisker blue.
- **Timeline:** a pinned dark band with one column per year and a giant translucent year that follows the column in focus. A gradient rail with year ticks runs along the bottom. Photos tilt and scale in, and that year's poster (2020, 2025, 2026) is tucked behind the photo. Years without media get a logo card. It ends on a "next chapter" join card.
- **Posters over Мануулs:** the programs list previews each program's real poster. A draggable poster wall shows the marketing team's work, and the join section fans the recruitment posters. The hero keeps 3 stickers and the event tickets keep one each.
