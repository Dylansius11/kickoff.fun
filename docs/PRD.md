# Terrace — Product Requirements Document

_The provably-fair social layer for watching the World Cup with friends._

**Version:** 1.0 — hackathon build
**Author:** Solo founder
**Target:** TxODDS World Cup Hackathon (Consumer & Fan Experiences track, $16K)
**Submission deadline:** July 19, 2026, 23:59 UTC
**Platform:** Mobile-first responsive web app (PWA) on Solana devnet

---

## 1. One-line summary

Terrace turns watching a World Cup match into a live social game: friends join a private room, predict what happens next using real-time TxLINE data, and every result is settled automatically against cryptographic proof anchored on Solana — so the leaderboard is provably fair and nobody, not even the host, can cheat.

---

## 2. The problem (and why now)

Most fans watch the World Cup with a phone in their hand, but the second-screen experience is fragmented and dull. The two things fans actually do — predicting outcomes and competing with friends — are served badly:

- **Prediction markets (Polymarket, Kalshi) are finance-first and lonely.** The World Cup Winner market alone has done ~$3.7B in volume, proving massive appetite for prediction — but the UX is an anonymous order book that feels like trading stocks against strangers. There is no "watching with your friends" layer.
- **Friend-group competition runs on spreadsheets and group chats.** Sweepstakes, survivor pools, and bracket pools are run manually. Someone has to be the "commissioner," track results by hand, and everyone has to trust them not to make mistakes or play favorites.

The gap: nobody has built the social, low-stakes, provably-fair companion experience for friend groups watching together. That is the white space Terrace fills — and it maps directly onto the Consumer & Fan Experiences track, which is the least-contested track in the hackathon relative to its prize pool.

---

## 3. Unique value proposition (UVP)

**"Prediction, but with your friends — and provably fair."**

Three pillars, each a defensible wedge:

1. **Social, not solitary.** Private rooms for your group, live shared leaderboard, reactions and banter — the terrace feeling, not the trading terminal.
2. **Provably fair.** Every result is verified against TxLINE's cryptographic proof and the room's final standings are anchored on Solana. The host cannot fudge who won. This translates TxODDS's B2B "verifiable data" thesis into a consumer _feeling_ — the exact bridge no other team is likely to build.
3. **Zero-friction, zero-custody.** No bookmaker, no house, no wagers held by us. The competition is the product; monetization is decoupled (see §8).

---

## 4. Competitive landscape

| Competitor                                  | What they do                                                                | Where they fall short (our opening)                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Polymarket / Kalshi                         | Deep-liquidity prediction markets                                           | Finance-first, anonymous counterparties, order-book UX. No social/friend layer, no "watch together" feeling. We do not compete on liquidity — we compete on _social experience_.          |
| Sleeper / traditional fantasy               | Social fantasy sports                                                       | Season-long, roster-based, not built for live single-match second-screen tension. No on-chain provability.                                                                                |
| Manual sweepstakes (spreadsheets, WhatsApp) | Friend-group pools                                                          | Manual result-tracking, trust-dependent commissioner, no automation, no verifiability. This is who we actually replace.                                                                   |
| Other hackathon Consumer entries            | Likely the brief's example ideas (Hi-Lo game, pundit bot, basic sweepstake) | Predictable, non-monetizable toys built to the literal brief. We differentiate on provable fairness + a real business model + polished execution.                                         |
| WeLikeSports (Colosseum Frontier winner)    | No-rake fantasy pools, revenue from float interest                          | Not a competitor — a _proof point_. Their "no house rake, revenue elsewhere" model won a top-25 slot. We borrow the philosophy but adapt the mechanism (hosting/subscription, not float). |

**Strategic note on judges:** The hackathon is sponsored "by TxODDS," a 25-year betting-data firm. Judging is most likely TxODDS-led (best placed to assess correct proof usage) with Superteam weighing Solana execution. This means: (a) using the on-chain proof for real, not as a logo, scores heavily; (b) demonstrating you understand their business — sportsbooks, verifiable settlement — earns credibility. Both are baked into this PRD. _(Judge composition is inferred, not confirmed — verify in their Telegram if it affects strategy.)_

---

## 5. Data source: how TxLINE actually works

Confirmed from TxLINE documentation (docs at `txline-docs.txodds.com`):

- **Free World Cup access** through July 19, 2026. Two service levels: **SL1 (60-second delay)** and **SL12 (real-time)**. Covers all 104 matches + international friendlies.
- **Two data modules:** _StablePrice Snapshots_ (consolidated odds — full/half-time match odds, over/unders, Asian handicaps) and _Tx Scores_ (live match state and scoring events).
- **Endpoints:** Fixtures, Odds (snapshot/historical/stream), Scores (snapshot/historical/stream), and **Validation Proofs** (returns fixture/odds/score proofs for on-chain validation).
- **Auth flow:** Free on-chain subscription (SL1 or SL12, no TxL payment required) → activate an API token → call data endpoints with `Authorization: Bearer {jwt}` + `X-Api-Token: {apiToken}`.

### Two critical technical truths that shape the build

1. **There is no `validate_stat` CPI in the documented API.** The brief mentions it, but the on-chain program (`txoracle`) does _subscription/access-gating only_. Proofs are delivered **off-chain via REST**, and you verify them in _your own_ Anchor program. So our architecture is: fetch signed proof from TxLINE → our program verifies signature/hash → our program settles. This is more original than a CPI hook and matches the "custom on-chain settlement engine" the brief praises. **ACTION: confirm exact proof format in TxLINE Telegram (`t.me/TxLINEChat`) before writing verify logic.**

2. **Settle off the 60-second-delay tier (SL1), and make it a feature.** Broadcasts are themselves delayed ~30–60s. Settling off a real-time feed would let a fast-stream viewer "predict the past." Using SL1 as the settlement source shrinks that edge _and_ gives VAR reversals time to resolve before the data arrives. What looks like a limitation is a safety margin — frame it as deliberate in your submission.

---

## 6. Architecture (one engine, two features)

The hard part — proof verification + on-chain anchoring — is built **once** and reused by both features.

```
TxLINE (SL1 feed + proof endpoint)
        │
        ▼
Backend ingest service (Node) ── SSE stream → prop generation + result detection
        │
        ▼
Finality gate ── waits for finality condition (next distinct event supersedes,
        │         or fixed confirmation buffer) → solves VAR reversal problem
        ▼
Verification engine ── fetch TxLINE proof, verify signature/hash
        │
        ▼
Anchor program (Solana devnet) ── verify proof + settle prediction + anchor
        │                          hash of room results on-chain
        ▼
Shareable "prediction card" (provably-fair, exportable image/link)
        │
        ▼
Monetization: hosting/subscription (never a cut of stakes)
```

**Feature A — Live Match Game (the demo star):** per-match rooms, auto-generated props from the live stream, finality-aware settlement, live leaderboard.

**Feature B — Season League (the business):** tournament-long survivor/bracket pools, auto-updating leaderboard off proofs, paid "Commissioner" tier. Built on the same verification engine.

**Devnet-USDC decision:** Deploy fully on devnet using devnet USDC for stakes. This gives the real-money _look and mechanics_ (real escrow contract, real Anchor code to learn) with **zero legal exposure and zero real-funds-at-risk**. The brief explicitly permits devnet submissions. Real mainnet USDC is a stated v2, positioned as white-label for licensed operators — which flatters TxODDS's actual customers and answers the "commercial path" criterion without you custodying wagers.

---

## 7. Screen-by-screen feature spec

### 7.1 Onboarding / wallet connect

- One-tap wallet connect (use an embedded-wallet provider like Privy for email→wallet so non-crypto fans aren't blocked, or standard Solana wallet-adapter).
- Skip long tutorials. First screen after connect = "Join a room" or "Create a room."
- **Judging tie-in:** Fan accessibility — a mainstream fan must get in without crypto knowledge.

### 7.2 Home / lobby

- List of today's World Cup matches (from TxLINE Fixtures endpoint).
- "Your rooms" (active + upcoming) and "Join with code."
- Prominent CTA: create a room for the next kickoff.

### 7.3 Live Match Room _(the star screen — see mockup)_

- Live score header (Tx Scores), match clock, participant count.
- Stack of **prediction cards**, each in one of these states:
  - **Open** — tap to pick before the event locks.
  - **Locked** — pick registered, awaiting result.
  - **Under review (VAR)** — amber state, "result held until final." _This is your signature differentiator — surface it prominently and animate it._
  - **Settled** — green, "+points," with a "Verified on-chain" tag linking to the proof/anchor.
- Auto-generated props from the stream: next goalscorer, card this half, next-goal timing band, half-time score, corner/shot over-under.
- Bottom tab: Predict · Leaderboard · Chat.
- **Judging tie-in:** Real-time responsiveness + originality. The under-review state is the "genuinely new" fan interaction.

### 7.4 Live Leaderboard

- Updates as predictions settle. Avatars, points, streaks.
- Subtle "provably fair" badge — tapping shows the anchored hash / proof reference.

### 7.5 Post-match Prediction Card (viral loop)

- Auto-generated shareable image/link: who called the upset, final standings, cryptographic proof reference.
- One-tap share to social / group chat. This is your organic growth engine.
- **Judging tie-in:** Originality + value creation. A provably-fair, shareable social object almost no one else will build.

### 7.6 Season League (Commissioner)

- Create a tournament-long league (survivor or bracket) with a custom name + rules.
- Invite via link. Standings auto-update off TxLINE proofs across all 104 matches — no manual admin.
- Paid Commissioner tier unlocks bigger groups, custom props, season history.
- **Judging tie-in:** Commercial & monetization path — this is your unpokeable business answer.

### 7.7 Result/Proof detail (trust surface)

- For any settled prediction: show the event, the TxLINE proof reference, and the Solana anchor transaction.
- Reinforces the "nobody can cheat" promise that separates you from a spreadsheet.

---

## 8. Business model & monetization

Revenue is **decoupled from stakes** — we never take a cut of predictions, so there is no house and no wagering-custody problem.

| Stream                                 | Description                                                                                            | Why it's defensible                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Commissioner subscription              | Paid tier to host private season-long leagues (bigger groups, custom props, history, themes).          | "Discord Nitro for World Cup predictions." A judge can't poke a hole in a SaaS-style hosting fee — it isn't pretending to be DeFi. |
| Sponsored / branded public rooms       | Brands host public rooms during marquee matches.                                                       | Real B2B revenue; scales with attention, not float.                                                                                |
| Cosmetic layer                         | Room themes, badges, card styles.                                                                      | Proven consumer model; pure margin.                                                                                                |
| v2 — white-label to licensed operators | The same proof-verified room engine, with real mainnet-USDC stakes, licensed to regulated sportsbooks. | Directly serves TxODDS's actual customer base — a strong "vision" signal for judges, stated as future work, not built now.         |

**Explicitly killed:** yield-on-escrow-float. Math doesn't work — a friend-group pool held for ~90 minutes generates a fraction of a cent. Do not pitch it.

---

## 9. Scope & 17-day build plan (solo)

Guiding principle: **judging is heavily weighted on the demo video**, and live matches will be over by review time. So the target is not "a huge platform" — it's **one flawless core loop, shot as a great 5-minute demo.** Ruthlessly protect scope.

### Must-have (MVP for submission)

- Wallet connect + create/join room.
- Live Match Room with 2–3 prop types, fed by TxLINE (SL1).
- Finality-aware settlement (the VAR-safe gate) — even if simplified.
- On-chain: at minimum, anchor the room's settled results/hash on devnet + one prediction settled via your Anchor program using a verified proof.
- Live leaderboard.
- Shareable prediction card.
- Deployed devnet link + public repo + 5-min demo video + technical doc + feedback note.

### Nice-to-have (only if ahead of schedule)

- Season League / Commissioner flow (can be shown as a designed-but-partial "here's the business" segment in the video if not fully built).
- Chat, reactions, cosmetic themes, TTS pundit layer.

### Rough phase plan

- **Days 1–2:** Confirm proof format in Telegram. Auth flow working, pulling live fixtures/scores/proofs. Lock the exact spec — no scope creep past this doc.
- **Days 3–5:** Backend ingest + SSE stream + prop generation + result detection + finality gate.
- **Days 6–9:** Anchor program (devnet): proof verification + settlement + result anchoring. This is your Solana learning block — keep it narrow.
- **Days 10–13:** Frontend — Live Match Room, leaderboard, prediction card. Polish to "a fan would open this."
- **Days 14–15:** End-to-end against a real live match (or a recorded/simulated feed replay). Fix the demo-critical path.
- **Days 16–17:** Record + edit the demo video (problem → live walkthrough → how TxLINE + Solana power it). Write technical doc + feedback. Submit early, not at 23:58 UTC.

---

## 10. Submission checklist (from the brief)

- [ ] Deployed build (devnet) using TxLINE feeds as primary data source.
- [ ] Demo video (≤5 min) — problem, live walkthrough, how TxLINE powers the backend. _(Absolute requirement to pass screening.)_
- [ ] Public GitHub repo.
- [ ] Working deployed link OR functional API/devnet endpoint for judges.
- [ ] Brief technical doc — core idea, highlights, specific TxLINE endpoints used.
- [ ] Feedback note — API experience, what you liked, where you hit friction.
- [ ] Working build, not a mockup/wireframe (auto-DQ otherwise).
- [ ] Sign up / integrate through Solana.

---

## 11. Key risks & mitigations

| Risk                                                    | Mitigation                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `validate_stat`/proof interface differs from assumption | Confirm in Telegram Day 1 before building settlement. Architecture already assumes off-chain proof + own on-chain verify.                |
| VAR reversal settles a chalked-off goal                 | Finality gate (next-event supersede or confirmation buffer) + settle off SL1 delayed feed. Turned into a visible "under review" feature. |
| Solo scope creep sinks the demo                         | This PRD is the frozen scope. One core loop, polished. Season League is nice-to-have, shown in-video if unbuilt.                         |
| Learning Rust on a real-money escrow                    | Devnet USDC only. Real value never at risk during the hackathon.                                                                         |
| Legal/gambling exposure                                 | No stake custody, no house cut, devnet only. Monetization decoupled to hosting.                                                          |
| No live matches during judging                          | Demo video is the deliverable. Prepare a feed replay / recorded run so the walkthrough is flawless regardless of live activity.          |

---

_Build one thing, make it provably fair, make it feel like watching with friends. That's the whole game._
