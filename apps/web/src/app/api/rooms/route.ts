import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateRoomCode, resolveUser, UNIQUE_VIOLATION } from "@/lib/rooms-server";

export const runtime = "nodejs";

const CreateRoomBody = z.object({
  fixtureId: z.number().int(),
  name: z.string().trim().min(1).max(40),
  visibility: z.enum(["private", "public"]),
  handle: z.string().trim().min(1).max(32).optional(),
  wallet: z.string().trim().min(32).max(64).optional(),
});

/** POST /api/rooms: create a terrace. Service role writes; RLS blocks clients. */
export async function POST(req: Request) {
  let body: z.infer<typeof CreateRoomBody>;
  try {
    body = CreateRoomBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: fixture } = await admin
      .from("fixtures")
      .select("id, home_team, away_team")
      .eq("id", body.fixtureId)
      .maybeSingle();
    if (!fixture) return NextResponse.json({ error: "fixture not found" }, { status: 404 });

    const hostId = await resolveUser(admin, { handle: body.handle, wallet: body.wallet });

    // Collision-retry loop: room_code is unique, regenerate on 23505 (max 5 tries).
    let room: { id: string; room_code: string } | null = null;
    for (let attempt = 0; attempt < 5 && !room; attempt++) {
      const code = generateRoomCode(fixture.home_team as string);
      const { data, error } = await admin
        .from("rooms")
        .insert({
          fixture_id: fixture.id,
          host_user_id: hostId,
          room_code: code,
          name: body.name,
          status: "open",
          visibility: body.visibility,
        })
        .select("id, room_code")
        .single();
      if (data) room = data;
      else if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    }
    if (!room) return NextResponse.json({ error: "could not allocate a code" }, { status: 500 });

    const { error: memberErr } = await admin
      .from("room_members")
      .insert({ room_id: room.id, user_id: hostId });
    if (memberErr && memberErr.code !== UNIQUE_VIOLATION) throw new Error(memberErr.message);

    return NextResponse.json(
      { code: room.room_code, roomId: room.id, fixtureId: fixture.id, userId: hostId },
      { status: 201 },
    );
  } catch (e) {
    console.error("[api/rooms] create failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
