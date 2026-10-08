# Motion plan (GSAP 3.15 + @gsap/react 2.1.2)

**Licence:** GSAP and all plugins (SplitText, ScrollSmoother, Flip, Draggable, Inertia) are free for commercial websites under the Webflow standard licence. The only restriction is on no-code animation-builder tools that compete with Webflow, which doesn't apply here.

**Showcase takeaways** (Unseen, A24, Illoca, Ravi Klaassens): masked line reveals, panel page transitions, gentle smooth scroll, restrained parallax, and cursor states that use icons, not words.

## System
| Piece | Choice |
|---|---|
| Plugins | Registered once in `src/motion/gsap.ts` |
| Timing | `src/motion/config.ts`: durations 0.35/0.6/0.9, eases `power4.out` (text), `power3.out` (UI), staggers 0.04 words / 0.08 lines / 0.06 cards |
| Smooth scroll | **ScrollSmoother** (`smooth: 1`, `effects: true`, no smoothing on touch). The header, cursor, transition overlay and lightbox sit outside the wrapper |
| Refresh | `ScrollTrigger.refresh()` after `document.fonts.ready`, on window `load`, and after each route or language change |
| Media rules | `gsap.matchMedia()`. Desktop with motion gets everything. Touch/mobile gets reveals and counters only (no smoothing, tilt, cursor or parallax). Reduced motion shows final states immediately |

## Effects → where
| Effect | Where |
|---|---|
| Masked **line** slide-up (SplitText `lines`, `mask: "lines"`, power4) | Hero headline, page heroes (Events, About, Join) |
| **Word** reveal (`mask: "words"`, ScrollTrigger `once`) | Every section title |
| Line fade + slide | Paragraphs: About story, mission, Who we are |
| Scrubbed word opacity 20% → 100% | "N years, 3 universities…" statement |
| Keyword highlight (blue + underline sweep) | `[bracketed]` words in titles: *events*, *Hackum*, *community* |
| Rotating word | Hero: "Together we build / learn / compete" |
| Count-up, then label fade | Hero stat chips, About stats band |
| Parallax (`data-speed`) | Hero glow and sticker layer, timeline glow |
| Pinned horizontal timeline | Home (kept). The active year syncs: its poster slides out and its title/date animate in |
| Staggered card entrance (ScrollTrigger batch) | Main events, goals, teams, join steps |
| Tilt + glass shine (pointer-driven) | Event tickets, goals and team cards |
| Magnetic + fill + text roll-over | Primary buttons and nav links |
| **Flip** | Members grid (year switch and search), events results (search and filters) |
| Floating 3D icons + depth parallax; icons overlay the band's corners and the glass card's corners | Join section |
| Phone slide-up + tilt, idle auto-scroll | Instagram preview |
| Flip zoom from the clicked card, swipe, thumbnails | Lightbox |
| Cursor via `quickTo`: eye icon on previews, arrows on drag, ↗ on links out | Global |

## Removed after review
The blue panel page transition and the header scroll-progress line were tried and dropped: navigation is now instant and the header stays calm.

## Not animated on purpose
Body text after its first reveal, footer links, form fields, and anything while it's being read.
