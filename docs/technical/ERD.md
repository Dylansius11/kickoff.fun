# KICK.FUN — Data Model (ERD)

_Off-chain (Supabase Postgres) is the live product state; on-chain (Anchor accounts) is the notary + vault. The `room_id` uuid bridges them._

Companion docs: `ARCHITECTURE.md`, `SMART-CONTRACT.md` (on-chain accounts), `INTEGRATIONS.md`.

---

## 1. Entity-relationship diagram (off-chain)

```mermaid
erDiagram
    USER ||--o{ ROOM_MEMBER : joins
    USER ||--o{ PICK : makes
    USER ||--o{ INVENTORY : owns
    USER ||--o{ POINTS_LEDGER : earns

    FIXTURE ||--o{ ROOM : hosts
    ROOM ||--o{ ROOM_MEMBER : has
    ROOM ||--o{ PROP : contains
    ROOM ||--o{ ORACLE_EVENT : narrates
    ROOM ||--o| SPONSOR_POT : may_have

    PROP ||--o{ PICK : receives
    COSMETIC ||--o{ INVENTORY : unlocked_as

    USER {
      uuid id PK
      text privy_id UK "Privy user id"
      text wallet_pubkey "embedded/linked Solana wallet"
      text handle
      text avatar_url
      int tournament_points "denormalized running total"
      timestamptz created_at
    }

    FIXTURE {
      bigint id PK "TxLINE fixture id"
      text home_team
      text away_team
      text group_round
      timestamptz kickoff_at
      text status "upcoming|live|final"
      jsonb last_snapshot "latest scores/odds cache"
    }

    ROOM {
      uuid id PK "room_id — bridges on-chain"
      bigint fixture_id FK
      uuid host_user_id FK
      text room_code UK "join code"
      text status "open|live|settling|settled"
      text visibility "private|public|sponsored"
      text onchain_room_pda "Room PDA address (nullable)"
      text results_hash "hex of anchored final standings"
      text settle_tx_sig "receipt"
      timestamptz created_at
    }

    ROOM_MEMBER {
      uuid id PK
      uuid room_id FK
      uuid user_id FK
      int points "points in THIS room"
      int streak
      int rank "denormalized"
      timestamptz joined_at
    }

    PROP {
      uuid id PK
      uuid room_id FK
      text type "next_scorer|card_half|goal_band|ht_score|corners_ou|shots_ou"
      jsonb options "choices + live odds"
      text state "open|locked|under_review|settled"
      jsonb resolution "winning option + source event"
      timestamptz opens_at
      timestamptz locks_at
      timestamptz settled_at
    }

    PICK {
      uuid id PK
      uuid prop_id FK
      uuid user_id FK
      uuid room_id FK "denormalized for query speed"
      text choice
      int points_awarded
      bool is_correct
      text settle_state "pending|settled|voided"
      timestamptz created_at
    }

    POINTS_LEDGER {
      uuid id PK
      uuid user_id FK
      uuid room_id FK
      uuid pick_id FK "nullable (bonuses)"
      int delta
      text reason "correct_pick|streak_bonus|cosmetic_spend|..."
      timestamptz created_at
    }

    COSMETIC {
      uuid id PK
      text kind "oracle_voice|room_theme|card_skin|avatar|badge"
      text name
      int points_cost "0 if paid-only"
      int price_cents "null if points-only"
    }

    INVENTORY {
      uuid id PK
      uuid user_id FK
      uuid cosmetic_id FK
      text unlocked_via "points|purchase|reward"
      timestamptz created_at
    }

    ORACLE_EVENT {
      uuid id PK
      uuid room_id FK
      text type "goal|card|odds_swing|settlement|var"
      text line "spoken text"
      text audio_ref "cached TTS url (nullable)"
      timestamptz created_at
    }

    SPONSOR_POT {
      uuid id PK
      uuid room_id FK UK
      text sponsor_name
      text mint "devnet USDC mint"
      bigint amount "base units"
      text vault_pda
      text fund_tx_sig
      text claim_tx_sig "nullable until claimed"
      uuid winner_user_id FK "nullable until settled"
      text status "unfunded|funded|settled|claimed"
    }
```

---

## 2. On-chain ↔ off-chain bridge

| Off-chain (Postgres) | On-chain (Anchor, `SMART-CONTRACT.md`) | Link |
| --- | --- | --- |
| `ROOM.id` (uuid) | `Room.room_id` ([u8;16]) | same uuid bytes |
| `ROOM.results_hash` | `Room.results_hash` ([u8;32]) | worker computes hash of final standings, anchors it |
| `ROOM.settle_tx_sig` | `RoomSettled` event tx | the receipt shown in UI (PRD §7.7) |
| `SPONSOR_POT.vault_pda` | `PotVault` PDA | seeds `["vault", room_id]` |
| `SPONSOR_POT.winner_user_id` → wallet | `Room.winner` (Pubkey) | winner's wallet pubkey |
| `USER.wallet_pubkey` | signer of `claim_pot` | Privy/embedded wallet |

**Source of truth:** for _money + match outcome_, the chain wins (proof-verified, anchored). For _live product state_ (props, points, leaderboard), Postgres wins and the chain only anchors the final hash. See the honest trust model in `SMART-CONTRACT.md §6`.

---

## 3. Key relationships & rules

- **USER ↔ ROOM_MEMBER ↔ ROOM:** many-to-many via `ROOM_MEMBER`; a user's points are **per-room** (`ROOM_MEMBER.points`) and aggregated into `USER.tournament_points` for the global leaderboard.
- **PROP → PICK:** one prop, many picks (one per member). `PICK` uniqueness: `(prop_id, user_id)`.
- **Leaderboard:** per-room = order `ROOM_MEMBER` by `points`; tournament = order `USER` by `tournament_points`. `POINTS_LEDGER` is the append-only audit trail (never mutate points directly — insert a ledger row, trigger updates the denormalized totals).
- **Winner:** at settlement the worker reads the final per-room leaderboard, sets `SPONSOR_POT.winner_user_id`, and passes that wallet to `settle_room`.
- **Non-cashable points:** points live only in Postgres; there is **no token, no on-chain points balance** (PRD §7.6, TECH-STACK §3). Cosmetic spends are `POINTS_LEDGER` debits.

---

## 4. Realtime channels (Supabase)

| Channel | Payload | Subscribers |
| --- | --- | --- |
| `room:{id}:props` | prop open/lock/under_review/settled | room clients |
| `room:{id}:scores` | score/clock updates | room clients |
| `room:{id}:leaderboard` | member points/rank deltas | room clients |
| `room:{id}:oracle` | new `ORACLE_EVENT` (line + audio ref) | room clients |
| `room:{id}:pot` | pot funded/settled/claimed | room clients |

Worker writes rows → Postgres change feeds publish to the channel → clients animate (ARCHITECTURE §7.1).

---

## 5. Row-Level Security (RLS) posture

- **USER:** a user reads/updates only their own row.
- **ROOM / ROOM_MEMBER / PROP / PICK / ORACLE_EVENT:** readable by members of that room; writable only by the **service role** (the worker). Clients never write game state directly — they call server actions that validate membership.
- **PICK insert:** allowed for a member only while the prop is `open` and before `locks_at` (enforced in a server action + DB check, not client trust).
- **INVENTORY / POINTS_LEDGER:** service-role writes only; user reads own rows.
- **SPONSOR_POT:** read by room members; writes service-role only (mirrors on-chain truth).

---

## 6. Indexes & performance (see supabase-postgres-best-practices)

- `ROOM_MEMBER (room_id, points DESC)` — leaderboard.
- `PICK (prop_id)`, `PICK (user_id, room_id)` — settlement + user history.
- `PROP (room_id, state)` — active cards in a room.
- `USER (tournament_points DESC)` — global rank.
- `FIXTURE (kickoff_at, status)` — lobby.
- Denormalize `ROOM_MEMBER.rank` and `USER.tournament_points` via triggers off `POINTS_LEDGER` to keep reads O(1); ledger stays the audit source.

---

## 7. Minimal seed for the demo

- 1 `FIXTURE` (a real group-stage match to replay, e.g. France–Senegal).
- 1 `ROOM` (sponsored), `room_code` shareable.
- 4–6 `USER` + `ROOM_MEMBER` (demo friends).
- 3 `PROP` types wired to the replay feed.
- 1 `SPONSOR_POT` funded on devnet.
- Cosmetics: 2 free (points) Oracle voices + 1 premium, to show the unlock.

---

_Postgres holds the roar; the chain holds the receipt. One uuid ties them together._
