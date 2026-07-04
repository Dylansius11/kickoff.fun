---
name: kick-contract
description: Anchor/Rust development for the kick-settlement program. Use whenever writing, reviewing, testing, or deploying the Solana program in programs/kick-settlement, or reasoning about TxLINE proof verification, CPI into txoracle, PDAs, or settlement logic. Triggers - smart contract, anchor, settle_room, claim_pot, merkle proof, validate_stat, program test, deploy devnet.
---

# kick-contract — Anchor development for KICK.FUN

Spec of record: `docs/technical/SMART-CONTRACT.md`. Design deltas discovered later live HERE and must be back-ported to that doc.

## Program facts

- Path `programs/kick-settlement`, Anchor **1.0.2** (`avm use 1.0.2`), Rust 1.95, Agave CLI 3.1.
- Devnet only for the hackathon. Program keypair in `target/deploy/`, never committed.
- Flow: `init_config` → `init_room` → `fund_pot` (sponsor, one-directional) → `settle_room` (proof-gated) → `claim_pot` (winner) → `close_room`.
- Money: devnet USDC pot, sponsor→winner ONLY. Players never deposit. No peer wagering, ever (PRD rule).
- Points stay off-chain. On-chain = match outcome proof + results_hash anchor + pot custody.

## TxLINE proof system (verified from official docs July 2026)

- TxLINE (txoracle) posts **Merkle roots on-chain**: scores every 5 min, fixtures daily, resolution roots per claim interval.
- Scores-roots PDA seeds: `["daily_scores_roots", epoch_day as u16 le]` with hour/minute (5-min) alignment; `epochDay = floor(unixMs / 86_400_000)`.
- Proof node format: `{ hash: [u8;32], is_right_sibling: bool }`.
- REST returns: `summary {fixtureId, updateStats, eventStatsSubTreeRoot}`, `subTreeProof[]`, `mainTreeProof[]`, plus per-stat `{statToProve, eventStatRoot, statProof[]}`.
- Their `validate_stat` ix verifies a stat predicate `{threshold, comparison: GreaterThan|LessThan|EqualTo}` against roots. Devnet HAS it. Runs ~1.4M CU via `.view()`.
- Their repo `github.com/txodds/tx-on-chain` has IDL + TS types. **Hash algorithm not documented — confirm before enabling in-program Merkle verify.**
- TxLINE program IDs: devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, mainnet `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`.

## Verification rungs (settle_room)

- **Rung A (target): CPI into txoracle `validate_stat`.** Judges' brief explicitly praises this. Risk: 1.4M CU budget; request compute budget ix in the client tx. If CPI depth/CU makes it infeasible, fall to B.
- **Rung B: self-verify Merkle path** in-program against txoracle's roots PDA (read their account, walk `{hash,is_right_sibling}` nodes). Needs the hash algo confirmed (keccak vs sha256) — test against a captured real proof.
- **Rung C (safety net, ship first):** anchor `results_hash` + proof digest on-chain; signature/Merkle checked off-chain by ingest. Never let A/B block the demo.
- Build order: C compiles first, then wire A behind an `enum VerifyMode` on Config so the demo can flip without redeploy.

## Non-negotiable security guards

Signer + `has_one` on every mutating ix · PDA-owned vault (`token::authority = room`) · `pot_claimed` flag before transfer · no re-settle of Settled room · `checked_*` arithmetic · mint equality asserts · proof must bind `fixture_id` + room · attestor/authority rotation admin-only · no `close` while unclaimed pot · deny `Room.winner == None` claims. Anything touching the vault gets a negative test.

## Commands

```bash
avm use 1.0.2
anchor build                        # from repo root (Anchor.toml)
anchor test --skip-local-validator  # if using LiteSVM-style tests
anchor test                         # spins solana-test-validator
anchor deploy --provider.cluster devnet
```
Bash tool: builds/tests/deploys need `dangerouslyDisableSandbox: true`.

## Conventions

- `state.rs` (accounts/enums) · `errors.rs` · `events.rs` · `instructions/` one file per ix · `merkle.rs` isolated so the rung swap touches one module.
- Every ix: doc comment stating WHO signs, WHAT changes, WHY it is safe.
- Emit an event per state transition (indexer + UI receipts).
- Client: export IDL → Codama → `packages/program-client` (@solana/kit). Do not hand-write account layouts in TS.
- After any design change: update `docs/technical/SMART-CONTRACT.md` + add a CLAUDE.md lesson if a wrong assumption was caught.
