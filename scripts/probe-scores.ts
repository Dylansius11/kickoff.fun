/** Summarize scoresSnapshot update arrays for phase/status signals.
 *  Run: pnpm tsx scripts/probe-scores.ts */
import { TxLineClient } from "../packages/txline-client/src/client.ts";
import { loadRootEnv } from "../apps/ingest/src/env.ts";

loadRootEnv();

async function main() {
  const client = new TxLineClient({ baseUrl: process.env.TXLINE_BASE_URL ?? "https://txline-dev.txodds.com" });
  client.setTokens(await client.startGuestSession(), process.env.TXLINE_API_TOKEN!);

  for (const id of [18187298, 17588229, 18198205, 18192996]) {
    let snap: unknown;
    try {
      snap = await client.scoresSnapshot(id);
    } catch (e) {
      console.log(`\n=== ${id}: FAILED ${e instanceof Error ? e.message : e}`);
      continue;
    }
    const arr = Array.isArray(snap) ? (snap as Record<string, unknown>[]) : [snap as Record<string, unknown>];
    console.log(`\n=== ${id}: ${arr.length} elements`);
    const keys = new Set<string>();
    for (const el of arr) for (const k of Object.keys(el)) keys.add(k);
    console.log("keys:", [...keys].join(", "));
    for (const el of arr) {
      const d = el.Data as Record<string, unknown> | undefined;
      const nw = d?.New as Record<string, unknown> | undefined;
      console.log(
        `  Seq=${el.Seq} Ts=${el.Ts} GameState=${JSON.stringify(el.GameState)} StatusId=${el.StatusId} ` +
          `Action=${el.Action} Data.Action=${d?.Action} ` +
          `Clock=${JSON.stringify((el.Clock as Record<string, unknown> | undefined) ?? null)} ` +
          `New.GameState=${JSON.stringify(nw?.GameState)} New.StatusId=${JSON.stringify(nw?.StatusId)} New.Clock=${JSON.stringify(nw?.Clock)}`,
      );
    }
    // last element full dump minus Score noise
    const last = { ...arr[arr.length - 1] };
    delete (last as Record<string, unknown>).Score;
    console.log("last element (sans Score):", JSON.stringify(last, null, 1));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
