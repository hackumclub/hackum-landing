# Codex prompts: stickers, 3D icons and badge art for Hackum OS

Paste **one master prompt** (A, B or C) into Codex, attach the reference images it names, then paste the **item list** under it.
Ask Codex to generate every item, remove the background, trim to the content with 4% padding, and save to the exact path shown.
When the files are in place, tell me. I register them in `src/lib/manul.ts` / `Icon3D` and use them in the empty, success and error states.

Reference images to attach (they are in the repo):
- Stickers: `public/img/manul/laptop.png`, `public/img/manul/yell.png`, `public/img/manul/sleepy.png`
- 3D icons: `public/img/icons3d/trophy.png`, `public/img/icons3d/calendar.png`, `public/img/icons3d/medal.png`

Already exist (do not redo): stickers `coffee grumpy laptop roll sleepy smug toast torch wave yell`; 3D icons `bulb calendar chat coffee computer fire heart medal megaphone mic notebook puzzle rocket send star target trophy`.

---

## A. Master prompt: Мануул stickers (14 new)

```
Create a set of die-cut vector-style stickers of "Мануул", the club mascot: a Pallas's cat (manul) with a flat round
grey head, short rounded ears with black tips, thick dark eyebrows, big glossy black eyes with white highlights, a small
teal heart-shaped nose, thin blue whiskers, black tabby stripes on the cheeks, a yellow (#e5bf03) tuft of fur on top of
the head with a tan (#cd9c6b) streak, a chunky grey body (#d8d7dc fur, #939498 shading) with a light-blue belly
(#9ac0d7). Match the attached reference stickers exactly in proportions, line weight and shading.

Style rules:
- Flat vector illustration, clean solid fills, a thin dark outline (#231f20) on the character, minimal soft shading only.
- Every sticker has a thick WHITE die-cut border (about 4% of the image width) with a thin light-grey outer edge, like a
  printed sticker. Nothing outside the white border.
- Palette only: character colors above, brand blue #0085ca for props, brand yellow #e5bf03, brand green #00ab84,
  ember orange #eb692a (sparingly), white, near-black #071b29. No gradients except a tiny highlight on glossy props.
- Transparent background. PNG, 1024 px on the longest side, character centered, same visual scale across the set.
- No text, letters, logos or watermarks inside the artwork unless the item says so.
- Friendly and a little sarcastic, never cutesy or childish. Expressive eyebrows do most of the acting.
```

**Items** (one PNG each, save to `public/img/manul/<name>.png`):

| name | scene | used for |
|---|---|---|
| `trophy` | Manul lifting a small silver trophy overhead with both paws, eyes closed, proud smirk | badge awarded, winner |
| `checkin` | Manul holding a smartphone toward the viewer showing a big green check mark on the screen, one thumb up | check-in success |
| `queue` | Manul sitting patiently holding a paper queue ticket with a plain ember-orange circle on it (no digits), one eyebrow raised | waitlisted |
| `writing` | Manul at a tiny desk writing on a sheet with a thick yellow pencil, tongue slightly out, concentrating | applying, forms |
| `comfort` | Manul with a small blue heart in one paw, other paw raised in a gentle "it's okay" gesture, soft smile | kind rejection email, "not this time" |
| `mail` | Manul hugging a large white envelope with a blue wax-seal circle, ears perked | invite sent, inbox empty |
| `rsvp` | Manul wearing a small blue party hat holding a calendar page with a plain blue square on it, happy squint | RSVP confirmed |
| `team` | Two Manuls (one with the yellow tuft, one with a blue tuft) doing a high-five, mid-jump, in the same sticker | teams |
| `grad` | Manul wearing a black graduation cap with a yellow tassel, holding a rolled diploma tied with a blue ribbon | alumni |
| `feedback` | Manul holding a clipboard with a big yellow star on it and a pencil behind the ear, thoughtful look | feedback requests |
| `offline` | Manul tangled in a blue cable, holding the unplugged end, dizzy spiral eyes | error, offline, server down |
| `search` | Manul peering through a big magnifying glass, one eye hugely enlarged, curious | no search results |
| `lock` | Manul wearing a tiny guard cap, paw raised like "stop", standing in front of a closed blue gate | members only, 403 |
| `build` | Manul in a yellow hard hat holding a wrench, a few ember-orange sparks | "coming soon" pages |

---

## B. Master prompt: 3D icons (20 new)

```
Create a set of 3D icons in the exact style of 3dicons.co "clay + glass + metal": soft rounded chunky shapes, slightly
glossy, subtle bevels, studio lighting from the top-left, soft contact shadow baked inside the image only as a faint
ground glow (no hard drop shadow). Match the attached reference icons exactly in render quality, rotation (about 15°
tilt, slightly from above), material mix and level of detail.

Rules:
- Each icon is ONE object, centered, transparent background, PNG, exactly 400 x 400 px (the existing icons are 400 px),
  object filling about 78% of the canvas.
- Palette: brand blue #0085ca (main), brand yellow #e5bf03, brand green #00ab84, ember orange #eb692a (accent only),
  chrome/silver metal, frosted white glass. At most 2 colors plus metal per icon.
- No text, no numbers, no letters, no faces. No background plate or tile.
- All icons share one light direction and the same visual weight so they sit together in a grid.
```

**Items** (save to `public/img/icons3d/<name>.png`):

| name | object | used for |
|---|---|---|
| `qr` | a chunky blue square tile with a simple abstract QR-like pattern in white clay blocks | check-in |
| `wifi` | a glossy blue wifi symbol of three arcs and a dot, standing upright on a small chrome stand | campus network check-in |
| `pin` | a glossy yellow map pin with a white glass dot, sitting on a tiny blue ground disc | venue, geofence |
| `grad-cap` | a black clay graduation cap with a yellow tassel | alumni |
| `mail` | a closed white envelope with a blue heart-shaped seal | email |
| `bell` | a yellow metal bell with a blue clapper | notifications |
| `chart` | three rounded bars (blue, yellow, green) of rising height on a frosted glass base | analytics |
| `shield` | a blue shield with a white clay check mark | security, verified |
| `ticket` | a yellow admission ticket with perforated edge notches and a blue star cut-out | tickets, RSVP |
| `camera` | a chunky white camera with blue lens ring and a green flash | event photos |
| `id` | a white member card with rounded corners, a blue avatar circle and two grey lines | member card |
| `handshake` | two clay hands (blue sleeve, yellow sleeve) shaking | partners, mentors |
| `flag` | a green flag on a chrome pole with a blue base | milestones, goals |
| `users` | three simple clay person busts (blue, yellow, green) clustered | teams |
| `clipboard` | a white clipboard with a chrome clip and three green check rows | applications review |
| `lock` | a chrome padlock with a blue body | permissions |
| `passkey` | a chrome key with a fingerprint-patterned yellow head | passkey sign-in |
| `clock` | a white wall clock with chrome rim and a blue second hand | reminders |
| `link` | two interlocking blue chain links | share links |
| `gift` | a blue gift box with a yellow ribbon | rewards, welcome |

---

## C. Master prompt: badge emblems (10, for the achievements system)

```
Create a set of collectible 3D badge emblems for a student tech club: each is a round coin-medal with a raised rim, a
distinct embossed center symbol, and a short ribbon tail. Style: the same 3dicons-like clay + metal render as the
attached reference. Tier is shown by metal: bronze (#b87333), silver (#c0c7cf), gold (#e5bf03 with warm highlights).
Center symbols are simple and readable at 64 px. Accent color per badge from the club palette (blue #0085ca, green
#00ab84, ember #eb692a). Transparent background, PNG, 512 x 512, no text or numbers anywhere.
```

**Items** (save to `public/img/badges/<name>.png`, create the folder):

| name | tier | center symbol |
|---|---|---|
| `first-event` | bronze | a small door opening with a blue star |
| `regular` | silver | five stacked chevrons (attended 5 events) |
| `hackathon` | gold | a lightning bolt over a laptop |
| `feedback` | bronze | a speech bubble with a green check |
| `two-seasons` | silver | two linked rings (2 seasons) |
| `organizer` | gold | a megaphone with ember sound-waves |
| `mentor` | gold | a handshake over a graduation cap |
| `team-player` | silver | three clustered busts |
| `winner` | gold | a trophy with a blue gem |
| `early-bird` | bronze | a sunrise over a clock |

---

## After generating

1. Check each file is a transparent PNG at the stated size and has a clean edge (no halo). If a sticker's white border is
   uneven, ask Codex to regenerate that one only.
2. The mascot must stay consistent: same yellow tuft, same blue laptop-blue (#0085ca), same belly color. Reject drift.
3. Keep the set license-clean: generated by you, no third-party characters or logos. Add a line to
   `public/img/icons3d/LICENSE.txt` noting which icons are in-house generated.
4. Tell me when the files are in place, and I will wire them up and check them in light and dark mode.
