/**
 * Probe TxLINE GameState values across finished / live / upcoming WC fixtures.
 * Run: pnpm tsx scripts/probe-gamestate.ts
 */
import { TxLineClient } from "../packages/txline-client/src/client.ts";
import { loadRootEnv } from "../apps/ingest/src/env.ts";

loadRootEnv();

interface Fix {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  StartTime: number;
  GameState?: number;
  [k: string]: unknown;
}

function iso(st: number): string {
  return new Date(st > 1e12 ? st : st * 1000).toISOString();
}

async function main() {
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!apiToken) throw new Error("TXLINE_API_TOKEN missing");
  const client = new TxLineClient({ baseUrl: process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com" });
  client.setTokens(await client.startGuestSession(), apiToken);
  console.log("[auth] guest JWT acquired");

  const today = Math.floor(Date.now() / 86_400_000);
  const byId = new Map<number, Fix>();
  for (let d = today - 7; d <= today + 7; d++) {
    try {
      const rows = (await client.fixtures({ startEpochDay: d })) as Fix[];
      for (const f of rows) byId.set(f.FixtureId, f);
    } catch (e) {
      console.error(`[fixtures] epochDay ${d} failed:`, e instanceof Error ? e.message : e);
    }
  }

  const fixtures = [...byId.values()].sort((a, b) => a.StartTime - b.StartTime);
  console.log(`\n${fixtures.length} unique fixtures, GameState distribution:`);
  const dist = new Map<unknown, number>();
  for (const f of fixtures) dist.set(f.GameState, (dist.get(f.GameState) ?? 0) + 1);
  for (const [gs, n] of dist) console.log(`  GameState=${gs}: ${n} fixtures`);

  console.log("\nAll fixtures (sorted by StartTime):");
  const nowMs = Date.now();
  for (const f of fixtures) {
    const ms = f.StartTime > 1e12 ? f.StartTime : f.StartTime * 1000;
    const rel = ms > nowMs ? "FUTURE" : nowMs - ms > 3 * 3600_000 ? "PAST>3h" : "RECENT";
    console.log(
      `  ${f.FixtureId}  GameState=${f.GameState}  ${rel.padEnd(7)}  ${iso(f.StartTime)}  ${f.Participant1} v ${f.Participant2}`,
    );
  }

  // Dump one full fixture row to see every field present.
  if (fixtures[0]) {
    console.log("\nFull sample fixture row keys/values:");
    console.log(JSON.stringify(fixtures[0], null, 2));
  }

  // Scores snapshots: one finished (Brazil v Norway 18187298 / Paraguay v Australia 17588229), one upcoming.
  for (const id of [18187298, 17588229, fixtures.find((f) => (f.StartTime > 1e12 ? f.StartTime : f.StartTime * 1000) > nowMs)?.FixtureId]) {
    if (!id) continue;
    try {
      const snap = await client.scoresSnapshot(id);
      console.log(`\nscoresSnapshot(${id}):`);
      console.log(JSON.stringify(snap, null, 2).slice(0, 3000));
    } catch (e) {
      console.error(`\nscoresSnapshot(${id}) failed:`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
