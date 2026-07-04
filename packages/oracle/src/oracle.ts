import type { MatchEvent } from "@kick/shared";

/* ── The Oracle: deterministic template engine ──
   MVP is templated on purpose (DESIGN spec): deterministic, fast, cheap,
   demo-safe. LLM color commentary is a stretch goal layered on top later.
   Every line is UI copy: NO em-dashes allowed (CLAUDE.md golden rule). */

export type Persona = "gaffer" | "announcer" | "analyst";

export interface OracleLine {
  trigger: string;
  text: string;
  persona: Persona;
  /// priority 0 = speak immediately (goal), 1 = queue, 2 = drop if busy
  priority: 0 | 1 | 2;
}

export interface OracleContext {
  /// name of a room member whose pick this event affected, if any
  heroName?: string;
  heroPoints?: number;
  wreckedCount?: number;
  homeTeam?: string;
  awayTeam?: string;
  newFavorite?: string;
}

type Template = (e: MatchEvent, c: OracleContext) => string;

const pick = (arr: string[], seed: number) => arr[seed % arr.length]!;

/* Variation without Math.random: seeded by event timestamp so replays are
   deterministic (same feed = same commentary = testable demo). */
const TEMPLATES: Record<Persona, Record<string, Template>> = {
  announcer: {
    goal: (e, c) =>
      pick(
        [
          `GOAL! ${side(e, c)} strike! ${hero(c)}`,
          `IT'S IN! ${side(e, c)} score! ${hero(c)}`,
          `GOOOAL! The terrace erupts for ${side(e, c)}! ${hero(c)}`,
        ],
        e.asOf,
      ),
    goal_disallowed: () => "Hold everything. VAR says NO GOAL. Points frozen while we sort this out.",
    red_card: (e, c) => `RED CARD! ${side(e, c)} down to ten. Clean sheet picks are sweating.`,
    yellow_card: (e, c) => `Booking for ${side(e, c)}. The card watchers just cashed in.`,
    corner: (e, c) => `Corner to ${side(e, c)}. Over-under players, eyes up.`,
    odds_swing: (e, c) =>
      `Whoa, the market just moved ${fmtDelta(e.delta)}. ${c.newFavorite ? `${c.newFavorite} now the favourite.` : "Big money is talking."}`,
    settlement: (_e, c) =>
      `That result is verified. Signed by TxLINE, locked on-chain. Nobody rigs this one. ${hero(c)}`,
    var_hold: () => "VAR check in progress. Your points are held until the call is final.",
    kickoff: () => "We are LIVE. Make your calls before the ball moves.",
    full_time: () => "Full time! Settling the table off the signed data now.",
  },
  gaffer: {
    goal: (e, c) => `That's a goal for ${side(e, c)}. Told you. ${hero(c)}`,
    goal_disallowed: () => "VAR's having a look. Nobody move.",
    red_card: (e, c) => `Red for ${side(e, c)}. Absolute madness out there.`,
    yellow_card: (e, c) => `Yellow for ${side(e, c)}. Soft, but it counts.`,
    corner: (e, c) => `Corner, ${side(e, c)}. Set piece merchants rejoice.`,
    odds_swing: (e) => `Market's flipped ${fmtDelta(e.delta)}. Somebody knows something.`,
    settlement: (_e, c) => `Verified on the chain. No arguments, no fix. ${hero(c)}`,
    var_hold: () => "Held by VAR. Patience.",
    kickoff: () => "Right then. Kickoff. Earn your points.",
    full_time: () => "That's full time. The table never lies.",
  },
  analyst: {
    goal: (e, c) => `Goal, ${side(e, c)}. Win probability just repriced sharply. ${hero(c)}`,
    goal_disallowed: () => "VAR intervention. Reverting the provisional settlement.",
    red_card: (e, c) => `Red card, ${side(e, c)}. Expect the odds to move now.`,
    yellow_card: (e, c) => `Caution, ${side(e, c)}. Logged.`,
    corner: (e, c) => `Corner ${side(e, c)}. Corner count props update.`,
    odds_swing: (e) => `Consensus odds moved ${fmtDelta(e.delta)} in one window. Notable.`,
    settlement: () => "Settlement verified against the TxLINE Merkle proof. Receipt anchored.",
    var_hold: () => "Result held pending finality gate.",
    kickoff: () => "Match live. Prop generation running.",
    full_time: () => "Full time. Finality gate closing, settlement imminent.",
  },
};

function side(e: MatchEvent, c: OracleContext): string {
  if (e.side === "home") return c.homeTeam ?? "the home side";
  if (e.side === "away") return c.awayTeam ?? "the away side";
  return "the pitch";
}

function hero(c: OracleContext): string {
  if (c.heroName && c.heroPoints)
    return `${c.heroName} called it, +${c.heroPoints}, top of the terrace!`;
  if (c.wreckedCount) return `${c.wreckedCount} picks just went up in smoke.`;
  return "";
}

function fmtDelta(delta: number | null): string {
  if (delta == null) return "hard";
  const pts = Math.abs(delta).toFixed(0);
  return `${pts} points ${delta > 0 ? "up" : "down"}`;
}

const TRIGGER_PRIORITY: Record<string, 0 | 1 | 2> = {
  goal: 0,
  goal_disallowed: 0,
  settlement: 0,
  red_card: 1,
  odds_swing: 1,
  var_hold: 1,
  full_time: 1,
  kickoff: 1,
  yellow_card: 2,
  corner: 2,
};

/** Main entry: event in, spoken line out (or null for non-triggers). */
export function speak(
  e: MatchEvent | { type: "settlement" | "var_hold"; asOf: number; side?: null; delta?: null },
  ctx: OracleContext = {},
  persona: Persona = "announcer",
): OracleLine | null {
  const table = TEMPLATES[persona];
  const tmpl = table[e.type];
  if (!tmpl) return null;
  const text = tmpl(e as MatchEvent, ctx).trim();
  return {
    trigger: e.type,
    text,
    persona,
    priority: TRIGGER_PRIORITY[e.type] ?? 2,
  };
}
