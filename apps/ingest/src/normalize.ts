import type { MatchPhase, MatchState } from "@kick/shared";
import type { TxLineFixtureRow } from "./db.js";

/* ── TxLINE payload normalization ──
   Shared by the live poll loop (main.ts) and the finals backfill
   (scripts/backfill-finals.ts) so the two can never drift.

   ── Scores snapshot (confirmed live July 6-7 2026, probe scripts) ──
   GET /api/scores/snapshot/{id} returns an ARRAY of update rows, one per
   action kind (kickoff, goal, corner, status, game_finalised, ...), NOT a
   single flat object. FINISHED fixtures keep their full history on SL1
   (probed July 7: 36-44 rows incl. StatusId=100 game_finalised), so final
   scores are backfillable after the fact. The per-row string `GameState` is
   stale ("scheduled" even on finished matches); the live phase signal is the
   integer `StatusId`:
     1 = pre-match      (jersey/pitch/warm-up rows, clock stopped at 0)
     2 = first half     (var rows at clock 643s/715s)
     3 = half time      (halftime_finalised)
     4 = second half    (clock 45:00+..)
     5 = full time      (status/clock_adjustment rows, clock stopped at 0)
   100 = finalised      (game_finalised / disconnected)
   Scores + corners live in `Score.ParticipantN.Total`. CAUTION (probed July
   7, fixture 18198205): the newest Score row can be PARTIAL, carrying only
   one participant. Totals must be merged latest-per-participant, never read
   off a single row. */

export const PHASE_BY_STATUS_ID: Record<number, MatchPhase> = {
  1: "pre",
  2: "first_half",
  3: "half_time",
  4: "second_half",
  5: "full_time",
  100: "full_time",
};

interface ScoreTotals {
  Total?: { Goals?: number; Corners?: number };
}
export interface ScoresUpdateRow {
  Ts?: number;
  StatusId?: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: { Participant1?: ScoreTotals; Participant2?: ScoreTotals };
}

export function normalizeScores(fix: TxLineFixtureRow, raw: unknown, asOf: number): MatchState {
  const rows = (Array.isArray(raw) ? raw : raw ? [raw] : []) as ScoresUpdateRow[];
  const latest = (pick: (r: ScoresUpdateRow) => boolean): ScoresUpdateRow | undefined =>
    rows.filter(pick).sort((a, b) => (b.Ts ?? 0) - (a.Ts ?? 0))[0];

  const phaseRow = latest((r) => typeof r.StatusId === "number");
  const clockRow = latest((r) => typeof r.Clock?.Seconds === "number");
  // Latest totals per participant SEPARATELY: the newest Score row may only
  // carry one side (see module header), so a single-row read drops goals.
  const p1 = latest((r) => r.Score?.Participant1?.Total !== undefined)?.Score?.Participant1?.Total;
  const p2 = latest((r) => r.Score?.Participant2?.Total !== undefined)?.Score?.Participant2?.Total;

  // Phase from the newest StatusId; kickoff-time fallback when the feed has
  // no status rows yet (upcoming fixtures serve only comment/coverage rows).
  let phase = phaseRow ? PHASE_BY_STATUS_ID[phaseRow.StatusId!] : undefined;
  if (!phase) {
    const kickoffMs = fix.StartTime > 1e12 ? fix.StartTime : fix.StartTime * 1000;
    if (kickoffMs > asOf) phase = "pre";
    else phase = asOf - kickoffMs > 3 * 3_600_000 ? "full_time" : "first_half";
  }

  const [homeT, awayT] = fix.Participant1IsHome ? [p1, p2] : [p2, p1];

  return {
    fixtureId: fix.FixtureId,
    home: fix.Participant1IsHome ? fix.Participant1 : fix.Participant2,
    away: fix.Participant1IsHome ? fix.Participant2 : fix.Participant1,
    homeScore: homeT?.Goals ?? 0,
    awayScore: awayT?.Goals ?? 0,
    phase,
    clockSeconds: clockRow?.Clock?.Seconds ?? null,
    stats: {
      corners_home: homeT?.Corners ?? 0,
      corners_away: awayT?.Corners ?? 0,
    },
    asOf,
  };
}

/* ── Odds snapshot (confirmed live July 7 2026, scratchpad probe) ──
   GET /api/odds/snapshot/{id} returns an ARRAY of StablePrice rows, one per
   (SuperOddsType, MarketPeriod, MarketParameters) market. FINISHED fixtures
   return []. Row shape observed on fixture 18202701:
     {
       FixtureId, MessageId, Ts,
       Bookmaker: "TXLineStablePriceDemargined", BookmakerId: 10021,
       SuperOddsType: "1X2_PARTICIPANT_RESULT" | "ASIANHANDICAP_..." | ...,
       MarketPeriod: null (full time) | "half=1",
       MarketParameters: null | "line=-0.5",
       PriceNames: ["part1","draw","part2"],
       Prices: [1363, 5397, 12400],          // decimal odds x1000
       Pct: ["73.368","18.529","8.065"]      // implied %, or "NA"
     }
   Mapping to implied home win probability:
     market  = newest-Ts row with SuperOddsType 1X2_PARTICIPANT_RESULT and
               MarketPeriod null (the full-match market; "half=1" is 1H only)
     partKey = "part1" when Participant1 is home, else "part2"
     implied = Pct[index of partKey] / 100; when Pct is "NA", fall back to
               1000 / Prices[i] (prices are demargined, so 1/odds is fair). */

interface OddsRow {
  Ts?: number;
  SuperOddsType?: string;
  MarketPeriod?: string | null;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
}

export function impliedHomeFromOdds(raw: unknown, participant1IsHome: boolean): number | undefined {
  const rows = (Array.isArray(raw) ? raw : []) as OddsRow[];
  const market = rows
    .filter((r) => r.SuperOddsType === "1X2_PARTICIPANT_RESULT" && (r.MarketPeriod === null || r.MarketPeriod === undefined))
    .sort((a, b) => (b.Ts ?? 0) - (a.Ts ?? 0))[0];
  if (!market?.PriceNames) return undefined;
  const i = market.PriceNames.indexOf(participant1IsHome ? "part1" : "part2");
  if (i < 0) return undefined;
  const pct = Number(market.Pct?.[i]);
  if (Number.isFinite(pct) && pct > 0) return pct / 100;
  const price = market.Prices?.[i];
  if (typeof price === "number" && price > 1000) return 1000 / price;
  return undefined;
}
