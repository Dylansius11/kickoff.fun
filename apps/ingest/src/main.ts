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
import { diffStates, judge, type Candidate, type MatchEvent, type MatchState } from "@kick/shared";
import { speak } from "@kick/oracle";
import { ensureSimFixtureAndRoom, insertOracleEvent, updateFixtureSnapshot, upsertFixtures, type TxLineFixtureRow } from "./db.js";
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

/* Normalize a raw TxLINE scores snapshot into our MatchState.
   NOTE: exact scores payload shape lands after the first live pull; the
   mapper is isolated here so fixing it is a one-function change. */
function normalize(fix: TxLineFixtureRow, raw: unknown, asOf: number): MatchState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : 0);
  return {
    fixtureId: fix.FixtureId,
    home: fix.Participant1IsHome ? fix.Participant1 : fix.Participant2,
    away: fix.Participant1IsHome ? fix.Participant2 : fix.Participant1,
    homeScore: num("HomeScore"),
    awayScore: num("AwayScore"),
    phase: "first_half", // refined once payload confirmed
    clockSeconds: null,
    stats: {},
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

  const target = fixtures.sort((a, b) => a.StartTime - b.StartTime)[0];
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
