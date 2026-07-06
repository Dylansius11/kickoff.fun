import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchPhase, MatchState } from "@kick/shared";
import type { PropOption, PropResolution, PropType } from "./props.js"; // type-only import: no runtime cycle

/* ── Supabase persistence for the ingest worker ──
   Service-role client: RLS in supabase/migrations/0001_init.sql grants writes
   to service_role only, so this module is the single write path for game
   state. Every exported function is NON-THROWING: a Supabase outage logs to
   stderr and returns a harmless value; it must never kill the poll loop.

   Props-engine helpers return convention: `null` = transport/db error (the
   engine re-queues the intent and retries next tick); a number/boolean/array
   = the call landed, possibly matching zero rows. Zero rows is the
   idempotency guard doing its job (state already terminal), not an error. */

/** TxLINE fixture snapshot row (fields observed live, July 4 2026). */
export interface TxLineFixtureRow {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  /** Epoch time; TxLINE serves seconds, but we tolerate ms defensively. */
  StartTime: number;
  /** Integer lifecycle state; see statusFromFixture for the decoded values. */
  GameState?: number;
  Competition?: string;
  /** Group/round labels if the payload carries them (not always present). */
  Group?: string;
  Round?: string;
  GroupName?: string;
}

export type FixtureStatus = "upcoming" | "live" | "final";

let cached: SupabaseClient | null | undefined;

/** Lazy service-role client; null (with one warning) when env is missing so
    the worker still runs log-only in dev shells without Supabase creds. */
function db(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[db] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; persistence disabled");
    cached = null;
    return cached;
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

function toIso(startTime: number): string {
  const ms = startTime > 1e12 ? startTime : startTime * 1000;
  return new Date(ms).toISOString();
}

export function statusFromPhase(phase: MatchPhase): FixtureStatus {
  if (phase === "pre") return "upcoming";
  if (phase === "full_time") return "final";
  return "live";
}

/** Decode the fixtures-snapshot integer `GameState` into our status.
    Observed live against txline-dev, July 6 2026 (scripts/probe-gamestate.ts):
      1 = scheduled (all future fixtures carry it)
      3 = finished/finalised (every fixture >3h past kickoff except stragglers)
      2 = in-play (inferred: only value between 1 and 3; nothing was live
          during the probe, so it is trusted but also backstopped below)
    The field lags: recently finished fixtures can sit at GameState=1 for
    hours, and some rows omit it entirely. Kickoff time is the fallback:
    future = upcoming; older than 3h with no live signal = final; else live. */
export function statusFromFixture(
  f: Pick<TxLineFixtureRow, "GameState" | "StartTime">,
  now = Date.now(),
): FixtureStatus {
  if (f.GameState === 3) return "final";
  if (f.GameState === 2) return "live";
  const kickoffMs = f.StartTime > 1e12 ? f.StartTime : f.StartTime * 1000;
  if (kickoffMs > now) return "upcoming";
  return now - kickoffMs > 3 * 3_600_000 ? "final" : "live";
}

/** Idempotent fixtures upsert keyed on the TxLINE fixture id. Sets `status`
    from GameState + kickoff time (statusFromFixture), so seeds and boots
    correct stale statuses; the live loop then refines it per poll from the
    scores phase. `last_snapshot` stays untouched. Returns rows written. */
export async function upsertFixtures(fixtures: TxLineFixtureRow[]): Promise<number> {
  const client = db();
  if (!client || fixtures.length === 0) return 0;
  const rows = fixtures.map((f) => ({
    id: f.FixtureId,
    home_team: f.Participant1IsHome ? f.Participant1 : f.Participant2,
    away_team: f.Participant1IsHome ? f.Participant2 : f.Participant1,
    kickoff_at: toIso(f.StartTime),
    group_round: f.Group ?? f.GroupName ?? f.Round ?? null,
    status: statusFromFixture(f),
  }));
  const { error } = await client.from("fixtures").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("[db] upsertFixtures failed:", error.message);
    return 0;
  }
  return rows.length;
}

/** Persist the latest normalized state + derived status for one fixture.
    Realtime publication on `fixtures` fans this out to every open room UI. */
export async function updateFixtureSnapshot(
  fixtureId: number,
  state: MatchState,
  status: FixtureStatus = statusFromPhase(state.phase),
): Promise<boolean> {
  const client = db();
  if (!client) return false;
  const { error } = await client
    .from("fixtures")
    .update({ last_snapshot: state, status })
    .eq("id", fixtureId);
  if (error) {
    console.error(`[db] updateFixtureSnapshot(${fixtureId}) failed:`, error.message);
    return false;
  }
  return true;
}

/** Rooms currently listening to a fixture: status in ('open','live').
    `null` = lookup failed; `[]` = nobody listening (silent no-op upstream). */
async function liveRoomIds(client: SupabaseClient, fixtureId: number): Promise<string[] | null> {
  const { data, error } = await client
    .from("rooms")
    .select("id")
    .eq("fixture_id", fixtureId)
    .in("status", ["open", "live"]);
  if (error) {
    console.error(`[db] room lookup(${fixtureId}) failed:`, error.message);
    return null;
  }
  return (data ?? []).map((r) => r.id as string);
}

/** Fan an Oracle line out to every live room on a fixture: one oracle_events
    row per room in ('open','live'). No rooms means nobody is listening; that
    is a silent no-op, not an error. Returns rooms reached. */
export async function insertOracleEvent(fixtureId: number, type: string, line: string): Promise<number> {
  const client = db();
  if (!client) return 0;
  const rooms = await liveRoomIds(client, fixtureId);
  if (!rooms || rooms.length === 0) return 0;
  const { error } = await client
    .from("oracle_events")
    .insert(rooms.map((room_id) => ({ room_id, type, line })));
  if (error) {
    console.error(`[db] insertOracleEvent(${fixtureId}) failed:`, error.message);
    return 0;
  }
  return rooms.length;
}

/* ══════════════════════ Props engine persistence ══════════════════════ */

/** Prop states the engine may still act on. Everything else is terminal. */
const SETTLEABLE = ["open", "locked", "under_review"] as const;

export interface PropSpec {
  fixtureId: number;
  type: PropType;
  prompt: string;
  options: PropOption[];
  /** epoch ms */
  locksAt: number;
}

/** Fan one logical prop out to every open/live room on the fixture (one
    `props` row per room, same content). Returns rows created; 0 on failure
    or when no rooms are listening. */
export async function createProps(spec: PropSpec): Promise<number> {
  const client = db();
  if (!client) return 0;
  const rooms = await liveRoomIds(client, spec.fixtureId);
  if (!rooms || rooms.length === 0) return 0;
  const rows = rooms.map((room_id) => ({
    room_id,
    fixture_id: spec.fixtureId,
    type: spec.type,
    prompt: spec.prompt,
    options: spec.options,
    locks_at: new Date(spec.locksAt).toISOString(),
  }));
  const { error } = await client.from("props").insert(rows);
  if (error) {
    console.error(`[db] createProps(${spec.type}) failed:`, error.message);
    return 0;
  }
  return rows.length;
}

/** open -> locked for every prop on the fixture whose lock time has passed.
    The `state = 'open'` guard makes this safe to run every tick. Returns
    rows locked, or null on transport error. */
export async function lockDueProps(fixtureId: number): Promise<number | null> {
  const client = db();
  if (!client) return 0;
  const { data, error } = await client
    .from("props")
    .update({ state: "locked" })
    .eq("fixture_id", fixtureId)
    .eq("state", "open")
    .lte("locks_at", new Date().toISOString())
    .select("id");
  if (error) {
    console.error(`[db] lockDueProps(${fixtureId}) failed:`, error.message);
    return null;
  }
  return data?.length ?? 0;
}

/** open/locked -> under_review (VAR window on a provisional goal). Cosmetic
    for the room UI; settlement does not depend on it landing. */
export async function markPropsUnderReview(fixtureId: number, type: PropType): Promise<number | null> {
  const client = db();
  if (!client) return 0;
  const { data, error } = await client
    .from("props")
    .update({ state: "under_review" })
    .eq("fixture_id", fixtureId)
    .eq("type", type)
    .in("state", ["open", "locked"])
    .select("id");
  if (error) {
    console.error(`[db] markPropsUnderReview(${type}) failed:`, error.message);
    return null;
  }
  return data?.length ?? 0;
}

/** Ids of all non-terminal props of one type on a fixture (the fan-out group
    the engine settles as a unit). null on transport error. */
export async function findSettleableProps(fixtureId: number, type: PropType): Promise<string[] | null> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("props")
    .select("id")
    .eq("fixture_id", fixtureId)
    .eq("type", type)
    .in("state", [...SETTLEABLE]);
  if (error) {
    console.error(`[db] findSettleableProps(${type}) failed:`, error.message);
    return null;
  }
  return (data ?? []).map((r) => r.id as string);
}

/** Terminal transition to `settled`. The `state in SETTLEABLE` guard means a
    prop can never settle twice: true = this call settled it, false = someone
    already did (fine), null = transport error (retry). */
export async function settleProp(propId: string, resolution: PropResolution): Promise<boolean | null> {
  const client = db();
  if (!client) return false;
  const { data, error } = await client
    .from("props")
    .update({ state: "settled", resolution, settled_at: new Date().toISOString() })
    .eq("id", propId)
    .in("state", [...SETTLEABLE])
    .select("id");
  if (error) {
    console.error(`[db] settleProp(${propId}) failed:`, error.message);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

/** Terminal transition to `voided` (VAR chalk-off, abandoned market). Picks
    are marked voided separately; nobody gains or loses points. */
export async function voidProp(propId: string, reason: string): Promise<boolean | null> {
  const client = db();
  if (!client) return false;
  const resolution: PropResolution = { winning_option_id: null, reason, source: "txline" };
  const { data, error } = await client
    .from("props")
    .update({ state: "voided", resolution, settled_at: new Date().toISOString() })
    .eq("id", propId)
    .in("state", [...SETTLEABLE])
    .select("id");
  if (error) {
    console.error(`[db] voidProp(${propId}) failed:`, error.message);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

/** Settle every pending pick on a prop: winners get is_correct + points
    (pick row AND a points_ledger row, whose trigger bumps
    users.tournament_points + room_members.points), losers get is_correct
    false. The `settle_state = 'pending'` guard makes re-runs no-ops, so a
    crash between picks and the prop-state write is safe to replay. */
export async function settlePicksForProp(
  propId: string,
  winningOptionId: string,
  ledgerReason: string,
  points: number,
): Promise<{ winners: number; losers: number } | null> {
  const client = db();
  if (!client) return { winners: 0, losers: 0 };
  const { data: winners, error: winErr } = await client
    .from("picks")
    .update({ is_correct: true, settle_state: "settled", points_awarded: points })
    .eq("prop_id", propId)
    .eq("settle_state", "pending")
    .eq("choice", winningOptionId)
    .select("id,user_id,room_id");
  if (winErr) {
    console.error(`[db] settlePicksForProp(${propId}) winners failed:`, winErr.message);
    return null;
  }
  const { data: losers, error: loseErr } = await client
    .from("picks")
    .update({ is_correct: false, settle_state: "settled", points_awarded: 0 })
    .eq("prop_id", propId)
    .eq("settle_state", "pending")
    .neq("choice", winningOptionId)
    .select("id");
  if (loseErr) {
    console.error(`[db] settlePicksForProp(${propId}) losers failed:`, loseErr.message);
    return null;
  }
  const ledger = (winners ?? []).map((w) => ({
    user_id: w.user_id as string,
    room_id: w.room_id as string,
    pick_id: w.id as string,
    delta: points,
    reason: ledgerReason,
  }));
  await insertLedgerRows(ledger);
  return { winners: winners?.length ?? 0, losers: losers?.length ?? 0 };
}

/** Void every pending pick on a prop: no points move, is_correct stays null. */
export async function voidPicksForProp(propId: string): Promise<number | null> {
  const client = db();
  if (!client) return 0;
  const { data, error } = await client
    .from("picks")
    .update({ settle_state: "voided", points_awarded: 0 })
    .eq("prop_id", propId)
    .eq("settle_state", "pending")
    .select("id");
  if (error) {
    console.error(`[db] voidPicksForProp(${propId}) failed:`, error.message);
    return null;
  }
  return data?.length ?? 0;
}

export interface LedgerRow {
  user_id: string;
  room_id: string;
  pick_id: string;
  delta: number;
  reason: string;
}

/** Insert points_ledger rows; the DB trigger applies the deltas to
    users.tournament_points and room_members.points. Picks are already marked
    settled by the time this runs, so a failure here cannot double-award on
    retry; it CAN drop points, which is why the failure log carries the full
    payload for manual replay. */
export async function insertLedgerRows(rows: LedgerRow[]): Promise<number> {
  const client = db();
  if (!client || rows.length === 0) return 0;
  const { error } = await client.from("points_ledger").insert(rows);
  if (error) {
    console.error("[db] insertLedgerRows failed, MANUAL REPLAY NEEDED:", error.message, JSON.stringify(rows));
    return 0;
  }
  return rows.length;
}

/** Non-terminal prop counts per type for one fixture. The engine hydrates
    its in-memory picture from this on boot so a crash mid-match never
    duplicates or orphans props. null on transport error. */
export async function activePropCounts(fixtureId: number): Promise<Record<string, number> | null> {
  const client = db();
  if (!client) return {};
  const { data, error } = await client
    .from("props")
    .select("type")
    .eq("fixture_id", fixtureId)
    .in("state", [...SETTLEABLE]);
  if (error) {
    console.error(`[db] activePropCounts(${fixtureId}) failed:`, error.message);
    return null;
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.type as string] = (counts[row.type as string] ?? 0) + 1;
  return counts;
}

/** Demo mode bootstrap: upsert the synthetic fixture and one live room so
    the whole engine can run without a live match. Returns the room id. */
export async function ensureSimFixtureAndRoom(args: {
  fixtureId: number;
  home: string;
  away: string;
  roomCode: string;
}): Promise<string | null> {
  const client = db();
  if (!client) return null;
  const { error: fixErr } = await client.from("fixtures").upsert(
    {
      id: args.fixtureId,
      home_team: args.home,
      away_team: args.away,
      kickoff_at: new Date().toISOString(),
      group_round: "SIM",
      status: "live",
    },
    { onConflict: "id" },
  );
  if (fixErr) {
    console.error("[db] ensureSimFixtureAndRoom fixture failed:", fixErr.message);
    return null;
  }
  const { data, error } = await client
    .from("rooms")
    .upsert(
      { fixture_id: args.fixtureId, room_code: args.roomCode, status: "live", visibility: "public" },
      { onConflict: "room_code" },
    )
    .select("id")
    .single();
  if (error) {
    console.error("[db] ensureSimFixtureAndRoom room failed:", error.message);
    return null;
  }
  return data.id as string;
}
