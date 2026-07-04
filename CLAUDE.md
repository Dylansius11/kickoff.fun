# CLAUDE.md — KICK.FUN

Operating manual for any AI agent working in this repo. Read it first, every session. It overrides defaults.

---

## What this is

**KICK.FUN** — a live social prediction game for the FIFA World Cup 2026, built for the TxODDS x Solana hackathon (Consumer & Fan Experiences track, $16K). Friends join a "terrace" (room), predict live off signed TxLINE data, an AI pundit (the "Oracle") calls the action, results settle against cryptographically signed data anchored on Solana. Deadline: **July 19, 2026**.

Full context lives in docs. Read before building in that area:
- `docs/PRD.md` — product, scope, money model, screen specs (the frozen contract)
- `docs/technical/ARCHITECTURE.md` · `TECH-STACK.md` · `SMART-CONTRACT.md` · `INTEGRATIONS.md` · `ERD.md`
- `docs/design/DESIGN_GUIDE.md` + `brand.md` — the "Floodlit Arcade" design system

---

## Golden rules (non-negotiable)

1. **NO em-dashes in user-facing UI. Zero. Ever.** Any string a user reads on screen (labels, copy, buttons, toasts, Oracle lines, share cards) must contain no em-dash (`—`). Use a comma, period, colon, or middot (`·`) instead. En-dash (`–`) is allowed **only** for score/number ranges like `2–1`. This rule is for shipped UI text; internal docs and code comments may use em-dashes.
2. **No mediocrity. Ever.** The user hates generic, safe, "AI-slop" output. Every screen, component, and copy line must be distinctive and considered. Before calling any UI done, run the anti-slop gate in `DESIGN_GUIDE.md §11` and the convergence test ("if someone said AI made this, would they believe it instantly?" must be **no**). If it feels average, it is not done.
3. **Obey the design system.** `brand.md` is the source of truth for tokens; `DESIGN_GUIDE.md` for direction. No stray colors, no soft default shadows, no uniform radii, pixel font never at body size, dark-only.
4. **Protect scope.** The PRD is frozen. New ideas go to `PRD.md §14` (parking lot), not into the build. One flawless core loop beats a sprawling half-built platform.
5. **Demo-first.** Judging is ~60% the demo video and matches end before review. Every feature must be demoable via TxLINE replay. If it cannot be shown in the 5-minute video, question whether to build it now.
6. **No emojis in product UI.** Use pixel glyphs or Lucide icons, not emoji, in the interface. (Emoji are fine in this doc and in chat.)

---

## Conventions

- **Stack:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4 + Motion (framer-motion). Anchor 1.0 + @solana/kit + Codama. Supabase (Postgres + Realtime). Privy auth. See `TECH-STACK.md`.
- **Monorepo:** pnpm + Turborepo. `apps/web`, `apps/ingest`, `programs/kick-settlement`, `packages/{ui,shared,txline-client,program-client,oracle}`.
- **Design tokens:** defined once in `apps/web/src/app/globals.css` (`@theme`), mirroring `brand.md`. Never hardcode a hex in a component; use a token utility (`bg-pitch`, `text-win`, `shadow-hard`, etc.).
- **Components:** shared UI lives in `packages/ui`. Never hand-roll a second Button. Numbers always render in the mono font with `tabular` (see `number-formatting`).
- **Commands:** `pnpm dev` (all), `pnpm --filter @kick/web dev`, `pnpm --filter @kick/web build`, `pnpm build`, `pnpm typecheck`.
- **Sandbox:** installs, builds, and the dev server need `dangerouslyDisableSandbox: true` in Bash (the sandbox blocks the pnpm global store and network). Plain file edits and reads do not.
- **Commits:** conventional commits. Only commit when asked. Never commit `.env` or keypairs.

---

## Self-Learning / Lessons Log

Append here the moment a mistake is caught or a preference is stated, so it is never repeated. Format: `- [YYYY-MM-DD] Observation. → Rule going forward.` Newest at top. Both the user and any agent may add entries. Re-read this list before starting work.

- [2026-07-04] VolumeControl v1 expanded on hover only (dead on touch) and animated its width mid-drag (janky). → Primary controls never hide behind hover; touch-first, pointer capture, no layout animation under an active pointer.
- [2026-07-04] ShareCard v1 hard-locked `aspect-ratio: 4/5` and content overflowed/clipped ("bertabrakan"). → Never fix an aspect ratio on a text-bearing card; let content set height.
- [2026-07-04] User: the share platform is X. → Share actions open `https://x.com/intent/post?text=` composer, X glyph on the button, not generic navigator.share.
- [2026-07-04] Helius free tier appears to reject `getProgramAccounts`-style calls on devnet ("error sending request") while getBalance/sendTransaction work. → For `solana program show --buffers` / GPA queries use `-u devnet` (public RPC); use Helius for tx submission.
- [2026-07-04] Sound: KICK.FUN SFX are SYNTHESIZED in code (Web Audio oscillators, packages/ui/src/sound.ts) — no audio asset files, no licensing. Muted by default; first toggle click unlocks AudioContext. → Never add mp3/wav assets for UI SFX without a reason; extend SCORES table instead.
- [2026-07-04] Assumed TxLINE had no `validate_stat` ix; official docs + `txodds/tx-on-chain` repo proved it EXISTS on devnet, Merkle-based, roots posted on-chain every 5 min. → Never assert an external API lacks a feature without reading its llms.txt/docs index and repos first; PRD §5 and SMART-CONTRACT §5 now carry the verified facts.
- [2026-07-04] Anchor 1.x breaking changes bit us: `CpiContext::new(program_id: Pubkey, ...)` (not AccountInfo) and no `anchor_lang::solana_program::{hash,keccak}` re-export (use `solana-sha256-hasher`/`solana-keccak-hasher` crates, host builds need `sha2`/`sha3` features). → Check the installed crate source in `~/.cargo/registry` when Anchor APIs mismatch training data.
- [2026-07-04] Custom `.claude/agents/*.md` files are not picked up mid-session (registry loads at start). → After creating an agent file, either restart the session or inline its prompt into a general-purpose agent call.
- [2026-07-04] User: UI shown to users must have zero em-dashes. → Never emit `—` in any user-facing string; use `,` `.` `:` or `·`. En-dash only for scores like `2–1`.
- [2026-07-04] User: remove emojis from the Simulate/VAR buttons; dislikes emoji in the interface. → No emojis in product UI; use Lucide icons or pixel glyphs.
- [2026-07-04] User hates mediocrity and generic output. → Hold every deliverable to the anti-slop bar; distinctive and considered, never the safe middle.
- [2026-07-04] Next.js 16 diverges from training data (Turbopack default, new conventions). → Mirror the create-next-app template patterns; when unsure, read `node_modules/next/dist/docs/` before writing.
- [2026-07-04] create-next-app and pnpm installs failed under the Bash sandbox ("path not writable"). → Run scaffolders/installers/dev server with `dangerouslyDisableSandbox: true`.
- [2026-07-04] `next/font` CSS variable names must differ from the Tailwind `@theme` utility names, or you get a `var()` self-reference. → Name font vars `--font-pixelify/grotesk/jetbrains`, map them to `--font-display/sans/mono` in `@theme`.
- [2026-07-04] User's `public/logo-word.svg` is black text on transparent (invisible on the dark floodlit background). → Need a chalk/light wordmark variant; until then render "KICK.FUN" in the Pixelify font next to the ball mark.
- [2026-07-04] pnpm 11 rewrites `pnpm-workspace.yaml` with an `allowBuilds` placeholder after install. → Resolve placeholders to explicit `true`/`false` so the file stays valid.
- [2026-07-04] Mono font is interim (JetBrains Mono). → Target is self-hosted **Departure Mono** (pixel-mono, OFL); swap when the font file is added.

---

## Open threads (living)

- TxLINE proof format unconfirmed (Merkle vs ed25519) → gates the Anchor design. See `INTEGRATIONS.md §1.6`.
- Anchor program (`programs/kick-settlement`) intentionally deferred by user.
- Departure Mono font file not yet added.
- Chalk wordmark asset not yet produced.
