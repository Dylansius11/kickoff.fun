/* ── KICK.FUN ingest worker ──
   The engine: TxLINE in, normalized events + Oracle lines + props out.
   MVP loop (poll-based; SSE swap-in once stream paths are confirmed):
     fixtures -> pick active/next fixture -> poll scores snapshot ->
     normalize -> diff -> finality gate -> oracle line + props engine ->
     Supabase + stdout
   Persistence (apps/ingest/src/db.ts): fixtures upsert on boot, snapshot +
   status per poll, oracle_events fan-out per line, props/picks/points via
   the props engine (apps/ingest/src/props.ts). Snapshot/oracle writes are
   fire-and-forget; the props engine awaits its writes (they carry points and
   must stay ordered) but every helper is non-throwing, so a Supabase outage
   never stalls the poll loop.

   Run: pnpm --filter @kick/ingest dev
   (env auto-loads from the repo-root .env; TXLINE_JWT optional, the worker
   acquires a fresh guest JWT if missing. INGEST_MAX_TICKS=N exits after N
   polls, for smoke tests. INGEST_SIM=1 runs DEMO MODE: a scripted local
   fixture, no TxLINE, sped up INGEST_SIM_SPEED x (default 10) so the whole
   prop lifecycle plays out in under a minute.) */

import { loadRootEnv } from "./env.js";
loadRootEnv();

import { TxLineClient } from "@kick/txline-client";
import { diffStates, judge, type Candidate, type MatchEvent, type MatchPhase, type MatchState } from "@kick/shared";
import { speak } from "@kick/oracle";
import {
  ensureSimFixtureAndRoom,
  insertOracleEvent,
  statusFromFixture,
  updateFixtureSnapshot,
  upsertFixtures,
  type TxLineFixtureRow,
} from "./db.js";
import { PropsEngine } from "./props.js";
import { SIM_AWAY, SIM_FIXTURE_ID, SIM_HOME, SIM_ROOM_CODE, simStateAt } from "./sim.js";

const BASE = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
const POLL_MS = Number(process.env.INGEST_POLL_MS ?? 15_000);
const MAX_TICKS = Number(process.env.INGEST_MAX_TICKS ?? 0); // 0 = run forever
const SIM = process.env.INGEST_SIM === "1";
const SIM_SPEED = Math.max(1, Number(process.env.INGEST_SIM_SPEED ?? 10));

/** One polled reading: the normalized state plus, when the odds stream
    flows, the home side's implied win probability (feeds odds_swing props). */
interface Reading {
  state: MatchState;
  impliedHome?: number;
}

interface Source {
  fixtureId: number;
  label: string;
  /** Wall-clock compression for locks + finality buffer (sim only). */
  timeScale: number;
  read: (now: number) => Promise<Reading>;
}

/* ── Scores snapshot payload (confirmed live July 6 2026, probe scripts) ──
   /api/scores/snapshot/{id} returns an ARRAY of update rows, one per action
   kind (kickoff, goal, corner, status, game_finalised, ...), NOT a single
   flat object. The per-row string `GameState` is stale ("scheduled" even on
   finished matches); the live phase signal is the integer `StatusId`:
     1 = pre-match      (jersey/pitch/warm-up rows, clock stopped at 0)
     2 = first half     (var rows at clock 643s/715s)
     3 = half time      (halftime_finalised)
     4 = second half    (clock 45:00+..)
     5 = full time      (status/clock_adjustment rows, clock stopped at 0)
   100 = finalised      (game_finalised / disconnected)
   Scores + corners live in `Score.ParticipantN.Total`. */
const PHASE_BY_STATUS_ID: Record<number, MatchPhase> = {
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
interface ScoresUpdateRow {
  Ts?: number;
  StatusId?: number;
  Clock?: { Running?: boolean; Seconds?: number };
  Score?: { Participant1?: ScoreTotals; Participant2?: ScoreTotals };
}

function normalize(fix: TxLineFixtureRow, raw: unknown, asOf: number): MatchState {
  const rows = (Array.isArray(raw) ? raw : raw ? [raw] : []) as ScoresUpdateRow[];
  const latest = (pick: (r: ScoresUpdateRow) => boolean): ScoresUpdateRow | undefined =>
    rows.filter(pick).sort((a, b) => (b.Ts ?? 0) - (a.Ts ?? 0))[0];

  const phaseRow = latest((r) => typeof r.StatusId === "number");
  const scoreRow = latest((r) => r.Score !== undefined);
  const clockRow = latest((r) => typeof r.Clock?.Seconds === "number");

  // Phase from the newest StatusId; kickoff-time fallback when the feed has
  // no status rows yet (upcoming fixtures serve only comment/coverage rows).
  let phase = phaseRow ? PHASE_BY_STATUS_ID[phaseRow.StatusId!] : undefined;
  if (!phase) {
    const kickoffMs = fix.StartTime > 1e12 ? fix.StartTime : fix.StartTime * 1000;
    if (kickoffMs > asOf) phase = "pre";
    else phase = asOf - kickoffMs > 3 * 3_600_000 ? "full_time" : "first_half";
  }

  const p1 = scoreRow?.Score?.Participant1?.Total;
  const p2 = scoreRow?.Score?.Participant2?.Total;
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

/* Fire-and-forget persistence: log, never throw, never await in the loop. */
function persist<T>(label: string, p: Promise<T>): void {
  p.catch((err: unknown) => console.error(`[db] ${label} rejected:`, err instanceof Error ? err.message : err));
}

async function liveSource(): Promise<Source> {
  const client = new TxLineClient({
    baseUrl: BASE,
    jwt: process.env.TXLINE_JWT,
    apiToken: process.env.TXLINE_API_TOKEN,
  });
  if (!client["jwt" as never]) {
    await client.startGuestSession();
    console.log("[auth] fresh guest JWT acquired");
  }
  console.log(`[ingest] up against ${BASE}, poll every ${POLL_MS}ms`);

  const fixtures = (await client.fixtures({ startEpochDay: epochDayToday() })) as TxLineFixtureRow[];
  console.log(`[fixtures] ${fixtures.length} World Cup fixtures loaded`);
  const written = await upsertFixtures(fixtures);
  if (written > 0) console.log(`[db] ${written} fixtures upserted`);

  // Watch the match that matters: a live one first, else the next kickoff.
  // Never camp on a finished fixture (the old sort-and-take-first did, which
  // is how a fixture stayed "live" in the UI long after full time).
  const sorted = fixtures.sort((a, b) => a.StartTime - b.StartTime);
  const target =
    sorted.find((f) => statusFromFixture(f) === "live") ??
    sorted.find((f) => statusFromFixture(f) === "upcoming") ??
    sorted[sorted.length - 1];
  if (!target) throw new Error("no fixtures returned");
  return {
    fixtureId: target.FixtureId,
    label: `${target.Participant1} v ${target.Participant2} (fixture ${target.FixtureId})`,
    timeScale: 1,
    read: async (now) => {
      const raw = await client.scoresSnapshot(target.FixtureId);
      // impliedHome: TODO(odds stream) wire the StablePrice odds snapshot in
      // here; until then live odds_swing props simply never trigger.
      return { state: normalize(target, raw, now) };
    },
  };
}

async function simSource(): Promise<Source> {
  const roomId = await ensureSimFixtureAndRoom({
    fixtureId: SIM_FIXTURE_ID,
    home: SIM_HOME,
    away: SIM_AWAY,
    roomCode: SIM_ROOM_CODE,
  });
  console.log(
    roomId
      ? `[sim] fixture ${SIM_FIXTURE_ID} + room ${SIM_ROOM_CODE} (${roomId}) ready, ${SIM_SPEED}x speed`
      : "[sim] Supabase unavailable; running log-only",
  );
  const startedAt = Date.now();
  return {
    fixtureId: SIM_FIXTURE_ID,
    label: `${SIM_HOME} v ${SIM_AWAY} (SIM fixture ${SIM_FIXTURE_ID})`,
    timeScale: SIM_SPEED,
    read: async (now) => simStateAt(((now - startedAt) / 1000) * SIM_SPEED, now),
  };
}

async function main() {
  const src = SIM ? await simSource() : await liveSource();
  console.log(`[watch] ${src.label}`);

  const engine = new PropsEngine({
    fixtureId: src.fixtureId,
    timeScale: src.timeScale,
    exactScoreProps: process.env.INGEST_EXACT_SCORE_PROPS === "1",
  });

  let prev: MatchState | null = null;
  const pending: Candidate[] = [];
  const history: MatchEvent[] = [];

  for (let tick = 1; ; tick++) {
    try {
      const now = Date.now();
      const { state, impliedHome } = await src.read(now);

      persist(`updateFixtureSnapshot(${src.fixtureId})`, updateFixtureSnapshot(src.fixtureId, state));

      const events = prev ? diffStates(prev, state) : [];
      for (const ev of events) {
        history.push(ev);
        console.log(`[event] ${ev.type} ${ev.side ?? ""}`);
        if (ev.type === "goal") pending.push({ key: `goal:${ev.side}:${now}`, event: ev, seenAt: now });
        const line = speak(ev, { homeTeam: state.home, awayTeam: state.away });
        if (line) {
          console.log(`[oracle:${line.persona}] ${line.text}`);
          persist("insertOracleEvent", insertOracleEvent(src.fixtureId, ev.type, line.text));
        }
      }

      // props lifecycle: generate, lock, settle, award points. Awaited: the
      // writes carry points and must stay ordered; every helper inside is
      // non-throwing, so this cannot kill the loop.
      await engine.onTick(state, events, now, impliedHome);

      // finality gate pass (Oracle settlement lines; props run their own)
      for (let i = pending.length - 1; i >= 0; i--) {
        const verdict = judge(pending[i]!, history, now, 90_000 / src.timeScale);
        if (verdict !== "pending") {
          console.log(`[finality] ${pending[i]!.key} -> ${verdict}`);
          if (verdict === "final") {
            const line = speak({ type: "settlement", asOf: now });
            if (line) {
              console.log(`[oracle] ${line.text}`);
              persist("insertOracleEvent", insertOracleEvent(src.fixtureId, "settlement", line.text));
            }
            // TODO: submit settle_room via program client at full time.
          }
          pending.splice(i, 1);
        }
      }

      prev = state;
    } catch (err) {
      console.error("[poll error]", err instanceof Error ? err.message : err);
    }
    if (MAX_TICKS > 0 && tick >= MAX_TICKS) {
      console.log(`[ingest] INGEST_MAX_TICKS=${MAX_TICKS} reached, exiting`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function epochDayToday(): number {
  return Math.floor(Date.now() / 86_400_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
