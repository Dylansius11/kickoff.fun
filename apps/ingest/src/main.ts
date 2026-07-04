/* ── KICK.FUN ingest worker ──
   The engine: TxLINE in, normalized events + Oracle lines out.
   MVP loop (poll-based; SSE swap-in once stream paths are confirmed):
     fixtures -> pick active/next fixture -> poll scores snapshot ->
     normalize -> diff -> finality gate -> oracle line -> stdout
   Supabase publishing lands when the schema is applied (see supabase/).

   Run: TXLINE_JWT=... TXLINE_API_TOKEN=... pnpm --filter @kick/ingest dev
   (JWT optional: worker acquires a fresh guest JWT if missing.) */

import { TxLineClient } from "@kick/txline-client";
import { diffStates, judge, type Candidate, type MatchEvent, type MatchState } from "@kick/shared";
import { speak } from "@kick/oracle";

const BASE = process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com";
const POLL_MS = Number(process.env.INGEST_POLL_MS ?? 15_000);

const client = new TxLineClient({
  baseUrl: BASE,
  jwt: process.env.TXLINE_JWT,
  apiToken: process.env.TXLINE_API_TOKEN,
});

/* TxLINE fixture snapshot row (fields observed live, July 4 2026). */
interface FixtureRow {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  StartTime: number;
  Competition: string;
}

/* Normalize a raw TxLINE scores snapshot into our MatchState.
   NOTE: exact scores payload shape lands after the first live pull; the
   mapper is isolated here so fixing it is a one-function change. */
function normalize(fix: FixtureRow, raw: unknown, asOf: number): MatchState {
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

async function main() {
  if (!client["jwt" as never]) {
    await client.startGuestSession();
    console.log("[auth] fresh guest JWT acquired");
  }
  console.log(`[ingest] up against ${BASE}, poll every ${POLL_MS}ms`);

  const fixtures = (await client.fixtures({ startEpochDay: epochDayToday() })) as FixtureRow[];
  console.log(`[fixtures] ${fixtures.length} World Cup fixtures loaded`);
  const target = fixtures.sort((a, b) => a.StartTime - b.StartTime)[0];
  if (!target) throw new Error("no fixtures returned");
  console.log(`[watch] ${target.Participant1} v ${target.Participant2} (fixture ${target.FixtureId})`);

  let prev: MatchState | null = null;
  const pending: Candidate[] = [];
  const history: MatchEvent[] = [];

  for (;;) {
    try {
      const now = Date.now();
      const raw = await client.scoresSnapshot(target.FixtureId);
      const state = normalize(target, raw, now);

      if (prev) {
        for (const ev of diffStates(prev, state)) {
          history.push(ev);
          console.log(`[event] ${ev.type} ${ev.side ?? ""}`);
          if (ev.type === "goal") pending.push({ key: `goal:${ev.side}:${now}`, event: ev, seenAt: now });
          const line = speak(ev, { homeTeam: state.home, awayTeam: state.away });
          if (line) console.log(`[oracle:${line.persona}] ${line.text}`);
        }
      }

      // finality gate pass
      for (let i = pending.length - 1; i >= 0; i--) {
        const verdict = judge(pending[i]!, history, now);
        if (verdict !== "pending") {
          console.log(`[finality] ${pending[i]!.key} -> ${verdict}`);
          if (verdict === "final") {
            const line = speak({ type: "settlement", asOf: now });
            if (line) console.log(`[oracle] ${line.text}`);
            // TODO: submit settle_room via program client + write Supabase
          }
          pending.splice(i, 1);
        }
      }

      prev = state;
    } catch (err) {
      console.error("[poll error]", err instanceof Error ? err.message : err);
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
