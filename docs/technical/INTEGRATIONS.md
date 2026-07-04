# KICK.FUN — Integrations

_Every external system we touch: auth flows, endpoints, failure handling. TxLINE is the primary data source; everything else is supporting cast._

Companion docs: `ARCHITECTURE.md`, `TECH-STACK.md`, `SMART-CONTRACT.md`, `ERD.md`.

> **Accuracy note:** endpoint _paths_ marked ⚠️ are inferred from TxLINE's quickstart and must be confirmed Day 1 in the TxLINE Telegram before coding against them. Auth flow, service levels, and network config are confirmed from docs.

---

## 1. TxLINE (TxODDS) — primary data layer ★

Base (devnet): `https://txline-dev.txodds.com` · program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
Base (mainnet): `https://txline.txodds.com` · program `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`
Docs: quickstart `txline.txodds.com/documentation/quickstart` · World Cup `…/documentation/worldcup`

### 1.1 Access model (confirmed)
- **Free World Cup access through July 19, 2026.** All commercial fees waived for the hackathon.
- **Service levels:** **SL1 = 60-second delay**, **SL12 = real-time**. We **settle off SL1** on purpose (PRD §5 — fairness margin + VAR safety); may display SL12 for liveliness if allowed.
- **No rate limits** on the free tier.
- **Modules:** _StablePrice Snapshots_ (odds: full/half-time, over/unders, Asian handicaps) + _Tx Scores_ (live state + scoring events).

### 1.2 Auth flow (confirmed shape)
```
1. POST /auth/guest/start                 → guest JWT
2. (on-chain) `subscribe` instruction      → service level + duration [+ leagues], TOKEN_2022 to treasury
                                             (free tier: no TxL payment). Signed by our SERVICE keypair.
3. POST /api/token/activate                → sign {subscribeTxSig + leagueIds + jwt} → API token
4. Data calls:  Authorization: Bearer {jwt}
                X-Api-Token: {apiToken}
```
Key point: **one service keypair** holds the subscription for the whole app. Individual fans never subscribe, never pay gas (PRD §15 Q6). Store the JWT + API token in the ingest worker's env; refresh per TxLINE's token lifetime.

### 1.3 Endpoints we use
| Purpose | Endpoint (⚠️ confirm path) | Mode | Consumer |
| --- | --- | --- | --- |
| Match schedule, teams, kickoff, round | `GET /fixtures` ⚠️ | REST | Lobby, room creation |
| Odds snapshot | `GET /odds/snapshot` ⚠️ | REST | Initial prop pricing |
| **Odds stream** | `GET /odds/stream` ⚠️ | **SSE** | Prop moves + Oracle "odds swing" |
| Scores snapshot | `GET /scores/snapshot` ⚠️ | REST | Room load / resync |
| **Scores stream** | `GET /scores/stream` ⚠️ | **SSE** | The match pulse: goals, cards, clock |
| **Validation proof** | `GET /proofs/{fixture|odds|score}` ⚠️ | REST | On-chain settlement (SMART-CONTRACT §5) |

### 1.4 SSE consumption pattern
- Ingest worker opens **one SSE connection per active match** (Scores + Odds), holds it (Railway/Fly — not serverless).
- If the stream is **snapshot-based** (Q3), **diff consecutive snapshots** to derive discrete events (goal = score delta; card = card-count delta; odds swing = price delta over threshold).
- Auto-reconnect with backoff; on reconnect, pull a `snapshot` to resync before resuming the diff.
- Fan out to room clients via **Supabase Realtime** — never expose TxLINE tokens to the browser.

### 1.5 Proofs → settlement
Fetch the validation proof for the **final** result (after the finality gate), pass to `settle_room` (SMART-CONTRACT §4.4). **Capture 2–3 real proofs on Day 2** and commit as test vectors so program tests + the demo don't depend on the live API.

### 1.6 Open questions (resolve Day 1–2 — mirror of PRD §15.1)
Q1 proof format (Merkle vs ed25519) · Q2 does Fixtures return full 104-match schedule · Q3 SSE push vs snapshot-diff · Q4 on-demand replay of a finished match · Q5 concurrent-SSE limits · Q6 devnet subscribe cost. Ask all six in the TxLINE Telegram immediately; each has a default assumption in PRD §15.1 so we're never blocked.

### 1.7 Feedback capture (worth submission points)
The brief rewards API feedback. Keep a running `FEEDBACK.md` while building (what was smooth, where paths/schema surprised us). Turn it into the submission's feedback note.

---

## 2. Privy — auth + embedded wallets

Purpose: mainstream fans sign in with **email → self-custodial Solana wallet**, no seed phrase (PRD §7.1, "Fan Accessibility").

- SDK: `@privy-io/react-auth` (+ Solana connectors) in `apps/web`.
- Flow: email/social login → Privy provisions an embedded Solana wallet → app reads the pubkey as the player identity → wallet signs the optional `claim_pot` tx.
- Power-user path: standard Solana **wallet-adapter** for fans who already have Phantom/Backpack.
- ⚠️ **Day-1 validation:** confirm Privy's Solana embedded-wallet **signing** works for our `claim_pot` transaction (Privy is EVM-deeper). Fallback: wallet-adapter only — isolated to the auth module, no ripple.
- Users never pay gas for gameplay; only the optional pot claim requires their signature (fee can be sponsored via a fee-payer service key if needed).

---

## 3. ElevenLabs — the Oracle's voice (with free fallback)

- Primary: **ElevenLabs Flash** (low-latency TTS) for characterful personas (hype announcer, Scottish gaffer).
- Integration: worker resolves an event → template line → request audio; the client plays the returned audio ref (PRD §7.0, ARCHITECTURE §6).
- **Provider-agnostic** in `packages/oracle`: an interface with two impls — ElevenLabs and browser **`speechSynthesis`** (free, offline). Ship the browser impl working first; the demo can never be blocked by a TTS outage or rate limit.
- Cost control: cache audio for repeated templated lines (same line + same voice = reuse).

---

## 4. Helius — Solana RPC (devnet)

- Devnet RPC for the ingest worker (submit `settle_room`/anchor txs) and the web client (read program state, submit `claim_pot`).
- Optional: Helius **webhook** to confirm anchor/settlement txs and update the UI receipt without polling.
- Fallback: public devnet RPC (`api.devnet.solana.com`) if Helius limits — swap the URL in env.

---

## 5. Supabase — DB + Realtime (see ERD.md)

- **Postgres** stores rooms, players, predictions, points, cosmetics.
- **Realtime** channels (per room) push prop/score/leaderboard/Oracle updates to all clients.
- **RLS** on all tables; the worker uses the service role, clients use anon + row policies.
- Details, schema, and policies live in `ERD.md`. Best practices: `supabase` + `supabase-postgres-best-practices` skills.

---

## 6. Integration risk register

| Integration | Risk | Mitigation |
| --- | --- | --- |
| TxLINE | Proof format unknown | Fallback ladder (SMART-CONTRACT §5); ask Q1 Day 1 |
| TxLINE | Stream is snapshot not push | Snapshot-diff engine in `packages/shared` |
| TxLINE | Stream drops live | Auto-reconnect + resync snapshot; **replay mode** for demo |
| TxLINE | Token expiry mid-stream | Refresh JWT/API token on the worker; re-activate |
| Privy | Solana signing quirk | Wallet-adapter fallback |
| ElevenLabs | Rate-limit/outage | Browser `speechSynthesis` fallback |
| Helius | Devnet RPC limits | Public devnet RPC fallback |
| Supabase | Realtime lag | Client polls snapshot endpoint as a floor |

---

## 7. Source references (verified July 2026)

- Solana Kit / web3.js 2.0 — Anza release blog; Triton "intro to Solana Kit"; Helius "building with web3.js 2.0"
- Codama program clients — QuickNode guide
- Anchor 1.0.2 — `solana-foundation/anchor` releases + anchor-lang.com docs
- Next.js 16 — nextjs.org/blog/next-16 + upgrade guide
- Privy Solana — docs.privy.io (Solana getting-started, embedded wallet creation)
- Helius — helius.dev embedded-wallets + web3.js-2 guides
- TxLINE — txline.txodds.com quickstart + worldcup docs

---

_TxLINE is the one integration we cannot fake — confirm its six unknowns first, capture real proofs early, and everything downstream (program, demo) rests on solid ground._
