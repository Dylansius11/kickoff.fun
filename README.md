<div align="center">
  <img src="public/logo.svg" alt="KICK.FUN logo" width="96" height="96" />

  <h1>KICK.FUN</h1>

  <p><b>Watch the World Cup with friends. Predict live. The results can't be faked.</b></p>

  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#how-it-works">How it works</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#docs">Docs</a>
  </p>

  <img src="public/logo-word.svg" alt="KICK.FUN wordmark" width="220" />
</div>

---

## What is this?

KICK.FUN turns watching a World Cup match into a live social game. Friends join a private room (a "terrace"), predict what happens next using real-time TxLINE data, and an AI pundit (the Oracle) calls the action out loud. Every result settles against cryptographically signed match data anchored on Solana, so nobody, not even us, and not a manipulated data feed, can rig who won.

Built solo for the TxODDS World Cup Hackathon, Consumer and Fan Experiences track.

**Why "can't be faked" matters right now:** in July 2026, prediction markets settled real money on manipulated Spotify chart data. TxLINE data is signed at the source and its Merkle roots live on Solana. KICK.FUN makes that guarantee a consumer feature: every settled prediction ships a tappable receipt.

## The experience

- **The Terrace.** Live room per match: score header, auto-generated prediction cards, friends' picks, live leaderboard.
- **The Oracle.** A voice pundit that reacts to goals, cards, and odds swings, and speaks the on-chain verification out loud.
- **VAR-safe settlement.** Results hold in an amber "under review" state until final, then settle with a proof receipt.
- **Points, streaks, glory.** Free to play, points are never cashable. Sponsors fund prize pots; the winner claims on-chain.
- **Floodlit Arcade.** Pixel display type, hard shadows, chiptune SFX synthesized in code, and a crowd that roars when you score.

## Quick start

```bash
pnpm install
cp .env.example .env        # fill in RPC + TxLINE values
pnpm --filter @kick/web dev # web app on http://localhost:3000
```

Solana program (Anchor 1.0, devnet):

```bash
anchor build
cargo test -p kick-settlement --lib
```

## How it works

```
TxLINE (signed scores, odds, proofs; Merkle roots posted on Solana)
   │ SSE + REST
   ▼
Ingest worker ── diff engine ── prop cards ── finality gate (VAR-safe)
   │                                   │
   ▼                                   ▼
Supabase Realtime ──► the Terrace UI   kick-settlement (Anchor, devnet)
   │                                   • verify TxLINE proof (3 modes,
   ▼                                     incl. CPI into validate_stat)
Oracle (templates + TTS) 🔊            • anchor results hash
                                       • sponsor pot: fund → settle → claim
```

- Players never deposit anything. Money flows one way only: sponsor to winner, gated by verified data.
- Proof verification has three admin-switchable modes, from hash anchoring to a CPI into TxLINE's own on-chain validator.
- The whole demo runs on TxLINE replay, so it works even when no match is live.

## Monorepo layout

| Path | What lives there |
| --- | --- |
| `apps/web` | Next.js 16 PWA, the fan-facing product |
| `apps/ingest` | Node worker: TxLINE SSE to props, results, Oracle triggers |
| `programs/kick-settlement` | Anchor program: proof verify, results anchor, pot custody |
| `packages/ui` | Floodlit Arcade component system + synthesized sound engine |
| `packages/shared` | Domain types, snapshot diff engine, finality gate (pure, tested) |
| `packages/txline-client` | Typed TxLINE REST + SSE client |
| `docs/` | PRD, architecture, smart contract spec, integrations, ERD, design guide |

## Docs

- Product: [docs/PRD.md](docs/PRD.md)
- Architecture: [docs/technical/ARCHITECTURE.md](docs/technical/ARCHITECTURE.md)
- Smart contract: [docs/technical/SMART-CONTRACT.md](docs/technical/SMART-CONTRACT.md)
- Integrations (TxLINE, Privy, Helius): [docs/technical/INTEGRATIONS.md](docs/technical/INTEGRATIONS.md)
- Data model: [docs/technical/ERD.md](docs/technical/ERD.md)
- Design language: [docs/design/DESIGN_GUIDE.md](docs/design/DESIGN_GUIDE.md)

## Status

- Anchor program deployed to devnet and configured (see explorer: program `6dcNE27gXWVbnuVuGRgZVoRswKEJny1CemJtb8jxHhX2`)
- TxLINE on-chain subscription active, real World Cup fixtures flowing
- Component system + sound engine live
- In progress: ingest worker, Oracle voice, rooms and leaderboard persistence

---

<div align="center">
  <sub>Floodlit pitch, pixel roar, receipt you can hold.</sub>
</div>
