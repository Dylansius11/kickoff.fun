/**
 * Backfill final scores for finished fixtures that never got a snapshot.
 *
 * Why this exists: fixtures the ingest worker was not watching at full time
 * end up status=final with last_snapshot NULL, so the UI has no score.
 * SL1 keeps the full scores history for finished fixtures (probed July 7
 * 2026: 36-44 update rows incl. game_finalised), so finals are recoverable
 * any time after the whistle.
 *
 * Flow: guest JWT -> fixtures snapshot (30 days back, for Participant1IsHome
 * + names) -> for every fixtures row with status='final' AND last_snapshot
 * IS NULL (sim fixture 999001 excluded) fetch /api/scores/snapshot/{id},
 * normalize via apps/ingest/src/normalize.ts (same module the live loop
 * uses), write last_snapshot + status. Idempotent: rerun matches zero rows.
 *
 * Run: pnpm tsx scripts/backfill-finals.ts
 * Env: repo-root .env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TXLINE_API_TOKEN; TXLINE_BASE_URL optional).
 */
import { createClient } from "@supabase/supabase-js";
import { TxLineClient } from "../packages/txline-client/src/client.ts";
import { loadRootEnv } from "../apps/ingest/src/env.ts";
import { updateFixtureSnapshot, type TxLineFixtureRow } from "../apps/ingest/src/db.ts";
import { normalizeScores } from "../apps/ingest/src/normalize.ts";
import type { MatchState } from "@kick/shared";

loadRootEnv();

const SIM_FIXTURE_ID = 999001;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!url || !key) throw new Error("Supabase env missing");
  if (!apiToken) throw new Error("TXLINE_API_TOKEN missing");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await supabase
    .from("fixtures")
    .select("id,home_team,away_team,status,last_snapshot")
    .eq("status", "final")
    .is("last_snapshot", null)
    .neq("id", SIM_FIXTURE_ID)
    .order("id");
  if (error) throw new Error(`fixtures query failed: ${error.message}`);
  if (!rows || rows.length === 0) {
    console.log("Nothing to backfill: no final fixtures with a null snapshot.");
    return;
  }
  console.log(`${rows.length} final fixture(s) with null snapshot:\n`);
  console.log("BEFORE");
  for (const r of rows) console.log(`  ${r.id}  ${r.home_team} v ${r.away_team}  status=${r.status}  last_snapshot=null`);

  const client = new TxLineClient({ baseUrl: process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com" });
  client.setTokens(await client.startGuestSession(), apiToken);
  console.log("\n[auth] guest JWT acquired");

  // TxLINE fixture rows (Participant1IsHome orients the score) 30 days back.
  const today = Math.floor(Date.now() / 86_400_000);
  const byId = new Map<number, TxLineFixtureRow>();
  for (const f of (await client.fixtures({ startEpochDay: today - 30 })) as TxLineFixtureRow[]) byId.set(f.FixtureId, f);
  console.log(`[txline] ${byId.size} fixtures fetched for orientation\n`);

  const after: { id: number; label: string; result: string }[] = [];
  for (const row of rows) {
    const fix = byId.get(row.id as number);
    const label = `${row.home_team} v ${row.away_team}`;
    if (!fix) {
      after.push({ id: row.id as number, label, result: "SKIPPED: not in TxLINE fixtures window" });
      continue;
    }
    let state: MatchState;
    try {
      state = normalizeScores(fix, await client.scoresSnapshot(fix.FixtureId), Date.now());
    } catch (e) {
      after.push({ id: row.id as number, label, result: `SKIPPED: snapshot failed (${e instanceof Error ? e.message : e})` });
      continue;
    }
    // The fixture is already known final; pin the status so a sparse history
    // (phase fallback landing on first_half) can never downgrade it to live.
    const status = "final" as const;
    const ok = await updateFixtureSnapshot(fix.FixtureId, state, status);
    after.push({
      id: row.id as number,
      label,
      result: ok ? `${state.homeScore}–${state.awayScore} (phase=${state.phase}, status=${status})` : "WRITE FAILED",
    });
  }

  console.log("AFTER");
  for (const r of after) console.log(`  ${r.id}  ${r.label}  ->  ${r.result}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
