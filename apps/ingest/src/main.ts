/* ── KICK.FUN ingest worker ──

   ══ DEPLOYMENT ══
   This worker must run 24/7 for the product DB to stay live. It is the ONLY
   writer of fixtures.status / fixtures.last_snapshot / oracle_events / props
   / picks / points_ledger: if the process is not running, every fixture,
   score, and status in Supabase FREEZES at the moment of the last run (which
   is exactly how finished matches were stuck as "live" with null snapshots).
   Host it on Railway, Fly, or any VPS; it is a plain long-lived Node process,
   NOT serverless:

     INGEST_POLL_MS=60000 pnpm --filter @kick/ingest start

   60s polling matches the SL1 service level (data is 60s-delayed anyway) and
   keeps quota headroom. Required env (repo-root .env locally; real env vars
   in the host):
     NEXT_PUBLIC_SUPABASE_URL     Supabase project URL
     SUPABASE_SERVICE_ROLE_KEY    service-role key (worker is the write path)
     TXLINE_API_TOKEN             activated TxLINE API token (free tier)
     TXLINE_BASE_URL              optional, default https://txline-dev.txodds.com
     TXLINE_JWT                   optional; a fresh guest JWT is acquired when absent
   Tuning env:
     INGEST_POLL_MS      poll interval ms (default 15000; use 60000 in prod)
     INGEST_MAX_WATCH    max fixtures polled per tick (default 6)
     INGEST_SINGLE=1     legacy fallback: camp on one fixture only
     INGEST_MAX_TICKS=N  exit after N ticks (smoke tests)
     INGEST_SIM=1        demo mode, no TxLINE (INGEST_SIM_SPEED x, default 10)
   Crash-safety: fixture/status writes are idempotent upserts and the props
   engine rehydrates from the DB on boot, so `restart: always` is enough.

   ══ LOOP ══
   TxLINE in, normalized events + Oracle lines + props out. Each tick the
   worker polls EVERY fixture that is live or kicking off within 15 minutes
   (capped at INGEST_MAX_WATCH; probed July 7 2026: SL1 free tier showed no
   rate limiting at 12 sequential + 6 concurrent snapshot calls, and TxODDS
   documents no rate limits on the hackathon tier). Odds snapshots are polled
   every OTHER tick per watched fixture to halve quota, feeding implied home
   win probability into detectOddsSwing so odds_swing props fire on real
   matches. Fixture list re-syncs from TxLINE every FIXTURE_REFRESH_TICKS.

   Persistence (db.ts): fixtures upsert on boot/refresh, snapshot + status
   per poll, oracle_events fan-out per line, props/picks/points via the props
   engine (props.ts), all keyed per fixture so concurrent watches cannot
   cross-talk. Snapshot/oracle writes are fire-and-forget; the props engine
   awaits its writes (they carry points and must stay ordered) but every
   helper is non-throwing, so a Supabase outage never stalls the poll loop.

   Run: pnpm --filter @kick/ingest dev */

import { loadRootEnv } from "./env.js";
loadRootEnv();

import { TxLineClient } from "@kick/txline-client";
import { diffStates, judge, type Candidate, type MatchEvent, type MatchState } from "@kick/shared";
import { speak } from "@kick/oracle";
import {
  ensureSimFixtureAndRoom,
  insertOracleEvent,
  statusFromFixture,
  updateFixtureSnapshot,
  upsertFixtures,
  type TxLineFixtureRow,
} from "./db.js";
import { impliedHomeFromOdds, normalizeScores } from "./normalize.js";
import { PropsEngine } from "./props.js";
import { SIM_AWAY, SIM_FIXTURE_ID, SIM_HOME, SIM_ROOM_CODE, simStateAt } from "./sim.js";

const BASE = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
const POLL_MS = Number(process.env.INGEST_POLL_MS ?? 15_000);
const MAX_TICKS = Number(process.env.INGEST_MAX_TICKS ?? 0); // 0 = run forever
const SIM = process.env.INGEST_SIM === "1";
const SIM_SPEED = Math.max(1, Number(process.env.INGEST_SIM_SPEED ?? 10));
const SINGLE = process.env.INGEST_SINGLE === "1";
/** Fixtures polled per tick, max. Probed safe well beyond this (see DEPLOYMENT). */
const MAX_WATCH = Math.max(1, Number(process.env.INGEST_MAX_WATCH ?? 6));
/** Start polling a fixture this long before kickoff. */
const PREKICK_MS = 15 * 60_000;
/** Re-fetch the TxLINE fixture list every N ticks (status + new match days). */
const FIXTURE_REFRESH_TICKS = 20;
/** Stagger between per-fixture polls inside one tick (politeness, not a limit). */
const STAGGER_MS = 250;

/** One polled reading: the normalized state plus, on odds ticks, the home
    side's implied win probability (feeds odds_swing props). */
interface Reading {
  state: MatchState;
  impliedHome?: number;
}

/* Fire-and-forget persistence: log, never throw, never await in the loop. */
function persist<T>(label: string, p: Promise<T>): void {
  p.catch((err: unknown) => console.error(`[db] ${label} rejected:`, err instanceof Error ? err.message : err));
}

/* ── Watcher: the full per-fixture pipeline ──
   diff -> oracle lines -> props engine -> finality gate. One instance per
   watched fixture; props/oracle fan-out in db.ts is keyed by fixture id, so
   watchers never cross-talk. */
class Watcher {
  private prev: MatchState | null = null;
  private readonly pending: Candidate[] = [];
  private readonly history: MatchEvent[] = [];
  private readonly engine: PropsEngine;

  constructor(
    readonly fixtureId: number,
    readonly label: string,
    private readonly timeScale: number,
  ) {
    this.engine = new PropsEngine({
      fixtureId,
      timeScale,
      exactScoreProps: process.env.INGEST_EXACT_SCORE_PROPS === "1",
    });
  }

  async step({ state, impliedHome }: Reading, now: number): Promise<void> {
    const tag = `[${this.fixtureId}]`;
    persist(`updateFixtureSnapshot(${this.fixtureId})`, updateFixtureSnapshot(this.fixtureId, state));

    const events = this.prev ? diffStates(this.prev, state) : [];
    for (const ev of events) {
      this.history.push(ev);
      console.log(`${tag} [event] ${ev.type} ${ev.side ?? ""}`);
      if (ev.type === "goal") this.pending.push({ key: `goal:${ev.side}:${now}`, event: ev, seenAt: now });
      const line = speak(ev, { homeTeam: state.home, awayTeam: state.away });
      if (line) {
        console.log(`${tag} [oracle:${line.persona}] ${line.text}`);
        persist("insertOracleEvent", insertOracleEvent(this.fixtureId, ev.type, line.text));
      }
    }

    // props lifecycle: generate, lock, settle, award points. Awaited: the
    // writes carry points and must stay ordered; every helper inside is
    // non-throwing, so this cannot kill the loop.
    await this.engine.onTick(state, events, now, impliedHome);

    // finality gate pass (Oracle settlement lines; props run their own)
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const verdict = judge(this.pending[i]!, this.history, now, 90_000 / this.timeScale);
      if (verdict !== "pending") {
        console.log(`${tag} [finality] ${this.pending[i]!.key} -> ${verdict}`);
        if (verdict === "final") {
          const line = speak({ type: "settlement", asOf: now });
          if (line) {
            console.log(`${tag} [oracle] ${line.text}`);
            persist("insertOracleEvent", insertOracleEvent(this.fixtureId, "settlement", line.text));
          }
          // TODO: submit settle_room via program client at full time.
        }
        this.pending.splice(i, 1);
      }
    }

    this.prev = state;
  }
}

function fixtureLabel(f: TxLineFixtureRow): string {
  return `${f.Participant1} v ${f.Participant2} (fixture ${f.FixtureId})`;
}

function kickoffMs(f: TxLineFixtureRow): number {
  return f.StartTime > 1e12 ? f.StartTime : f.StartTime * 1000;
}

/** Fixtures worth polling this tick: live first, then kicking off within
    PREKICK_MS, capped at MAX_WATCH. When nothing qualifies, fall back to the
    single next-upcoming fixture so its status flips promptly at kickoff. */
function selectWatchlist(fixtures: TxLineFixtureRow[], now: number): TxLineFixtureRow[] {
  const sorted = [...fixtures].sort((a, b) => a.StartTime - b.StartTime);
  const live = sorted.filter((f) => statusFromFixture(f, now) === "live");
  const soon = sorted.filter((f) => statusFromFixture(f, now) === "upcoming" && kickoffMs(f) - now <= PREKICK_MS);
  const picked = [...live, ...soon].slice(0, MAX_WATCH);
  if (picked.length > 0) return picked;
  const next = sorted.find((f) => statusFromFixture(f, now) === "upcoming");
  return next ? [next] : [];
}

async function runLive(): Promise<void> {
  const client = new TxLineClient({
    baseUrl: BASE,
    jwt: process.env.TXLINE_JWT,
    apiToken: process.env.TXLINE_API_TOKEN,
  });
  if (!client["jwt" as never]) {
    await client.startGuestSession();
    console.log("[auth] fresh guest JWT acquired");
  }
  console.log(`[ingest] up against ${BASE}, poll every ${POLL_MS}ms, watch cap ${SINGLE ? 1 : MAX_WATCH}`);

  const loadFixtures = async (): Promise<TxLineFixtureRow[]> => {
    // Reach one day back so a match straddling midnight UTC stays watched.
    const rows = (await client.fixtures({ startEpochDay: epochDayToday() - 1 })) as TxLineFixtureRow[];
    const written = await upsertFixtures(rows);
    if (written > 0) console.log(`[db] ${written} fixtures upserted`);
    return rows;
  };

  let fixtures = await loadFixtures();
  console.log(`[fixtures] ${fixtures.length} World Cup fixtures loaded`);
  if (fixtures.length === 0) throw new Error("no fixtures returned");

  // Legacy single-fixture fallback (INGEST_SINGLE=1): pick one target at
  // boot, live first, else next kickoff, and camp on it.
  let singleTarget: TxLineFixtureRow | null = null;
  if (SINGLE) {
    const sorted = [...fixtures].sort((a, b) => a.StartTime - b.StartTime);
    singleTarget =
      sorted.find((f) => statusFromFixture(f) === "live") ??
      sorted.find((f) => statusFromFixture(f) === "upcoming") ??
      sorted[sorted.length - 1]!;
    console.log(`[watch] single mode: ${fixtureLabel(singleTarget)}`);
  }

  const watchers = new Map<number, Watcher>();

  for (let tick = 1; ; tick++) {
    try {
      const now = Date.now();
      if (tick % FIXTURE_REFRESH_TICKS === 0) {
        try {
          fixtures = await loadFixtures();
        } catch (err) {
          console.error("[fixtures] refresh failed:", err instanceof Error ? err.message : err);
        }
      }

      const targets = singleTarget ? [singleTarget] : selectWatchlist(fixtures, now);
      const names = targets.map((f) => fixtureLabel(f)).join(" | ");
      console.log(`[tick ${tick}] watching ${targets.length} fixture(s): ${names || "none"}`);

      // Odds every other tick per fixture to halve quota; snapshot has the
      // full market board, we only need the 1X2 implied home probability.
      const oddsTick = tick % 2 === 1;
      for (const [i, fix] of targets.entries()) {
        if (i > 0) await new Promise((r) => setTimeout(r, STAGGER_MS));
        try {
          const raw = await client.scoresSnapshot(fix.FixtureId);
          const reading: Reading = { state: normalizeScores(fix, raw, now) };
          if (oddsTick) {
            try {
              reading.impliedHome = impliedHomeFromOdds(await client.oddsSnapshot(fix.FixtureId), fix.Participant1IsHome);
              if (reading.impliedHome !== undefined) {
                console.log(`[${fix.FixtureId}] [odds] implied home ${(reading.impliedHome * 100).toFixed(1)}%`);
              }
            } catch (err) {
              console.error(`[${fix.FixtureId}] [odds] snapshot failed:`, err instanceof Error ? err.message : err);
            }
          }
          let watcher = watchers.get(fix.FixtureId);
          if (!watcher) {
            watcher = new Watcher(fix.FixtureId, fixtureLabel(fix), 1);
            watchers.set(fix.FixtureId, watcher);
            console.log(`[watch] + ${watcher.label}`);
          }
          await watcher.step(reading, Date.now());
        } catch (err) {
          console.error(`[${fix.FixtureId}] [poll error]`, err instanceof Error ? err.message : err);
        }
      }

      // Retire watchers for fixtures no longer selected (finished/rotated).
      const keep = new Set(targets.map((f) => f.FixtureId));
      for (const id of watchers.keys()) {
        if (!keep.has(id)) {
          console.log(`[watch] - fixture ${id} retired`);
          watchers.delete(id);
        }
      }
    } catch (err) {
      console.error("[tick error]", err instanceof Error ? err.message : err);
    }
    if (MAX_TICKS > 0 && tick >= MAX_TICKS) {
      console.log(`[ingest] INGEST_MAX_TICKS=${MAX_TICKS} reached, exiting`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function runSim(): Promise<void> {
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
  const watcher = new Watcher(SIM_FIXTURE_ID, `${SIM_HOME} v ${SIM_AWAY} (SIM fixture ${SIM_FIXTURE_ID})`, SIM_SPEED);
  console.log(`[watch] ${watcher.label}`);

  for (let tick = 1; ; tick++) {
    try {
      const now = Date.now();
      const reading = simStateAt(((now - startedAt) / 1000) * SIM_SPEED, now);
      await watcher.step(reading, now);
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

(SIM ? runSim() : runLive()).catch((e) => {
  console.error(e);
  process.exit(1);
});
