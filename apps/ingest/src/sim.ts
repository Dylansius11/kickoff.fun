/* ── DEMO MODE feed (INGEST_SIM=1) ──
   Synthesizes a fake live fixture locally so the whole engine (props, picks,
   points, Oracle) runs without a live match: critical for the demo video and
   for the web team to test against. The timeline is scripted in "sim
   seconds"; INGEST_SIM_SPEED compresses wall time (10x default means sim
   second 30 arrives 3 real seconds in). The engine's timeScale divides lock
   windows and the goal finality buffer by the same factor, so the full
   lifecycle (open -> locked -> settled) plays out inside a short run. */

import type { MatchState } from "@kick/shared";

export const SIM_FIXTURE_ID = 999001;
export const SIM_HOME = "Argentina";
export const SIM_AWAY = "France";
export const SIM_ROOM_CODE = "SIMKICK";

/* Scripted timeline, sim seconds since worker start:
   0 kickoff · 30 corner (home) · 75 goal (home) + odds jump · 120 yellow (home)
   270 half time · 300 second half · 330 corner (away) · 390 goal (away) · 480 full time */
const T = {
  cornerHome: 30,
  goalHome: 75,
  cardHome: 120,
  halfTime: 270,
  secondHalf: 300,
  cornerAway: 330,
  goalAway: 390,
  fullTime: 480,
} as const;

export function simStateAt(simSeconds: number, asOf: number): { state: MatchState; impliedHome: number } {
  const t = simSeconds;
  const phase =
    t >= T.fullTime ? "full_time" : t >= T.secondHalf ? "second_half" : t >= T.halfTime ? "half_time" : "first_half";
  const state: MatchState = {
    fixtureId: SIM_FIXTURE_ID,
    home: SIM_HOME,
    away: SIM_AWAY,
    homeScore: t >= T.goalHome ? 1 : 0,
    awayScore: t >= T.goalAway ? 1 : 0,
    phase,
    clockSeconds: Math.floor(Math.min(t, T.fullTime)),
    stats: {
      corners_home: t >= T.cornerHome ? 1 : 0,
      corners_away: t >= T.cornerAway ? 1 : 0,
      yellow_cards_home: t >= T.cardHome ? 1 : 0,
      yellow_cards_away: 0,
      red_cards_home: 0,
      red_cards_away: 0,
    },
    asOf,
  };
  // Home implied win probability: 0.50 baseline, jumps to 0.63 on the home
  // goal (a +13pp swing, above the 8pp detector threshold), eases to 0.58
  // after the away equalizer. Holding at 0.63 through the swing window is
  // what makes "Follow" the winning side in the demo.
  const impliedHome = t >= T.goalAway ? 0.58 : t >= T.goalHome ? 0.63 : 0.5;
  return { state, impliedHome };
}
