# KICK.FUN — brand.md

_Machine-readable source of truth for tokens. `frontend-design-guidelines` + `design-taste` read this. Full rationale + component specs live in `docs/design/DESIGN_GUIDE.md`._

**Aesthetic direction:** **Floodlit Arcade** — stadium-at-night × retro pixel arcade. Dark-only (MVP). Single hero accent (pitch green) + semantic-only signals. Hard edges, thick borders, hard offset shadows, 4px pixel grid.

---

## Fonts (3 roles — never blur them)

| Role | Family | Use for | Source |
| --- | --- | --- | --- |
| **Display** | **Pixelify Sans** (400–700) | Logo-adjacent headers, hero lines, big moments, section eyebrows | `next/font/google` |
| **Mono / Scoreboard** | **Departure Mono** | ALL numbers: scores, odds, points, timers, %, hashes, tx sigs, proof receipts | `next/font/local` (OFL) |
| **Body / UI** | **Space Grotesk** (400–700) | Everything readable: paragraphs, labels, buttons, inputs, nav | `next/font/google` |

**Hard rule:** Pixelify Sans is **display-only**. Body text ≥ 18px caps at most. Real reading text is always Space Grotesk. All numerics are Departure Mono with `font-variant-numeric: tabular-nums`.

```
--font-display: "Pixelify Sans", ui-monospace, monospace;
--font-mono:    "Departure Mono", ui-monospace, monospace;
--font-sans:    "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
```

---

## Color tokens (dark-only, OKLCH-safe hexes)

### Tier 1 — brand ramps

```
/* Pitch — hero green (floodlit grass). Single accent. */
--pitch-50:  #E7FCEF;
--pitch-100: #C6F7D8;
--pitch-200: #92EEB4;
--pitch-300: #5FE291;
--pitch-400: #38D673;   /* glow / highlight */
--pitch-500: #22C55E;   /* PRIMARY */
--pitch-600: #16A34A;   /* press */
--pitch-700: #108239;
--pitch-800: #0C602B;
--pitch-900: #0A3D1E;

/* Ink — green-tinted near-black (never #000). Elevation by shade. */
--ink-950: #080B09;     /* app background (deepest) */
--ink-900: #0C110E;     /* base surface */
--ink-800: #141C17;     /* card surface */
--ink-700: #1B2620;     /* raised / hover */
--ink-600: #26332B;     /* hairline borders */
--ink-500: #37483D;     /* muted separators */

/* Fog — neutral text ramp (cool-green gray) */
--chalk:     #F1F5F0;   /* primary text / pitch-line white */
--fog-400:   #A7B3AC;   /* secondary text */
--fog-500:   #7C8A81;   /* muted / captions */
--fog-600:   #566159;   /* disabled */
```

### Signals (semantic-only — never decorative)

```
--win:    var(--pitch-500);   /* correct pick, up, live, winner */
--warn:   #F5A524;            /* VAR "under review" / hold / lock warning */
--danger: #F4433B;            /* red card, wrong pick, down, loss, destructive */
```

Rule: green/amber/red carry **meaning**. Direction (odds/score up-down) is **always** paired with an arrow or +/- glyph — never color alone (color-blind safe).

### Tier 2 — semantic

```
--bg:            var(--ink-950);
--surface:       var(--ink-900);
--surface-2:     var(--ink-800);
--raised:        var(--ink-700);
--border:        rgba(241,245,240,0.10);   /* subtle */
--border-strong: rgba(241,245,240,0.16);   /* brutalist 2px */
--border-active: var(--pitch-500);
--text:          var(--chalk);
--text-dim:      var(--fog-400);
--text-muted:    var(--fog-500);
--text-disabled: var(--fog-600);
--primary:       var(--pitch-500);
--primary-press: var(--pitch-600);
--glow:          var(--pitch-400);
--on-primary:    var(--ink-950);           /* text on green = dark, for contrast */
```

**Contrast:** body text = `--text` (chalk) on ink — passes AA. Green is for large text, numbers, UI, and fills — not for small body copy. Verify any green-on-dark small text with a checker before shipping.

---

## Radius (sharp is the signature)

```
--r-0:   0px;      /* structural surfaces, scoreboard — default */
--r-1:   2px;      /* subtle softening */
--r-2:   4px;      /* buttons, cards (arcade default) */
--r-pill: 999px;   /* chips, avatars, live dot, streak flame */
```

Vary radius by **role**, never uniform. Structural = sharp (0–4px). Only round the human/organic bits (avatars, pills, dots).

---

## Elevation — hard offset shadows (arcade sticker), not soft blur

```
--shadow-hard:       4px 4px 0 0 var(--ink-950);      /* card / button resting */
--shadow-hard-pitch: 4px 4px 0 0 var(--pitch-700);    /* active / primary */
--shadow-press:      2px 2px 0 0 var(--ink-950);      /* pressed (translate 2px) */
--glow-live:         0 0 24px rgba(34,197,94,0.35);   /* live/hero moments ONLY */
--shadow-overlay:    0 12px 40px rgba(0,0,0,0.55);    /* modals only, ≤12% */
```

Default is the **hard offset** shadow. Soft glow is reserved for "live" pulses and the goal moment. No soft drop shadows scattered on every card.

---

## Spacing — 4px "pixel grid"

```
--s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
--s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;
```

Everything snaps to 4px. This is what makes the pixel aesthetic read as a *system*, not a gimmick.

---

## Type scale (px)

`12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 64`. Body = 15–16 (Space Grotesk, line-height 1.5). Display = 28+ (Pixelify Sans, line-height 1.0–1.1, letter-spacing 0). Mono data aligns tabular.

---

## Motion tokens

```
--ease-arcade: cubic-bezier(0.2, 0.8, 0.2, 1);   /* snappy out */
--ease-in-fast: cubic-bezier(0.4, 0, 1, 1);
--dur-update: 140ms;   /* subsequent data updates (subtle) */
--dur-mount:  380ms;   /* first appearance (expressive) */
--dur-exit:   200ms;   /* always shorter than enter */
--dur-burst:  720ms;   /* goal celebration */
```

Spring (framer/Motion) defaults: taps `stiffness 400 / damping 30`; entrances `stiffness 260 / damping 26`. Respect `prefers-reduced-motion` — drop bursts + rolling, keep functional fades.

---

## Do / Don't (enforced)

**Do:** single hero accent (pitch) + grayscale; semantic-only amber/red; hard edges + 2px borders + hard offset shadows; tabular mono numbers; rolling counters for live values; expressive only on goals; dark-only.

**Don't:** violet/blue gradients; glassmorphism; uniform border-radius; soft default shadows everywhere; `transition: all`; pixel font at body size; center-everything symmetry; three-column icon-heading-paragraph grids; gradient text; pure `#000`.

_Tokens live here; the "why" and component/motion specs live in `docs/design/DESIGN_GUIDE.md`._
