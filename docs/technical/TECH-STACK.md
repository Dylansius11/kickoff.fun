# KICK.FUN — Tech Stack

_Exact, versioned, and verified against real sources (July 2026). Every choice optimizes for one thing: a solo founder shipping one flawless, beautiful, on-chain live loop in ~15 days — then demoing it._

Companion docs: `ARCHITECTURE.md` (how the pieces fit), `SMART-CONTRACT.md` (the program), `INTEGRATIONS.md` (external APIs), `ERD.md` (data model).

---

## 0. Selection principles

1. **Newest stable, not bleeding edge.** Latest _stable_ majors (Next 16, Anchor 1.0) — no previews on a deadline.
2. **Boring where it doesn't differentiate, sharp where it does.** Standard web stack; spend the innovation budget on the Oracle + proof settlement.
3. **Typed end-to-end.** One schema source (zod) shared across web, ingest worker, and program client. Match logic is unit-testable without the chain.
4. **Managed over self-hosted.** Solo founder: Vercel, Supabase, Helius, Privy do the ops.
5. **Every dependency must survive the demo.** If it can flake live on stage, it needs a deterministic fallback.

---

## 1. The stack at a glance

| Layer | Choice | Version (Jul 2026) | Why |
| --- | --- | --- | --- |
| Language | TypeScript | 5.7+ | Shared types across all deployables |
| Monorepo | pnpm + Turborepo | pnpm 9 / turbo 2 | One repo, cached builds, shared packages |
| Web framework | **Next.js (App Router)** | **16.2.x** | Stable since Oct 2025; Turbopack default; React 19.2; React Compiler stable (auto-memoization) |
| UI runtime | React | 19.2 | Ships with Next 16 |
| Styling | Tailwind CSS + shadcn/ui | Tailwind 4 / shadcn latest | Fast, ownable components; matches `frontend-design-guidelines` |
| Animation | **Motion** (framer-motion) | 12.x | Match-reactive motion; matches `page-load-animations` recipes |
| Client state / data | TanStack Query + Zustand | v5 / v5 | Server cache + light global state (room, live feed) |
| Realtime fan-out | **Supabase Realtime** | cloud | Push props/scores/leaderboard to all room clients over WebSocket |
| Database | **Supabase Postgres** | cloud (PG 16) | Rooms, players, predictions, points, cosmetics (see `ERD.md`) |
| Auth + wallets | **Privy** | latest | Email→embedded Solana wallet for mainstream fans; wallet-adapter for power users |
| Schemas/validation | **Zod** | 3.x | Single source of truth for TxLINE payloads + domain types |
| Ingest worker | Node.js | 22 LTS | Long-lived SSE consumer; Next 16 requires Node ≥20 anyway |
| TTS (the Oracle) | **ElevenLabs Flash** (primary) + Web Speech API (free fallback) | latest | Low-latency voice; browser `speechSynthesis` = $0 demo fallback |
| Solana client | **@solana/kit** (formerly web3.js 2.0) | 2.x | Tree-shakeable, ~200ms faster confirms, modern API |
| Program client | **Codama**-generated client | latest | Anchor 1.0 IDL → typed `@solana/kit` client (Anchor lacks native kit support) |
| On-chain framework | **Anchor** | **1.0.2** | Current stable major; security-focused macros; AVM-managed |
| Solana toolchain | Agave (Solana CLI) + Rust | latest stable / Rust 1.8x | Program build/deploy on devnet |
| RPC + streaming | **Helius** (devnet) | cloud | Reliable devnet RPC, tx submission, optional webhooks for anchor confirmations |
| Hosting — web | **Vercel** | cloud | First-class Next 16; preview deploys |
| Hosting — ingest | **Railway** (or Fly.io) | cloud | Always-on Node worker (Vercel functions are too short-lived for SSE) |
| Package: TxLINE token | SPL Token-2022 aware | — | TxLINE `subscribe` uses TOKEN_2022_PROGRAM_ID; we only read (see `INTEGRATIONS.md`) |
| Sponsor pot asset | Devnet USDC (SPL) | — | Pot funding + winner claim; devnet only |

---

## 2. Why these specific picks (the decisions that matter)

### 2.1 @solana/kit + Codama — NOT Anchor's bundled TS client
Anchor 1.0 **does not support `@solana/web3.js` v2 / kit out of the box.** The clean 2026 path: write the program in Anchor, export its IDL, and generate a typed **`@solana/kit`** client with **Codama**. This gives the modern, tree-shakeable client (smaller PWA bundle, faster confirms) without waiting on Anchor's kit support. Confirmed via Anza/QuickNode guidance.
- _Trade-off:_ one extra codegen step. Worth it for bundle size on a mobile-first PWA.
- _Fallback:_ if Codama codegen fights the deadline, use `@coral-xyz/anchor`'s legacy client with web3.js v1 for the frontend calls — isolated to `packages/program-client`, so swapping it touches one package.

### 2.2 Next.js 16, App Router, PWA
Stable major, Turbopack builds by default, React Compiler auto-memoizes (fewer re-render bugs in a live-updating UI — which is exactly our failure mode). PWA (installable, mobile-first) matches "fans watch with a phone in hand." No React Native — one codebase, faster.

### 2.3 Privy for onboarding
The single most important "fan accessibility" pick. Email → embedded Solana wallet, self-custodial, no seed phrases. A mainstream fan signs in like any app; the wallet exists invisibly for the on-chain proof/pot. Stripe-owned, 100M+ accounts = safe bet. Wallet-adapter remains available for crypto-native users.
- _Note:_ Privy's depth is EVM-first; validate the Solana embedded-wallet signing flow on Day 1 (`INTEGRATIONS.md` Q). Fallback = Solana wallet-adapter only (slightly worse onboarding, zero risk).

### 2.4 Supabase for DB + Realtime (not a custom socket server)
Solo founder cannot also run WebSocket infra. Supabase gives Postgres + Realtime + Row-Level Security in one. The ingest worker writes normalized events; every room client subscribes to Realtime channels. `supabase` + `supabase-postgres-best-practices` skills cover it.

### 2.5 Separate always-on ingest worker (Railway), not a Vercel function
TxLINE is an **SSE stream** — a long-lived connection. Serverless functions time out. The ingest worker is a persistent Node process on Railway/Fly that holds the upstream SSE connection, diffs snapshots into events, runs prop/finality logic, fires Oracle triggers, and writes to Supabase. Web stays on Vercel.

### 2.6 The Oracle's TTS: ElevenLabs primary, browser fallback
ElevenLabs Flash = low-latency, characterful voices (the "angry Scottish gaffer"). But it's a paid API that could rate-limit mid-demo. So the Oracle's TTS layer is **provider-agnostic** (`packages/oracle`): ship with browser `speechSynthesis` (free, offline, zero-risk) working first, then swap ElevenLabs for quality. The demo can never be blocked by a TTS outage.

### 2.7 Anchor 1.0.2
The current stable major (Anchor reached 1.0, now maintained under `solana-foundation/anchor`, AVM-managed). Its account macros and constraints are the fastest safe way for a Rust-capable solo dev to ship the settlement program. See `SMART-CONTRACT.md`.

---

## 3. What we deliberately did NOT choose

| Rejected | Why |
| --- | --- |
| React Native / mobile native | One codebase wins on time; PWA covers "phone in hand." |
| Custom WebSocket server | Supabase Realtime removes an entire ops surface. |
| web3.js v1 as the primary client | Kit is faster + smaller; v1 only as an isolated fallback in one package. |
| Next.js 16.3 preview / canaries | No previews on a hard deadline. |
| A points token (SPL) | Regulatory + slop risk; points stay off-chain + non-cashable (see PRD §7.6). |
| Peer-to-peer escrow | Gambling optics + custody; only a one-directional sponsor→winner claim (see `SMART-CONTRACT.md`). |
| LLM-generated Oracle lines (for MVP) | Non-deterministic + latency + cost; templated first, LLM as stretch. |
| Self-hosted RPC | Helius devnet is free-tier sufficient and reliable. |

---

## 4. Environments & config

- **Network:** Solana **devnet** only for the hackathon. TxLINE devnet endpoint `https://txline-dev.txodds.com`, program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`.
- **Secrets** (`.env`, never committed): TxLINE service keypair + API token, Privy app id/secret, Supabase URL + service/anon keys, Helius RPC URL, ElevenLabs key, sponsor/service wallet keypair path.
- **Key management:** one **service keypair** holds the TxLINE subscription and submits anchor/settlement txs (users never pay gas). Sponsor pot funded from a demo sponsor keypair.
- **CI:** Turborepo pipeline — typecheck, `anchor test` (localnet), web build. GitHub Actions.

---

## 5. Version pin summary (copy into README on Day 1)

```
node            22.x
pnpm            9.x
next            16.2.x
react           19.2.x
typescript      5.7.x
@solana/kit     2.x
codama          latest
anchor          1.0.2      (avm use 1.0.2)
solana (agave)  latest stable
tailwindcss     4.x
motion          12.x
@tanstack/react-query  5.x
zod             3.x
@privy-io/react-auth   latest
@supabase/supabase-js  2.x
```

> Verify each pin on Day 1 with `npm view <pkg> version` before locking — this file records the intent; the lockfile records the truth.

---

_Sources: Anza (Solana Kit / web3.js 2.0 release), QuickNode (Codama program clients), Anchor releases (1.0.2), Next.js 16 docs, Privy docs, Helius embedded-wallet + web3.js-2 guides — see `INTEGRATIONS.md` for links._
