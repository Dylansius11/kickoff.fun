import type { MatchEvent, MatchState } from "./types.js";

/* ── Snapshot diff engine ──
   TxLINE streams may be snapshot-based (open question Q3). Deriving events by
   diffing consecutive normalized states makes ingest agnostic to push-vs-poll,
   and makes the whole pipeline replayable + unit-testable. */

export function diffStates(prev: MatchState, next: MatchState): MatchEvent[] {
  const events: MatchEvent[] = [];
  const base = { fixtureId: next.fixtureId, player: null, clockSeconds: next.clockSeconds, delta: null, asOf: next.asOf };

  if (next.homeScore > prev.homeScore) events.push({ ...base, type: "goal", side: "home" });
  if (next.awayScore > prev.awayScore) events.push({ ...base, type: "goal", side: "away" });
  // VAR reversal: a score DECREASE means an earlier goal was chalked off.
  if (next.homeScore < prev.homeScore) events.push({ ...base, type: "goal_disallowed", side: "home" });
  if (next.awayScore < prev.awayScore) events.push({ ...base, type: "goal_disallowed", side: "away" });

  for (const [key, evType] of [
    ["yellow_cards_home", "yellow_card"],
    ["yellow_cards_away", "yellow_card"],
    ["red_cards_home", "red_card"],
    ["red_cards_away", "red_card"],
    ["corners_home", "corner"],
    ["corners_away", "corner"],
  ] as const) {
    const d = (next.stats[key] ?? 0) - (prev.stats[key] ?? 0);
    if (d > 0) {
      const side = key.endsWith("_home") ? "home" : "away";
      for (let i = 0; i < d; i++) events.push({ ...base, type: evType, side });
    }
  }

  if (prev.phase !== next.phase) {
    if (next.phase === "first_half") events.push({ ...base, type: "kickoff", side: null });
    if (next.phase === "half_time") events.push({ ...base, type: "half_time", side: null });
    if (next.phase === "full_time") events.push({ ...base, type: "full_time", side: null });
  }

  return events;
}

/* ── Odds swing detector ── flags moves the Oracle shouts about. */
export function detectOddsSwing(
  prevImplied: number,
  nextImplied: number,
  fixtureId: number,
  asOf: number,
  thresholdPp = 8,
): MatchEvent | null {
  const delta = (nextImplied - prevImplied) * 100;
  if (Math.abs(delta) < thresholdPp) return null;
  return {
    type: "odds_swing",
    fixtureId,
    side: null,
    player: null,
    clockSeconds: null,
    delta,
    asOf,
  };
}
