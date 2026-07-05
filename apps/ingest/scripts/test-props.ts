/* ── Props engine end-to-end check (run WHILE the sim worker runs) ──
   Terminal A: INGEST_SIM=1 INGEST_MAX_TICKS=12 INGEST_POLL_MS=2000 pnpm --filter @kick/ingest start
   Terminal B: pnpm --filter @kick/ingest exec tsx scripts/test-props.ts

   Creates a test user in the SIM room, waits for the rolling next_goal prop,
   picks "home" (Argentina scores in the sim script, so the pick should win),
   then watches the prop go open -> locked/under_review -> settled and prints
   the pick, ledger row, and trigger-updated point totals as evidence.

   RESET=1 wipes prior sim-run rows (ledger -> picks -> props) first. */

import { loadRootEnv } from "../src/env.js";
loadRootEnv();

import { createClient } from "@supabase/supabase-js";
import { SIM_FIXTURE_ID, SIM_ROOM_CODE } from "../src/sim.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase env missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function must<T>(
  label: string,
  p: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data == null) throw new Error(`${label}: no row`);
  return data;
}

async function main() {
  // room (created by the sim worker; wait for it)
  let roomId: string | null = null;
  for (let i = 0; i < 30 && !roomId; i++) {
    const { data } = await db.from("rooms").select("id").eq("room_code", SIM_ROOM_CODE).maybeSingle();
    roomId = data?.id ?? null;
    if (!roomId) await sleep(1000);
  }
  if (!roomId) throw new Error(`room ${SIM_ROOM_CODE} never appeared; is the sim worker running?`);
  console.log(`[test] sim room ${roomId}`);

  if (process.env.RESET === "1") {
    await must("reset ledger", db.from("points_ledger").delete().eq("room_id", roomId).select("id"));
    await must("reset picks", db.from("picks").delete().eq("room_id", roomId).select("id"));
    await must("reset props", db.from("props").delete().eq("room_id", roomId).select("id"));
    console.log("[test] prior sim rows wiped");
  }

  // test user + membership
  const user = await must(
    "user upsert",
    db
      .from("users")
      .upsert({ privy_id: "test:props", handle: "prop_tester" }, { onConflict: "privy_id" })
      .select("id,tournament_points")
      .single(),
  );
  await must(
    "membership upsert",
    db.from("room_members").upsert({ room_id: roomId, user_id: user.id }, { onConflict: "room_id,user_id" }).select("id"),
  );
  const memberBefore = await must(
    "member before",
    db.from("room_members").select("points").eq("room_id", roomId).eq("user_id", user.id).single(),
  );
  console.log(
    `[test] user ${user.id} joined. BEFORE: tournament_points=${user.tournament_points} room points=${memberBefore.points}`,
  );

  // wait for a live next_goal prop
  let prop: { id: string; state: string; prompt: string; options: unknown } | null = null;
  for (let i = 0; i < 30 && !prop; i++) {
    const { data } = await db
      .from("props")
      .select("id,state,prompt,options")
      .eq("room_id", roomId)
      .eq("type", "next_goal")
      .in("state", ["open", "locked", "under_review"])
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    prop = data ?? null;
    if (!prop) await sleep(1000);
  }
  if (!prop) throw new Error("no next_goal prop appeared");
  console.log(`[test] prop ${prop.id} state=${prop.state} "${prop.prompt}" options=${JSON.stringify(prop.options)}`);

  // pick "home" (Argentina scores at sim t=75, so this should win)
  const pick = await must(
    "pick upsert",
    db
      .from("picks")
      .upsert(
        { prop_id: prop.id, user_id: user.id, room_id: roomId, choice: "home" },
        { onConflict: "prop_id,user_id" },
      )
      .select("id,settle_state,is_correct,points_awarded")
      .single(),
  );
  console.log(`[test] pick ${pick.id} placed: choice=home settle_state=${pick.settle_state}`);

  // watch the prop through its lifecycle to settlement
  let lastState = prop.state;
  for (let i = 0; i < 90; i++) {
    const row = await must(
      "prop poll",
      db.from("props").select("state,resolution,settled_at").eq("id", prop.id).single(),
    );
    if (row.state !== lastState) {
      console.log(`[test] prop ${prop.id}: ${lastState} -> ${row.state}`);
      lastState = row.state;
    }
    if (row.state === "settled" || row.state === "voided") {
      console.log(`[test] resolution: ${JSON.stringify(row.resolution)} settled_at=${row.settled_at}`);
      break;
    }
    await sleep(1000);
  }
  if (lastState !== "settled" && lastState !== "voided") throw new Error(`prop never settled (stuck ${lastState})`);

  await sleep(1500); // let ledger + trigger land

  const pickAfter = await must(
    "pick after",
    db.from("picks").select("is_correct,settle_state,points_awarded").eq("id", pick.id).single(),
  );
  const ledger = await must(
    "ledger rows",
    db.from("points_ledger").select("delta,reason,created_at").eq("pick_id", pick.id),
  );
  const memberAfter = await must(
    "member after",
    db.from("room_members").select("points").eq("room_id", roomId).eq("user_id", user.id).single(),
  );
  const userAfter = await must("user after", db.from("users").select("tournament_points").eq("id", user.id).single());

  console.log("── EVIDENCE ──");
  console.log(`pick AFTER: is_correct=${pickAfter.is_correct} settle_state=${pickAfter.settle_state} points_awarded=${pickAfter.points_awarded}`);
  console.log(`ledger: ${JSON.stringify(ledger)}`);
  console.log(`room_members.points: ${memberBefore.points} -> ${memberAfter.points}`);
  console.log(`users.tournament_points -> ${userAfter.tournament_points}`);

  // whole-fixture prop census for the run
  const census = await must(
    "census",
    db.from("props").select("type,state").eq("fixture_id", SIM_FIXTURE_ID),
  );
  const tally: Record<string, number> = {};
  for (const r of census) tally[`${r.type}:${r.state}`] = (tally[`${r.type}:${r.state}`] ?? 0) + 1;
  console.log(`props census: ${JSON.stringify(tally)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
