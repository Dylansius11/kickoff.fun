# KICK.FUN — Design Guide

_The design language: **Floodlit Arcade**. This is the taste layer every screen must pass. Tokens live in `/brand.md`; this doc is the "why", the component specs, the motion choreography, and the anti-slop contract._

> North star: **a mainstream football fan opens it and grins in 3 seconds; a TxODDS judge sees premium craft, not a hackathon toy.** Fun on the surface, disciplined underneath.

---

## 0. Design brief (the one-paragraph contract)

**Floodlit Arcade** = stadium-at-night × retro pixel arcade. Dark-only. A single hero accent (pitch green) on floodlit near-black, with amber and red used **only** as match signals. Sharp edges, thick 2px borders, hard offset "sticker" shadows, a strict 4px pixel grid. Three type roles — pixel display, mono scoreboard, grotesk body — never confused. Motion says "**live, not scary**": pulse and rolling numbers for the steady state, one expressive burst when a goal hits. Wild in the big moments, ruthlessly legible everywhere else.

Convergence test we must pass: _"If someone said AI made this, would they believe it immediately?"_ → **No.** Nothing here is the safe centered-card-with-violet-gradient default.

---

## 1. Why this direction (grounded, not vibes)

Three forces point to the same place:

1. **Your brand already chose it.** The mark = a floodlit-green football with a black terrace/stand triangle; the wordmark = a chunky pixel bitmap. Green + black + chalk + pixels. We systematize what exists — we don't invent.
2. **The 2026 meta.** The field moved off soft shadows and frosted glass toward **pixel fonts, raw borders, retrofuturism** (neon-on-pixel, arcade optimism through a modern lens). The catch from the research: _"retro is the easiest aesthetic to fake and the hardest to pull off… modular pixel UI systems — pixel buttons, cards, icons as a design system — are what make it scale instead of showing up as a single gimmick."_ So we build a **system**, not a hero illustration.
3. **The prediction-UX gap.** Research is blunt: prediction markets have _"barely scratched the surface of gamification… a fundamentally passive experience between bet and payout,"_ and real-time UI must _"communicate 'this is live' without communicating 'urgent and scary'"_ — rolling counters, not flashing. We are a **game with a live scoreboard**. We own exactly the gap the incumbents left open.

**What we borrow, what we reject:**
- Borrow the **structure** of Brutalist/Raw (thick borders, hard edges, exposed grid) + the **flavor** of Retro-futuristic (pixel, arcade glow) + the **approachability** of Soft Consumer (mobile-first, big touch targets, progressive disclosure) + the **data discipline** of Workstation Dense (mono tabular numbers, live states) — but only in the scoreboard.
- Reject: violet/blue AI gradients, glassmorphism, uniform rounding, soft scattered shadows, pixel-as-gimmick (pixel font pasted on a weak layout).

---

## 2. Brand foundations

### 2.1 The mark
- **Logo (ball + black terrace triangle + two chalk bars):** the app icon, splash, loading, and the "verified" seal moments. The triangle reads as a stand/terrace and a "play" glyph — lean into both.
- **Wordmark (KICK.FUN pixel):** headers, nav brand, share cards, the demo intro. Never re-typeset it in a different font — use the SVG.
- **Clearspace:** minimum padding around either = height of one "pixel unit" of the wordmark (≈ the bar width). Never crowd it.
- **Don't:** recolor the mark outside {pitch green, ink, chalk}; add glows to the logo except the one floodlit hero moment; stretch or rotate.

### 2.2 The metaphor system
Everything borrows from a matchday, consistently:
- A room = a **terrace** ("start a terrace"). A prediction = a **call**. Points = **glory**. Correct streak = **form / on fire**. The proof = a **receipt / ticket stub**. The Oracle = the **gaffer/announcer**. Leaderboard = the **table**. Keep this vocabulary in UI copy — it's half the personality.

---

## 3. Color in practice

- **90% of every screen is ink + chalk.** Green is a **spotlight**, not a wash. If a screen looks green-heavy, it's wrong — pull green back to: primary actions, live/win states, the active nav item, key numbers, the logo.
- **Elevation by shade, not shadow color:** bg `--ink-950` → surface `--ink-900` → card `--ink-800` → raised/hover `--ink-700`. Borders do the separating.
- **Semantic signals only:**
  - Green `--win` = correct call, live, winner, odds up (with ▲).
  - Amber `--warn` = VAR **under review** / hold / locking soon.
  - Red `--danger` = red card, wrong call, odds down (with ▼), destructive.
- **On green, text is dark** (`--on-primary` = ink-950). Never chalk-on-green for small text.
- **The floodlit gradient (one, earned):** a single radial pitch-glow behind the hero/goal moment (`--glow-live`). This is the _only_ gradient in the product. Not on headings, not on cards.

---

## 4. Typography in practice

Three roles, strictly separated (see `/brand.md`):

| Want to show… | Font | Notes |
| --- | --- | --- |
| A hero line, a big moment ("GOAL!", "kick off", section eyebrows) | **Pixelify Sans** | Display-only. 28px+. Letter-spacing 0. Line-height ~1.05. |
| Any number: score `2–1`, odds `1.85`, points `+50`, timer `78:04`, `%`, tx `9Exb…cKaA` | **Departure Mono** | `tabular-nums`. This is the scoreboard + the crypto receipt voice — one font ties "live data" and "verifiable data" together. |
| Everything you actually read: labels, body, buttons, inputs, nav, toasts | **Space Grotesk** | 15–16px body, line-height 1.5. 400/500/700. |

**The single most important craft rule of this aesthetic:** pixel fonts destroy readability at small sizes. If you're ever tempted to set body copy in Pixelify Sans — don't. That one discipline is the line between "premium retro" and "Newgrounds 2004".

Hierarchy budget: max 3 weights per screen, 4–5 sizes. Eyebrow (pixel, small-caps feel) → headline (pixel or bold grotesk) → body (grotesk) → data (mono).

---

## 5. Space, edges, elevation

- **4px pixel grid.** Every margin, pad, gap, and size is a multiple of 4. Non-negotiable — it's what makes pixels feel systematic.
- **Sharp by default.** Cards/buttons `--r-2` (4px) or `--r-0`. Only avatars, chips, the live dot, and the streak flame get `--r-pill`.
- **Borders are structural.** 1px `--border` for quiet separation; **2px `--border-strong`** as the brutalist signature on cards and primary buttons; `--border-active` (green) for the selected/live element.
- **Hard offset shadow** (`--shadow-hard`) is the resting elevation — the "sticker on the wall" arcade feel. Pressing a button collapses it (`--shadow-press` + translate 2px) for tactile feedback. Soft glow is **only** live/goal. Modals are the only place a soft overlay shadow appears.

---

## 6. Motion — "live, not scary" (the choreography)

The failure mode of a live app is anxiety (flashing, jumping). The failure mode of an arcade app is childishness (bounce everywhere). We thread it:

| Moment | Behavior | Timing |
| --- | --- | --- |
| Steady live state | Green **live dot** breathes (opacity pulse 1.6s loop). Nothing else moves. | loop |
| Number changes (score/odds/points) | **Rolling odometer** (digits roll), brief green/red tick on the delta, settle. Never flash the whole element. | `--dur-update` 140ms |
| New prediction card appears | Slide+fade up, slight overshoot spring. Stagger 40ms if several. | `--dur-mount` 380ms |
| Lock (window closing) | Border pulses amber twice, card "stamps" down 2px. | 300ms |
| **Under review (VAR)** | Amber breathing border + a subtle scanline sweep. Points frozen, shown struck-through-pending. | loop until final |
| **Settle — correct** | Green flash → check stamp → points roll up with a small pop. | 300ms + roll |
| **Settle — wrong** | Card desaturates, red hairline, gentle 200ms shake (subtle, once). | 200ms |
| **GOAL** | The one expressive burst: floodlit glow blooms, pixel "GOAL!" stamps in, Oracle speaks, leaderboard reorders with spring. Earn it — only on goals. | `--dur-burst` 720ms |
| Leaderboard reorder | Rows spring to new positions (FLIP), rank delta arrow ticks. | 350ms spring |
| Exit anything | Faster than its entrance. | `--dur-exit` 200ms |

**Rules:** entrance > exit (asymmetric). Springs, not linear. Custom easing (`--ease-arcade`), never `transition: all` or default `ease`. Everything degrades gracefully under `prefers-reduced-motion` (kill bursts + rolling; keep 120ms fades). Implement via **Motion (framer-motion)** using `page-load-animations` recipes.

---

## 7. Signature components (the modular pixel system)

Build these once in `packages/ui`; every screen composes them. Each has states defined.

### 7.1 PixelButton
Sharp (`--r-2`), 2px border, hard offset shadow, Space Grotesk 500/700.
- **Primary:** pitch fill, ink text, `--shadow-hard-pitch`. Hover: brightness up. Press: collapse shadow + translate(2px,2px). Disabled: fog-600, no shadow.
- **Secondary:** transparent fill, chalk 2px border, chalk text. Ghost: no border, chalk-dim text.
- Min height 44px (touch). Loading = inline pixel spinner, label → "…".

### 7.2 Scoreboard (match header)
Workstation-dense island: mono tabular score `2–1`, clock `78:04` ticking, team short-codes (pixel), live dot, pot badge if sponsored. Sits pinned top of the terrace room. Sharp, `--surface-2`, 2px bottom border. Numbers roll on change.

### 7.3 PredictionCard ★ (the star — states are the product)
A ticket-shaped panel (subtle perforation edge nods to a stub). Prompt in Space Grotesk, options as PixelButtons, odds in mono.
- **Open:** chalk border, options tappable, a thin countdown bar draining (amber as it nears lock).
- **Locked:** border amber, options frozen, your pick highlighted, "awaiting result".
- **Under review:** amber breathing border + scanline; badge "VAR — held". _This is the signature interaction — make it feel special._
- **Settled — win:** green border, check stamp, `+50` rolls up, "Verified ✓" tag → opens ProofReceipt.
- **Settled — miss:** desaturated, red hairline, correct answer revealed.

### 7.4 ProofReceipt (the crypto WOW, made legible)
Styled like a **ticket stub / till receipt**: mono type, dashed tear edge, the fixture, the TxLINE proof reference, the Solana tx sig (truncated `9Exb…cKaA`, tap to copy/explorer). One line of plain-English copy: _"Signed by TxLINE, locked on-chain — nobody can fake this."_ The Oracle voices this on settle. Turns a hash into a keepsake.

### 7.5 OracleBubble
The gaffer/announcer presence. A pinned bubble with the persona avatar; when speaking, an animated pixel **waveform** + the line in Space Grotesk; a small speaker toggle. Persona (voice) is a cosmetic. Never blocks the pitch — docks bottom, above the nav.

### 7.6 LeaderboardRow / TheTable
Rank (mono), avatar (pill), handle (grotesk), points (mono, rolling), streak flame if on form. Your row is pinned + green-edged. Reorders with FLIP spring on settle.

### 7.7 Small parts
- **LiveDot** — breathing green pill dot; the universal "this is live" mark.
- **StreakFlame** — pill badge, count in mono, intensity grows with streak; the arcade dopamine.
- **RoomCode chip** — pixel, tap-to-copy, the invite primitive.
- **PointsTag** — `+50` / `–` mono, green/fog, pops on award.
- **Toast** — sharp, 2px border, auto-dismiss 5s, green/amber/red left bar.
- **BottomNav (mobile)** — Predict · Table · Oracle. Sharp, 2px top border, active item green with pixel label.

---

## 8. Page archetypes (layout direction)

Mobile-first, single column, thumb-reachable, bottom nav. Never center-everything — anchor content left, use unequal splits, let the scoreboard be a dense island in an otherwise breathable page.

- **Lobby:** today's fixtures as sharp match-cards (team codes in pixel, kickoff mono, live dot). "Start a terrace" = the one primary button, unmissable. "Join with code" secondary. Header: logo + points + tournament rank.
- **Terrace (live room) ★:** pinned Scoreboard → stack of PredictionCards (the focus) → OracleBubble docked → BottomNav. Dense header, breathing card stack. This is the demo star — every motion rule earns its keep here.
- **The Table (leaderboard):** full-height list, your row pinned, reorder animations, streak flames. Sponsor pot banner up top if present ("leader claims when the whistle's data is verified").
- **Proof detail:** the ProofReceipt full-screen as a keepsake; big "Verified ✓", explorer link, share button.
- **Share card (viral):** 1080×1350 export — pixel headline ("I called the upset"), final table snippet, streak, the proof reference, KICK.FUN wordmark. Designed to look great in a group chat.

---

## 9. Iconography, texture, sound

- **Icons:** pixel/blocky line icons on a consistent grid (or a clean set like Lucide at 2px stroke if pixel icons blow the timeline — keep one family, don't mix). Football motifs (ball, whistle, card, net) drawn as pixel glyphs where it adds joy.
- **Texture — use with a scalpel:** a faint **CRT scanline / floodlight vignette** is allowed on the hero, the goal burst, and the under-review card **only**. Never as a full-page overlay (that's the gimmick trap). One subtle noise/grain layer at ≤3% is fine for warmth.
- **Sound (implemented, tasteful):** all SFX are **synthesized chiptune** (Web Audio oscillators, `packages/ui/src/sound.ts`) — no asset files. Palette: `tap · lock · goal (fanfare) · win (coin) · miss (low buzz) · var (two-tone) · streak (arpeggio) · kickoff (whistle)` + a filtered-noise **crowd ambience** that swells into a roar on goals. Muted by default, one `SoundToggle`, first click unlocks the AudioContext. The Oracle voice (TTS) remains the primary audio identity; SFX are the seasoning under it. Nothing essential is audio-only.

---

## 10. Accessibility (non-negotiable)

- Contrast: body text = chalk on ink (AA+). Green only for large text/UI/numbers/fills; verify any small green text. Amber/red always paired with an icon/glyph.
- Direction never by color alone — odds/score up-down carry ▲▼ or +/−.
- Touch targets ≥ 44px. Focus rings visible (2px pitch outline, offset).
- `prefers-reduced-motion`: drop bursts, rolling, scanlines; keep functional fades.
- Pixel font never below 18px; real content always in Space Grotesk.
- Screen-reader labels on the LiveDot, states, and the Oracle audio (transcript shown).

---

## 11. Anti-slop contract (review gate before any UI ships)

Scan every screen. **Any strong signal = redesign the direction, don't polish.**
- ❌ centered symmetric everything · ❌ uniform radius · ❌ every section a same-shadow card · ❌ violet/blue hero gradient · ❌ glassmorphism · ❌ three-column icon+heading+paragraph grid · ❌ gradient text · ❌ default shadcn gray · ❌ `transition: all` · ❌ pixel font in paragraphs · ❌ pure `#000`.
- ✅ single hero accent with semantic signals · ✅ intentional radius/shadow variation by role · ✅ asymmetry · ✅ mono tabular numbers · ✅ product-specific copy in matchday voice · ✅ hard offset shadows · ✅ rolling-not-flashing live data.

Copy voice: specific, matchday, a little cheeky. _"Call it before the ref does."_ / _"Nobody rigs the table."_ — never _"best-in-class real-time engagement platform."_

---

## 12. Implementation notes

- **Tailwind v4** `@theme` maps to the `/brand.md` tokens (colors, `--font-*`, radius, shadows, spacing). One source of truth.
- **Fonts:** `next/font/google` for Pixelify Sans + Space Grotesk; `next/font/local` for Departure Mono (OFL, self-host). Expose as CSS vars; set `tabular-nums` on the mono utility.
- **shadcn/ui:** use as unstyled primitives, then reskin to Floodlit Arcade (sharp radius, 2px borders, hard shadows) — do **not** ship default shadcn gray.
- **Motion:** Motion (framer-motion) + `page-load-animations` recipes; centralize springs/durations as tokens; wrap live numbers in a `<RollingNumber>` and gate all expressive motion behind `useReducedMotion()`.
- **Components:** live in `packages/ui`; every screen composes §7 parts. Numbers always `<Mono tabular>`; never hand-roll a second button.
- **Ownership:** this doc = direction (design-taste). Mechanical correctness (a11y, forms, states) = `frontend-design-guidelines`. Tokens = `/brand.md`. When they conflict, `/brand.md` wins on values, this doc wins on direction.

---

_Floodlit pitch, pixel roar, receipt you can hold. Fun on top, discipline underneath — that's how a hackathon toy reads as a real product._
