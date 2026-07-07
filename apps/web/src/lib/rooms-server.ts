/* Shared server logic for the /api/rooms handlers. Server-only. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { teamCode } from "./team-code";

/** Crockford-ish base32: no 0/O/1/I/L, so codes survive being shouted across a pub. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** "BRA-7K2": home-team prefix + 3 random base32 chars. */
export function generateRoomCode(homeTeam: string): string {
  let suffix = "";
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `${teamCode(homeTeam)}-${suffix}`;
}

/** Postgres unique_violation, used for code-collision retries and idempotent joins. */
export const UNIQUE_VIOLATION = "23505";

/** Find (by wallet) or create the users row for a request. Returns users.id. */
export async function resolveUser(
  admin: SupabaseClient,
  opts: { handle?: string; wallet?: string },
): Promise<string> {
  const handle = opts.handle?.trim() || "guest";
  if (opts.wallet) {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("wallet_pubkey", opts.wallet)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data, error } = await admin
    .from("users")
    .insert({ handle, wallet_pubkey: opts.wallet ?? null })
    .select("id")
    .single();
  if (error || !data) throw new Error(`user upsert failed: ${error?.message ?? "no row"}`);
  return data.id as string;
}

export interface RoomInfo {
  roomId: string;
  code: string;
  name: string | null;
  status: string;
  visibility: string;
  members: number;
  fixture: {
    id: number;
    home_team: string;
    away_team: string;
    group_round: string | null;
    kickoff_at: string;
    status: string;
  };
}

/** All rooms a user is a member of (newest join first), each with fixture +
    live member count. Powers GET /api/me/rooms and the terrace index page. */
export async function fetchRoomsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<RoomInfo[]> {
  const { data, error } = await admin
    .from("room_members")
    .select(
      "joined_at, room:rooms(id, room_code, name, status, visibility, fixture:fixtures(id, home_team, away_team, group_round, kickoff_at, status))",
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error(`member rooms lookup failed: ${error.message}`);

  const rooms: RoomInfo[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const roomRaw = row["room"];
    const room = (Array.isArray(roomRaw) ? roomRaw[0] : roomRaw) as
      | Record<string, unknown>
      | null
      | undefined;
    if (!room) continue;
    const fixtureRaw = room["fixture"];
    const fixture = Array.isArray(fixtureRaw) ? fixtureRaw[0] : fixtureRaw;
    if (!fixture) continue;
    rooms.push({
      roomId: room["id"] as string,
      code: room["room_code"] as string,
      name: (room["name"] as string | null) ?? null,
      status: room["status"] as string,
      visibility: room["visibility"] as string,
      members: 0,
      fixture: fixture as RoomInfo["fixture"],
    });
  }

  // one batched count query instead of N head-counts
  if (rooms.length > 0) {
    const { data: memberRows } = await admin
      .from("room_members")
      .select("room_id")
      .in("room_id", rooms.map((r) => r.roomId));
    const counts = new Map<string, number>();
    for (const m of (memberRows ?? []) as { room_id: string }[]) {
      counts.set(m.room_id, (counts.get(m.room_id) ?? 0) + 1);
    }
    for (const r of rooms) r.members = counts.get(r.roomId) ?? 0;
  }

  return rooms;
}

/** Room + fixture + live member count, or null when the code is unknown. */
export async function fetchRoomInfo(admin: SupabaseClient, code: string): Promise<RoomInfo | null> {
  const { data: room } = await admin
    .from("rooms")
    .select(
      "id, room_code, name, status, visibility, fixture:fixtures(id, home_team, away_team, group_round, kickoff_at, status)",
    )
    .eq("room_code", code.trim().toUpperCase())
    .maybeSingle();
  if (!room || !room.fixture) return null;

  const { count } = await admin
    .from("room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  const fixture = Array.isArray(room.fixture) ? room.fixture[0] : room.fixture;
  return {
    roomId: room.id as string,
    code: room.room_code as string,
    name: (room.name as string | null) ?? null,
    status: room.status as string,
    visibility: room.visibility as string,
    members: count ?? 0,
    fixture: fixture as RoomInfo["fixture"],
  };
}
