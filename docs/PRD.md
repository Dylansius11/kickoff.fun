# KICK.FUN — Product Requirements Document

_Watch the World Cup with friends. Predict live. The results can't be faked._

**Version:** 1.3 — hackathon build (supersedes v1.2 "kickoff.fun", v1.0 "Terrace")
**Author:** Solo founder
**Target:** TxODDS World Cup Hackathon — **Consumer & Fan Experiences track ($16K)**
**Submission deadline:** July 19, 2026, 23:59 UTC
**Platform:** Mobile-first responsive web app (PWA), Solana devnet
**Brand / domain:** **KICK.FUN** (domain `kick.fun`). In-app, a match room is called a **"terrace"** — "start a terrace."

**Foundation docs (this repo):**
| Doc | Purpose |
| --- | --- |
| `docs/PRD.md` (this) | Product: what we build, for whom, why, how it makes money |
| `docs/technical/ARCHITECTURE.md` | System design, data flow, service boundaries, deployment |
| `docs/technical/TECH-STACK.md` | Exact versioned stack + rationale (verified July 2026) |
| `docs/technical/SMART-CONTRACT.md` | Anchor program: accounts, PDAs, instructions, proof verification, security |
| `docs/technical/INTEGRATIONS.md` | TxLINE, Privy, TTS, RPC, Supabase — auth flows + endpoints |
| `docs/technical/ERD.md` | Data model: off-chain (Postgres) + on-chain accounts + relationships |
| `docs/design/DESIGN_GUIDE.md` | **Floodlit Arcade** design language, components, motion, anti-slop |
| `brand.md` (repo root) | Machine-readable design tokens (colors, fonts, radius, motion) |

---

## 0. What changed since v1.0 (read this first)

| Decision | v1.0 | v1.2 (this doc) | Why |
| --- | --- | --- | --- |
| Name | Terrace → kickoff.fun | **KICK.FUN** | Shortest, punchiest, most typable. `.fun` = legible + on-trend (pump.fun energy). "Terrace" kept only as the room metaphor ("start a terrace"). |
| Core stakes | Devnet USDC peer staking + escrow | **Points (non-cashable) for players; sponsor-funded USDC pot** | Peer staking = gambling optics + custody risk + zero revenue. Removed. |
| Positioning | "Host can't cheat your friends" | **"The data itself can't be faked"** (Spotify-scandal wedge) | Fans don't fear a friend rigging a free game. They _do_ get that manipulated data settled real markets last week. |
| Season League | Built feature | **Roadmap only** (2 mockup screens in video) | Solo/15-day scope. One flawless loop beats two half-built. |
| On-chain money | Peer-pool escrow (bi-directional) | **One-directional sponsor→winner claim, gated by proof** | Simpler contract, real business model, no gambling, no user custody. |
| Business headline | Commissioner subscription | **B2B white-label + brand-funded pools** | Both make TxODDS money (sell more TxLINE). Subs = tail. |
| Oracle AI pundit | Not in scope | **In MVP** (templated TTS in-room) | Makes the "boring proof" audible + fun. One feature, three judging criteria. |

**Frozen scope principle:** judging is _heavily_ weighted on the demo video, and matches are over by review time. Target = **one flawless core loop, shot as a great 5-minute demo** using TxLINE replay. Ruthlessly protect scope. This doc is the contract.

---

## 1. One-line summary

KICK.FUN turns watching a World Cup match into a live social game: friends join a private **terrace** (room), predict what happens next off real-time TxLINE data, an AI pundit (**the Oracle**) calls the action out loud, and every result is settled automatically against **cryptographically signed** match data anchored on Solana — so nobody, not even us, and not a faked data feed, can rig who won.

---

## 2. The problem (and why now)

Most fans watch the World Cup with a phone in their hand, but the second-screen experience is fragmented and dull. The two things fans actually do — **predict outcomes** and **compete with friends** — are served badly, and a fresh scandal just exposed a third gap:

- **Prediction markets (Polymarket, Kalshi) are finance-first and lonely.** The World Cup Winner market alone has passed **$4B** in volume; combined Polymarket+Kalshi monthly volume hit ~$24B in April 2026. Massive appetite — but the UX is an anonymous order book that feels like trading stocks against strangers. **No "watching with your friends" layer.** They already do live in-play markets; they will _not_ build the social/consumer layer. That's the white space.
- **Friend-group competition runs on spreadsheets and group chats.** Sweepstakes, survivor pools, bracket pools — all manual. Someone is the "commissioner," tracks results by hand, everyone trusts them not to fat-finger or play favorites.
- **The data behind prediction just got caught being fakeable.** July 3, 2026: **Spotify demanded Kalshi + Polymarket drop its logo after markets settled off _manipulated_ stream data** (Bloomberg / The Block). Live, national-news proof that prediction settlement is only as honest as its data source.

**The gap KICK.FUN fills:** the social, low-stakes, **provably-real** companion experience for friend groups watching together — settled off data that is signed at the source and cannot be manipulated the way Spotify's was. This maps directly onto the Consumer & Fan Experiences track, the least-contested track relative to its prize pool (10 submissions / $16K at time of writing).

---

## 3. Unique value proposition (UVP)

**"Prediction, with your friends — off data that can't be faked."**

Three pillars, each a defensible wedge:

1. **Social, not solitary.** Private terraces for your group, live shared leaderboard, the Oracle's banter — the terrace roar, not the trading terminal. _No large competitor plays here._
2. **Provably real.** Every result is settled against TxLINE's cryptographically signed proof and anchored on Solana. Unlike the Spotify feed that just got manipulated, this data is signed at the source. This translates TxODDS's B2B "verifiable data" thesis into a consumer _feeling_ — the exact bridge no other team is likely to build.
3. **Zero-friction, zero-custody.** Players stake nothing. No bookmaker, no house, no user funds held. The competition is the product; money enters only via **sponsor-funded pots** (see §8), settled to the winner by proof.

**Narrative order (critical): fun first, proof second.** Lead every surface and the demo with the roar (friends, live leaderboard swinging on a 90th-minute goal, the Oracle shouting). _Then_ reveal the proof as the punchline: "…and nobody can rig this." Crypto is the skin, not the pitch.

---

## 4. Competitive landscape

| Competitor | What they do | Where they fall short (our opening) |
| --- | --- | --- |
| Polymarket / Kalshi | Deep-liquidity prediction markets; already run live in-play sports + entering perps | Finance-first, anonymous counterparties, order-book UX. **No social/friend layer, no "watch together" feeling.** We do not compete on liquidity — we compete on _social experience_ and _consumer delight_. |
| Sleeper / traditional fantasy | Social fantasy sports | Season-long, roster-based, not built for live single-match second-screen tension. No on-chain provability. |
| Manual sweepstakes (spreadsheets, WhatsApp) | Friend-group pools | Manual result-tracking, trust-dependent commissioner, no automation, no verifiability. **This is who we actually replace.** |
| Polymarket copy-trade bots (PolyClawster, OpenClaw, PolyCop) | Automated trading / copy-trading | Saturated, no consumer/social surface, no fun. Confirms we should _not_ enter the bot-arena space. |
| Other hackathon Consumer entries | Likely the brief's literal example ideas (Hi-Lo, pundit bot, basic sweepstake) | Predictable, non-monetizable toys built to the brief. We differentiate on provable-real data + a real business model + the Oracle + polished execution. |
| WeLikeSports (Colosseum Frontier winner) | No-rake fantasy pools, revenue from float interest | Not a competitor — a _proof point_. Their "no house rake, revenue elsewhere" model won a top-25 slot. We borrow the philosophy, adapt the mechanism (sponsor pots + B2B, not float). |

**Strategic note on judges:** Hackathon is sponsored "by TxODDS," a 25-year betting-data firm. Judging is most likely **TxODDS-led** (best placed to assess correct proof usage + commercial fit) with **Superteam/Solana** weighing on-chain execution. Half the panel are sports-data/betting-industry pros, not crypto degens. Implications baked into this PRD: (a) use the on-chain proof _for real_, not as a logo; (b) show you understand their business — sportsbooks, verifiable settlement, white-label — which is why B2B is the headline business model. _(Judge composition inferred, not confirmed — verify in TxLINE Telegram if it affects strategy.)_

---

## 5. Data source: how TxLINE actually works

Confirmed from TxLINE documentation:

- **Free World Cup access** through July 19, 2026. Two service levels: **SL1 (60-second delay)** and **SL12 (real-time)**. Covers all 104 matches + international friendlies. No rate limits on free tier.
- **Two data modules:** _StablePrice Snapshots_ (consolidated odds — full/half-time match odds, over/unders, Asian handicaps) and _Tx Scores_ (live match state and scoring events).
- **Endpoints:** **Fixtures**, **Odds** (snapshot / historical / stream), **Scores** (snapshot / historical / stream), and **Validation Proofs** (returns fixture/odds/score proofs for on-chain validation).
- **Auth flow:** guest JWT (`POST /auth/guest/start`) → free on-chain subscription (`subscribe` instruction, SL1 or SL12, no TxL payment) → activate API token (`/api/token/activate`) → call data endpoints with `Authorization: Bearer {jwt}` + `X-Api-Token: {apiToken}`.
- **Network:** devnet program ID `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, endpoint `https://txline-dev.txodds.com`. (Mainnet program `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`.)

### Which TxLINE data drives which part of KICK.FUN

| KICK.FUN element | TxLINE source |
| --- | --- |
| Who-vs-who, schedule, kickoff time, group/round | **Fixtures** endpoint |
| Live score, goals, cards, match clock (the game's pulse) | **Scores** stream |
| Odds / implied probability (prop generation + Oracle lines) | **Odds** stream (StablePrice) |
| Final outcome used to settle (the receipt) | **Validation Proofs** |
| Pot amount (sponsor USDC) | On-chain, set by sponsor — **not** TxLINE |
| Who wins the pot | Our Anchor program, computed from the TxLINE proof |

**TxLINE = the brain** (who plays, what happens, verified result). **Solana = the wallet + referee** (holds the sponsor pot, pays the winner by proof). **Points = the fun score** (glory, not money).

### Two critical technical truths that shape the build

1. **There is no `validate_stat` CPI in the documented API.** The brief mentions it, but the on-chain program (`txoracle`) does _subscription/access-gating only_. Proofs are delivered **off-chain via REST** (Validation Proofs endpoint); you verify them in _your own_ Anchor program. Our architecture: fetch signed proof from TxLINE → our program verifies signature/hash → our program settles. This is _more_ original than a CPI hook and matches the brief's praised "custom on-chain settlement engine." **ACTION Day 1: confirm exact proof format in TxLINE Telegram before writing verify logic — this sets the fallback ladder (§6.3).**
2. **Settle off the 60-second-delay tier (SL1), and make it a feature.** Broadcasts are themselves delayed ~30–60s. Settling off a real-time feed would let a fast-stream viewer "predict the past." Using SL1 as the settlement source shrinks that edge _and_ gives VAR reversals time to resolve before the data arrives. What looks like a limitation is a safety margin — frame it as deliberate.

---

## 6. Architecture (one engine, everything else is a skin)

The hard part — prop generation, finality-aware settlement, proof verification, on-chain anchoring — is built **once** and reused everywhere.

```
TxLINE (SL1 feed: Fixtures + Scores + Odds streams; Validation Proofs endpoint)
        │
        ▼
Ingest service (Node) ── SSE subscribe → normalize → fan-out
        │
        ├──► Prop engine ........ auto-generates prediction cards from live state + odds
        ├──► Result detector .... maps incoming events to open predictions
        ├──► Oracle trigger ..... goal / card / big-odds-move / settlement / VAR → TTS line
        │
        ▼
Finality gate ── waits for finality (next distinct event supersedes,
        │         OR fixed confirmation buffer) → solves VAR-reversal problem
        ▼
Verification engine ── fetch TxLINE proof → verify signature/hash  (fallback ladder §6.3)
        │
        ▼
Anchor program (Solana devnet):
        │   • verify proof
        │   • settle prediction → award points
        │   • anchor hash of room's settled results on-chain (the receipt)
        │   • if room has a sponsor pot: release pot → winner claim (one-directional)
        ▼
Frontend (Next.js PWA) ── terrace room, leaderboard, Oracle audio, shareable card
        │
        ▼
Points (off-chain, non-cashable) ·· Sponsor pot (on-chain, proof-gated)
```

### 6.1 The one-directional money contract (no gambling, no custody)

- A **sponsor** (brand, media partner, or a friend acting as host-sponsor) deposits devnet USDC into a room's **pot PDA**.
- **Players stake nothing.** They play free for points.
- Match ends → TxLINE proof → Anchor program verifies → the pot releases to the **winner** (top of that terrace's leaderboard), who **claims** on-chain.
- This is **sponsor → winner**, gated by unriggable data. It is _not_ peer-to-peer wagering. No user funds are ever held by us; players carry no financial risk.

### 6.2 Devnet decision

Deploy fully on **devnet with devnet USDC** for the sponsor pot. Real escrow-style Anchor code (learnable, real), **zero legal exposure, zero real funds at risk.** The brief explicitly permits devnet submissions. Mainnet USDC + licensed-operator white-label is stated **v2** (see §8) — flattering TxODDS's actual customers without you custodying anything now.

### 6.3 Proof-verification fallback ladder (lock on Day 2, before writing Anchor code)

Everything crypto hinges on TxLINE's proof format, verified inside Anchor. Confirm format Day 1–2 in Telegram, then pick a rung — do **not** discover this on Day 8:

1. **Best — Merkle proof / hash path:** verify the hash chain in-program. Straightforward Anchor. Ship it.
2. **Signed payload (ed25519):** verify via Solana's native `ed25519_program` + instruction introspection. Known but fiddly. Budget +1 day.
3. **Graceful fallback (protects the demo):** Anchor program **anchors the hash** of the TxLINE-signed proof on-chain (tamper-evident receipt); signature verification happens **off-chain** in the ingest service and is displayed. Still provably-real to a fan, still on-chain. **Do not let purism cost the demo.**

---

## 7. Screen-by-screen feature spec

Design language: mobile-first, stadium-at-night energy, one-thumb reachable, big legible numbers (see number-formatting rules), motion that reacts to the match (see page-load-animations). Every screen carries a subtle "provably real" trust marker without shouting crypto.

### 7.0 Global: the Oracle (AI pundit) — lives across the room, not a screen

The Oracle is KICK.FUN's live commentator + hype-man. It is the feature that makes "proof" _fun to hear_ and the room feel alive.

- **MVP = templated TTS.** Deterministic text templates filled with live TxLINE data, spoken via a TTS voice. No heavy LLM needed for MVP (deterministic = judges trust it; cheaper; ships faster).
- **Trigger events + example lines:**
  - **Goal** → _"GOOOAL, Mbappé! That just wrecked three of your calls — but [name] nailed it, +50, top of the terrace!"_
  - **Big odds swing** → _"Whoa — market's flipped, Brazil favourite now. Anyone brave enough to switch?"_
  - **Card** → _"Red card! Down to ten. Your 'clean sheet' picks are in trouble."_
  - **Settlement** → _"That result? Verified. Signed by TxLINE, locked on-chain. Nobody's rigging this one."_ ← the Oracle **speaks the provability**, turning the receipt into a punchline.
  - **VAR under review** → _"Hold up… VAR's looking at it. Points frozen till it's final."_
- **Persona = cosmetic.** Default voice free (e.g., hype US announcer); alternate voices (angry Scottish gaffer, calm analyst) unlock via points/cosmetics.
- **Stretch only:** LLM-generated color commentary for richer, non-repetitive lines. Do not build until core loop is flawless.
- **Judging tie-in:** real-time responsiveness + originality + "bonus points for TTS" (brief) — one feature, three criteria, and it carries the demo audio.

### 7.1 Onboarding / wallet connect

- One-tap sign-in. Use an **embedded-wallet provider (e.g., Privy) with email→wallet** so non-crypto fans aren't blocked; standard Solana wallet-adapter as the power-user path.
- No long tutorial. First screen after sign-in = **"Join a terrace"** or **"Start a terrace."**
- **Judging tie-in:** Fan Accessibility — a mainstream fan gets in with zero crypto knowledge.

### 7.2 Home / lobby

- Today's World Cup fixtures (TxLINE **Fixtures**): who-vs-who, kickoff time, group/round, live/upcoming state.
- **Your terraces** (active + upcoming) and **Join with code**.
- Prominent CTA: start a terrace for the next kickoff.
- Points balance + your global tournament rank in the header (drives return visits across 104 matches).

### 7.3 Live Match Room — "the terrace" _(the star screen)_

- **Live score header** (TxLINE Scores): score, match clock, participant avatars, pot badge if sponsored.
- **Prediction card stack**, each card in one state:
  - **Open** — tap to pick before the event locks.
  - **Locked** — pick registered, awaiting result.
  - **Under review (VAR)** — **amber**, "result held until final." _Signature differentiator — surface it, animate it._
  - **Settled** — **green**, "+points," with a **"Verified on-chain"** tag → opens the proof/anchor (§7.7).
- **Auto-generated props** (from Scores + Odds stream): next goalscorer, card this half, next-goal timing band, half-time score, corner / shot over-under.
- **Bottom tabs:** Predict · Leaderboard · Chat.
- The **Oracle** speaks over the top on trigger events (§7.0).
- **Judging tie-in:** real-time responsiveness + originality (the under-review state is the genuinely-new fan interaction).

### 7.4 Live Leaderboard

- Updates as predictions settle. Avatars, points, streaks, rank deltas that animate on change.
- Subtle **"provably fair"** badge; tapping shows the anchored hash / proof reference.
- If a **sponsor pot** is attached: shows current leader = provisional pot winner, and "pot releases when the final whistle's data is verified."

### 7.5 Post-match Prediction Card (viral loop)

- Auto-generated **shareable image/link**: who called the upset, final standings, streak, and the **cryptographic proof reference** ("verified by TxLINE").
- One-tap share to social / group chat. Organic growth engine.
- **Judging tie-in:** originality + value creation — a provably-real, shareable social object almost no one else will build.

### 7.6 Points & Rewards (what points are _for_)

**Points are non-cashable by design.** Points are never redeemable for money or crypto — that keeps KICK.FUN free-to-play and clear of gambling law, and means we hold **no financial liability** to users. Points buy:

1. **Status / bragging rights** — leaderboard position, streak badges, "terrace champion" flair. The core loop (Duolingo/Strava-style).
2. **Cosmetics** — room themes, **Oracle voices**, prediction-card skins, avatars. Points unlock the free tier; real money (cosmetic purchase) unlocks premium. Pure-margin monetization hook.
3. **Tournament ranking** — points accumulate across all 104 matches into a global rank. **Top-ranked players win sponsor-funded prizes** (skill-based leaderboard, not gambling). This is the retention engine across the whole tournament.
4. **Sponsor-pool tickets** — spend points to enter sponsor-funded prize rooms. Points act as an in-app currency for access, never as cash.

### 7.7 Result / Proof detail (the trust surface)

- For any settled prediction: show the event, the TxLINE proof reference, and the Solana anchor transaction.
- Copy reinforces the wedge: _"Last week markets settled off faked Spotify data. This result is signed at the source — here's the proof."_
- Reinforces the "nobody, and no faked feed, can cheat" promise that separates us from a spreadsheet _and_ from Polymarket's manipulated-oracle risk.

### 7.8 Season League / Commissioner _(ROADMAP — designed, not built)_

- Shown as **2 polished mockup screens** in the demo video (~20s), labeled as the business path — **not** functional for the hackathon.
- Concept: tournament-long survivor/bracket leagues, standings auto-updating off TxLINE proofs across 104 matches, paid **Commissioner** tier (bigger groups, custom props, season history, themes).
- **Judging tie-in:** commercial vision without spending build days. Explicitly out of MVP scope.

---

## 8. Business model & monetization

Revenue is **decoupled from stakes** — players never wager, we never take a cut of predictions, so there is no house and no wagering-custody problem. Lead the pitch with the two models that also make **TxODDS** money (they sell more TxLINE), because TxODDS judges the room.

| Stream | Description | Why it's defensible |
| --- | --- | --- |
| **B2B white-label (HEADLINE)** | License the whole provably-real terrace engine as an embeddable widget to **sportsbooks + sports media** for fan engagement/retention. | Directly serves TxODDS's own customer base — every operator who buys the widget buys more TxLINE. Judge-aligned #1. |
| **Brand-funded prize pools** | Brands fund the pot; **fans play free**; winner claims via proof. Brand gets engagement + first-party fan data. | No user stakes → zero gambling exposure, zero custody. Scales with attention, not float. "Fans play free, brands pay." |
| Cosmetic layer | Room themes, Oracle voices, card skins, badges — bought with real money; points unlock the free tier. | Proven consumer model; pure margin. |
| Commissioner subscription (tail) | Paid tier to host season-long private leagues (bigger groups, custom props, history). | "Discord Nitro for World Cup predictions." SaaS hosting fee a judge can't call DeFi-in-disguise. Tail, not headline. |
| v2 — white-label to licensed operators | The same engine with **real mainnet-USDC** pots, licensed to regulated sportsbooks. | Stated future work — a strong vision signal that flatters TxODDS's customers, without you custodying anything now. |

**Explicitly killed:** (a) peer-to-peer staking of any kind — gambling optics, custody risk, and not a revenue source; (b) yield-on-escrow-float — a friend-group pot held ~90 min earns a fraction of a cent, the math doesn't work. Do not pitch either.

**One-paragraph money story for the video:**
> _"Fans play free for points and glory. Brands fund the pot. When the match ends, the winner is decided by TxLINE's signed data — not by us, and not by a feed that can be faked like Spotify's was last week — and the prize releases on-chain automatically. No house, no cheating, no faked data. And any sportsbook can white-label this terrace tomorrow."_

---

## 9. Scope & 15-day build plan (solo)

Guiding principle: **judging is heavily weighted on the demo video**, and live matches are over by review time. Target = **one flawless core loop, shot as a great 5-minute demo** (using TxLINE replay). Ruthlessly protect scope.

### Must-have (MVP for submission)

- Wallet/email sign-in + start/join terrace.
- Live Match Room with 2–3 prop types, fed by TxLINE **SL1** (Fixtures + Scores + Odds).
- Finality-aware settlement (the VAR-safe gate) — even if simplified.
- **The Oracle**: templated TTS reacting to ≥4 event types (goal, card, big odds move, settlement) + VAR-hold line.
- On-chain: anchor the room's settled-results hash on devnet **and** settle ≥1 prediction via the Anchor program using a verified proof; if sponsored, the sponsor-pot → winner claim path works end-to-end for one demo room.
- Live leaderboard. Points (non-cashable) with status + cosmetic unlock demonstrated.
- Shareable prediction card.
- Deployed devnet link + public repo + 5-min demo video + technical doc + feedback note.

### Nice-to-have (only if ahead of schedule)

- LLM-generated Oracle color commentary (beyond templates).
- Extra prop types, cosmetics/themes, chat reactions.
- Season League: **do not build** — mockup screens for the video only.

### Phase plan

- **Days 1–2:** Confirm proof format in TxLINE Telegram; **lock the fallback ladder rung (§6.3).** Auth flow working; pull live Fixtures/Scores/Odds/Proofs. Freeze spec — no scope creep past this doc.
- **Days 3–5:** Ingest service + SSE + prop engine + result detector + finality gate. Oracle trigger engine (templates + TTS).
- **Days 6–9:** Anchor program (devnet): proof verification (or fallback rung) + point settlement + results-hash anchoring + one-directional sponsor-pot claim. Solana learning block — keep it narrow.
- **Days 10–13:** Frontend — terrace room, leaderboard, prediction card, points/cosmetics surface, proof detail. Polish to "a fan would open this" (brand-design, frontend-design-guidelines, page-load-animations).
- **Days 14–15:** End-to-end against a real live match _or_ a recorded/replayed feed. Fix the demo-critical path. Build the 2 Season League mockup screens.
- **Days 16–17 (buffer):** Record + edit demo video (problem → live walkthrough → Oracle audio → proof reveal → business). Write technical doc + feedback note. **Submit early, not at 23:58 UTC.**

---

## 10. Submission checklist (from the brief)

- [ ] Deployed build (devnet) using TxLINE feeds as **primary** data source.
- [ ] Demo video (≤5 min) — problem, live walkthrough, how TxLINE powers the backend. _(Absolute requirement to pass screening.)_
- [ ] Public GitHub repo.
- [ ] Working deployed link OR functional API/devnet endpoint for judges.
- [ ] Brief technical doc — core idea, highlights, specific TxLINE endpoints used.
- [ ] Feedback note — API experience, what you liked, where you hit friction.
- [ ] Working build, not a mockup/wireframe (auto-DQ otherwise).
- [ ] Sign up / integrate through Solana.

---

## 11. Demo video script (60% of the grade — plan it like the product)

1. **Hook (0:00–0:30):** "$4B sits on Polymarket's who-wins-the-whole-thing market. But 77% of fans are on their phone _during_ the match with nothing to do — and last week, markets settled real money off _faked_ Spotify data. KICK.FUN fixes both."
2. **The roar (0:30–3:00):** Screen-record a **TxLINE replay** of a real group-stage match (e.g., France–Senegal, Mbappé). Friends in a terrace, predictions fire, the **Oracle shouts** over a goal, leaderboard swings, streak climbs. Feels alive. _Fun first._
3. **The magic trick (3:00–4:00):** Tap a settled card → the proof + Solana anchor. Oracle line: "That result? Verified, signed by TxLINE, locked on-chain — nobody's rigging this one." Show the sponsor pot releasing to the winner by proof.
4. **The business (4:00–5:00):** 20s Season League mockups + one line: "Fans play free, brands fund pots, and any sportsbook can white-label this — powered by TxLINE." Close.

---

## 12. Key risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Proof interface differs from assumption | Confirm in Telegram Day 1–2 before building settlement. Fallback ladder (§6.3) already assumes off-chain proof + own on-chain verify, with a graceful anchor-only rung. |
| VAR reversal settles a chalked-off goal | Finality gate (next-event supersede or confirmation buffer) + settle off SL1 delayed feed. Turned into a visible "under review" feature. |
| Solo scope creep sinks the demo | This PRD is the frozen scope. One core loop, polished. Season League = mockup only; Oracle = templated, not LLM. |
| "Provably fair" bores fans | Fun-first narrative order; the **Oracle speaks the proof** so it lands as a punchline, not a badge. |
| Learning Rust on a money contract | Devnet USDC only; one-directional sponsor→winner claim (simpler than peer-pool escrow). Real value never at risk. |
| Legal/gambling exposure | Players stake nothing; points non-cashable; money enters only as sponsor→winner via proof; devnet only. |
| No live matches during judging | Demo video is the deliverable. Prepare a TxLINE replay / recorded run so the walkthrough is flawless regardless of live activity. |
| Competing with Polymarket/Kalshi head-on | We don't. We win the social/consumer layer they ignore, wrapped in the "unriggable data" narrative the Spotify scandal just handed us. |

---

## 13. Project structure (monorepo)

Single **pnpm + Turborepo** monorepo. One place, three deployables (web, ingest worker, Anchor program) sharing typed contracts. Full rationale in `ARCHITECTURE.md` / `TECH-STACK.md`.

```
kick.fun/
├─ docs/                      # foundation docs (this PRD + ARCHITECTURE, TECH-STACK, SMART-CONTRACT, INTEGRATIONS, ERD)
├─ apps/
│  ├─ web/                    # Next.js 16 PWA (App Router) — the fan-facing product
│  └─ ingest/                 # Node worker: TxLINE SSE → props/results/Oracle → Supabase + settle triggers
├─ programs/
│  └─ kick-settlement/        # Anchor 1.0 program: proof verify + points settle + results anchor + sponsor-pot claim
├─ packages/
│  ├─ txline-client/          # typed TxLINE REST + SSE client (auth, fixtures, scores, odds, proofs)
│  ├─ program-client/         # Codama-generated @solana/kit client for kick-settlement
│  ├─ oracle/                 # Oracle trigger engine: event → template → TTS (provider-agnostic)
│  ├─ shared/                 # zod schemas, domain types, prop/finality logic (shared web + ingest)
│  └─ ui/                     # shadcn/ui components, brand tokens, motion primitives
├─ supabase/                  # SQL migrations, RLS policies, Realtime config (see ERD.md)
├─ turbo.json  pnpm-workspace.yaml  .env.example
```

Boundary rule: **all match logic (prop generation, result detection, finality gate) lives in `packages/shared`** so web and ingest never diverge, and settlement math is unit-testable without the chain or the network.

---

## 14. Brainstorm & future bets (parking lot — NOT in hackathon scope)

Ideas worth capturing so they're not lost, explicitly deferred so they don't threaten the frozen MVP. Ranked by conviction.

**High conviction — natural v2:**
- **Momentum meter → tradeable instrument.** Convert TxLINE live odds into a live win-probability % and let users take a position that settles at full-time off the proof. The only genuinely-novel instrument in the space (perps today are on price, not sports probability). High ceiling; deferred because perp mechanics are a project unto themselves. This is the "go big" pivot if KICK.FUN ever needs one.
- **AI Oracle as a standalone Telegram bot.** The Oracle detached from a room — subscribe to a match, it DMs voice/text on every goal, card, big odds move. Cheap distribution, viral, and a second front door into KICK.FUN. Could even ship post-hackathon in days.
- **Rivalry rooms / brackets across friend groups.** Group-vs-group leaderboards, city-vs-city, subreddit-vs-subreddit. Turns the social wedge into a growth loop.

**Medium conviction — test after launch:**
- **Predictions as a shareable "call your shot" NFT/receipt** minted before the event, revealed after. The brag object becomes collectible.
- **Creator/streamer terraces.** A streamer hosts a public terrace; their audience plays along live. Built-in influencer distribution.
- **Cross-match parlays for points** — string predictions across several matches for streak multipliers.

**Low conviction / watch-only:**
- **Mainnet real-money pools** — only behind a licensed operator (regulatory). Stays v2+, B2B-only.
- **Token/points-token economy** — regulatory + AI-slop risk. Avoid unless there's a real reason.
- **Other sports (NBA, NFL) via the same TxLINE schema** — the single normalized schema makes this near-free later; irrelevant during a World-Cup-only hackathon.

**Rule:** nothing here enters the build before the §9 MVP is flawless and submitted. Capture, don't chase.

---

## 15. Things to consider — open questions & how we harness this idea

Honest tensions and unknowns, each with a working answer and a trigger for revisiting. This is where we pressure-test our own thesis.

### 15.1 Open questions to resolve (Day 1–2, in TxLINE Telegram / testing)

| # | Question | Why it matters | Default assumption if unanswered |
| --- | --- | --- | --- |
| Q1 | Exact **proof format** (Merkle path? ed25519 signature? both?) | Sets which rung of the fallback ladder (§6.3) we build; drives the whole Anchor design | Assume ed25519-signed payload → build rung 3 (off-chain verify + on-chain hash anchor), upgrade if it's Merkle |
| Q2 | Does **Fixtures** return the full 104-match schedule + team names + kickoff times up front? | The lobby (§7.2) and room creation depend on it | Assume yes; cache a static fallback schedule if the endpoint is thin |
| Q3 | **SSE stream** granularity: per-event push (goal/card) or periodic snapshot diffs? | Determines prop-settlement latency + Oracle trigger design | Assume periodic snapshot diffs; diff two snapshots to detect events |
| Q4 | Does the free tier permit **replay** of a completed match on demand? | The entire demo depends on replaying a real match as "live" | Assume yes (docs mention historical replay); fallback = record one real match ourselves and replay from our own capture |
| Q5 | Rate/connection limits on **concurrent SSE** subscriptions | Affects whether ingest fans out one connection to many rooms | Assume 1 upstream connection per match, fanned out via Supabase Realtime |
| Q6 | Is there a real **subscription/gas cost** on devnet for the `subscribe` instruction? | Affects onboarding flow if each user must subscribe | Assume the app (one service keypair) holds the TxLINE subscription, not each user |

### 15.2 Design tensions we're deliberately resolving one way

- **Proof is judge-facing, not fan-facing.** Fans don't fear a rigged free game. We harness this by making the **Oracle speak the proof** (turns a boring badge into a punchline) and by riding the **Spotify "faked data" scandal** so "provably real" attaches to a pain fans just read about in the news. Revisit if playtesters still shrug at the proof surface.
- **Points can't be cash, or it's gambling.** Non-cashable points remove all custody/gambling liability but weaken the "why do I care" hook. We harness it via **status + cosmetics + tournament rank + sponsor prizes** — glory and access, not a wallet. Revisit only for a licensed mainnet v2.
- **Sponsor pot is the only real money on screen.** It gives the demo genuine on-chain settlement stakes without any player wagering. If no sponsor is attached, a room is pure points — still fully playable. The pot is a **demoable business model**, not a dependency.
- **SL1 delay is a feature, not a bug.** We settle off the 60s-delayed tier so no one can "predict the past" and VAR reversals resolve first. Framed as a deliberate fairness margin.
- **Solo scope is the #1 killer.** Every "wouldn't it be cool" goes to §14, not the build. The Oracle stays templated (not LLM) until the core loop is flawless. Season League stays a mockup.

### 15.3 How we harness this idea to actually win (the meta-strategy)

1. **Build the thing TxODDS screenshots in a sales deck.** Judges are betting-data pros. Make TxLINE look fast, verifiable, and consumer-magical. Every demo beat showcases *their* data doing something delightful.
2. **Attach to live news.** The Spotify manipulation scandal (July 3) is a gift — it makes "unriggable data" a headline, not a lecture. Lead the submission with it while it's hot.
3. **Win on taste, not scope.** Consumer track is judged on UX/originality/polish. A single flawless, beautiful loop with sound (the Oracle) beats a sprawling half-built platform. Design is the moat here.
4. **Make the demo the product.** 60% of the grade is the video. We design the 5-minute narrative (§11) *first* and build backward from the shots we need.
5. **Answer "so what's the business" before they ask.** B2B white-label to sportsbooks (= TxODDS's customers) + brand-funded pools. The money slide flatters the judges' own business model.
6. **Show, don't tell, the on-chain part.** One real proof-verified settlement + one sponsor-pot claim, tappable and live on devnet, beats any amount of "we plan to." Working > polished-but-fake (the Colosseum winner pattern).

---

_Build one thing, make it provably real, make it feel like watching with friends — and let the Oracle do the shouting. That's the whole game._
