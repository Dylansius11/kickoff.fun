import { z } from "zod";

/* ── Domain types shared by web + ingest. Single source of truth. ──
   TxLINE payload schemas live in @kick/txline-client; these are OUR
   normalized shapes after ingest. */

export const MatchPhase = z.enum([
  "pre",
  "first_half",
  "half_time",
  "second_half",
  "extra_time",
  "penalties",
  "full_time",
]);
export type MatchPhase = z.infer<typeof MatchPhase>;

export const MatchState = z.object({
  fixtureId: z.number().int(),
  home: z.string(),
  away: z.string(),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  phase: MatchPhase,
  /// Match clock in seconds since kickoff of the current period.
  clockSeconds: z.number().int().nonnegative().nullable(),
  /// Stat counters used by props (corners, shots, cards ...).
  stats: z.record(z.string(), z.number().int()).default({}),
  /// Wall-clock time of the snapshot this state was derived from.
  asOf: z.number().int(),
});
export type MatchState = z.infer<typeof MatchState>;

export const MatchEventType = z.enum([
  "goal",
  "goal_disallowed",
  "yellow_card",
  "red_card",
  "corner",
  "kickoff",
  "half_time",
  "full_time",
  "odds_swing",
]);
export type MatchEventType = z.infer<typeof MatchEventType>;

export const MatchEvent = z.object({
  type: MatchEventType,
  fixtureId: z.number().int(),
  /// "home" | "away" | null for neutral events
  side: z.enum(["home", "away"]).nullable(),
  /// player name when known
  player: z.string().nullable(),
  /// seconds since kickoff when it happened, if known
  clockSeconds: z.number().int().nullable(),
  /// for odds_swing: implied probability delta in percentage points
  delta: z.number().nullable(),
  asOf: z.number().int(),
});
export type MatchEvent = z.infer<typeof MatchEvent>;

export const PropType = z.enum([
  "next_scorer_side",
  "card_this_half",
  "goal_before",
  "ht_score_band",
  "corners_over_under",
]);
export type PropType = z.infer<typeof PropType>;

export const PropState = z.enum(["open", "locked", "under_review", "settled", "voided"]);
export type PropState = z.infer<typeof PropState>;

export const Prop = z.object({
  id: z.string(),
  roomId: z.string(),
  fixtureId: z.number().int(),
  type: PropType,
  prompt: z.string(),
  options: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      odds: z.number().nullable(),
    }),
  ),
  state: PropState,
  opensAt: z.number().int(),
  locksAt: z.number().int(),
  /// winning option key once settled
  resolution: z.string().nullable(),
  points: z.number().int().default(50),
});
export type Prop = z.infer<typeof Prop>;

export const OracleTrigger = z.enum(["goal", "card", "odds_swing", "settlement", "var_hold"]);
export type OracleTrigger = z.infer<typeof OracleTrigger>;
