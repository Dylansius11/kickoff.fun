/**
 * Seed the Supabase `fixtures` table from live TxLINE World Cup data.
 *
 * Flow: guest JWT -> fixtures snapshot (competition 72, today onward) ->
 * idempotent upsert -> read back and print proof rows. Safe to re-run:
 * upsert keys on the TxLINE fixture id and never touches status/last_snapshot.
 *
 * Run: pnpm tsx scripts/seed-fixtures.ts
 * Env: repo-root .env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TXLINE_API_TOKEN; TXLINE_BASE_URL optional).
 */
import { createClient } from "@supabase/supabase-js";
import { TxLineClient } from "../packages/txline-client/src/client.ts";
import { loadRootEnv } from "../apps/ingest/src/env.ts";
import { upsertFixtures, type TxLineFixtureRow } from "../apps/ingest/src/db.ts";

loadRootEnv();

async function main() {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) throw new Error("TXLINE_API_TOKEN missing from env");

  const client = new TxLineClient({ baseUrl: process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com" });
  const jwt = await client.startGuestSession();
  client.setTokens(jwt, apiToken);
  console.log("[auth] guest JWT acquired");

  const startEpochDay = Math.floor(Date.now() / 86_400_000);
  const fixtures = (await client.fixtures({ startEpochDay })) as TxLineFixtureRow[];
  console.log(`[txline] ${fixtures.length} World Cup fixtures fetched (from epoch day ${startEpochDay})`);
  if (fixtures.length === 0) throw new Error("TxLINE returned zero fixtures; nothing to seed");

  const written = await upsertFixtures(fixtures);
  if (written === 0) throw new Error("upsert wrote 0 rows; check Supabase env/logs above");
  console.log(`[db] upserted ${written} fixtures`);

  // Read back through a fresh client as independent proof the rows landed.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error, count } = await supabase
    .from("fixtures")
    .select("id, home_team, away_team, kickoff_at, status, group_round", { count: "exact" })
    .order("kickoff_at", { ascending: true })
    .limit(3);
  if (error) throw new Error(`read-back failed: ${error.message}`);

  console.log(`[db] fixtures table now holds ${count} rows; first 3 by kickoff:`);
  for (const row of data ?? []) {
    console.log(
      `  ${row.id}  ${row.home_team} v ${row.away_team}  ${row.kickoff_at}  status=${row.status}` +
        (row.group_round ? `  round=${row.group_round}` : ""),
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
