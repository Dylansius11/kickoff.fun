import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchPhase, MatchState } from "@kick/shared";

/* ── Supabase persistence for the ingest worker ──
   Service-role client: RLS in supabase/migrations/0001_init.sql grants writes
   to service_role only, so this module is the single write path for game
   state. Every exported function is NON-THROWING: a Supabase outage logs to
   stderr and returns a harmless value; it must never kill the poll loop.

   TODO(props engine): settleProp / awardPoints land here once the props
   engine exists (props, picks, points_ledger writes). Out of scope for now. */

/** TxLINE fixture snapshot row (fields observed live, July 4 2026). */
export interface TxLineFixtureRow {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  /** Epoch time; TxLINE serves seconds, but we tolerate ms defensively. */
  StartTime: number;
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

/** Idempotent fixtures upsert keyed on the TxLINE fixture id.
    `status` and `last_snapshot` are intentionally OMITTED: inserts take the
    'upcoming' column default, and re-runs never clobber what the live loop
    has since written. Returns the number of rows written (0 on failure). */
export async function upsertFixtures(fixtures: TxLineFixtureRow[]): Promise<number> {
  const client = db();
  if (!client || fixtures.length === 0) return 0;
  const rows = fixtures.map((f) => ({
    id: f.FixtureId,
    home_team: f.Participant1IsHome ? f.Participant1 : f.Participant2,
    away_team: f.Participant1IsHome ? f.Participant2 : f.Participant1,
    kickoff_at: toIso(f.StartTime),
    group_round: f.Group ?? f.GroupName ?? f.Round ?? null,
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

/** Fan an Oracle line out to every live room on a fixture: one oracle_events
    row per room in ('open','live'). No rooms means nobody is listening; that
    is a silent no-op, not an error. Returns rooms reached. */
export async function insertOracleEvent(fixtureId: number, type: string, line: string): Promise<number> {
  const client = db();
  if (!client) return 0;
  const { data: rooms, error: roomErr } = await client
    .from("rooms")
    .select("id")
    .eq("fixture_id", fixtureId)
    .in("status", ["open", "live"]);
  if (roomErr) {
    console.error(`[db] oracle room lookup(${fixtureId}) failed:`, roomErr.message);
    return 0;
  }
  if (!rooms || rooms.length === 0) return 0;
  const { error } = await client
    .from("oracle_events")
    .insert(rooms.map((r) => ({ room_id: r.id, type, line })));
  if (error) {
    console.error(`[db] insertOracleEvent(${fixtureId}) failed:`, error.message);
    return 0;
  }
  return rooms.length;
}
