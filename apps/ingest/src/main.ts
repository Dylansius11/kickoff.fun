/* ── KICK.FUN ingest worker ──
   The engine: TxLINE in, normalized events + Oracle lines out.
   MVP loop (poll-based; SSE swap-in once stream paths are confirmed):
     fixtures -> pick active/next fixture -> poll scores snapshot ->
     normalize -> diff -> finality gate -> oracle line -> Supabase + stdout
   Persistence (apps/ingest/src/db.ts): fixtures upsert on boot, snapshot +
   status per poll, oracle_events fan-out per line. All writes are
   fire-and-forget; a Supabase outage never stalls the poll loop.

   Run: pnpm --filter @kick/ingest dev
   (env auto-loads from the repo-root .env; TXLINE_JWT optional, the worker
   acquires a fresh guest JWT if missing. INGEST_MAX_TICKS=N exits after N
   polls, for smoke tests.) */

import { loadRootEnv } from "./env.js";
loadRootEnv();

import { TxLineClient } from "@kick/txline-client";
import { diffStates, judge, type Candidate, type MatchEvent, type MatchState } from "@kick/shared";
import { speak } from "@kick/oracle";
import { insertOracleEvent, updateFixtureSnapshot, upsertFixtures, type TxLineFixtureRow } from "./db.js";

const BASE = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
const POLL_MS = Number(process.env.INGEST_POLL_MS ?? 15_000);
const MAX_TICKS = Number(process.env.INGEST_MAX_TICKS ?? 0); // 0 = run forever

const client = new TxLineClient({
  baseUrl: BASE,
  jwt: process.env.TXLINE_JWT,
  apiToken: process.env.TXLINE_API_TOKEN,
});

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

async function main() {
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
  console.log(`[watch] ${target.Participant1} v ${target.Participant2} (fixture ${target.FixtureId})`);

  let prev: MatchState | null = null;
  const pending: Candidate[] = [];
  const history: MatchEvent[] = [];

  for (let tick = 1; ; tick++) {
    try {
      const now = Date.now();
      const raw = await client.scoresSnapshot(target.FixtureId);
      const state = normalize(target, raw, now);

      persist(`updateFixtureSnapshot(${target.FixtureId})`, updateFixtureSnapshot(target.FixtureId, state));

      if (prev) {
        for (const ev of diffStates(prev, state)) {
          history.push(ev);
          console.log(`[event] ${ev.type} ${ev.side ?? ""}`);
          if (ev.type === "goal") pending.push({ key: `goal:${ev.side}:${now}`, event: ev, seenAt: now });
          const line = speak(ev, { homeTeam: state.home, awayTeam: state.away });
          if (line) {
            console.log(`[oracle:${line.persona}] ${line.text}`);
            persist("insertOracleEvent", insertOracleEvent(target.FixtureId, ev.type, line.text));
          }
        }
      }

      // finality gate pass
      for (let i = pending.length - 1; i >= 0; i--) {
        const verdict = judge(pending[i]!, history, now);
        if (verdict !== "pending") {
          console.log(`[finality] ${pending[i]!.key} -> ${verdict}`);
          if (verdict === "final") {
            const line = speak({ type: "settlement", asOf: now });
            if (line) {
              console.log(`[oracle] ${line.text}`);
              persist("insertOracleEvent", insertOracleEvent(target.FixtureId, "settlement", line.text));
            }
            // TODO: submit settle_room via program client; settleProp/awardPoints
            // (props, picks, points_ledger) land with the props engine.
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
