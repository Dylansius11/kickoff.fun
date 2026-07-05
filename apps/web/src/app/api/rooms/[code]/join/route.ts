import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchRoomInfo, resolveUser, UNIQUE_VIOLATION } from "@/lib/rooms-server";

export const runtime = "nodejs";

const JoinBody = z.object({
  handle: z.string().trim().min(1).max(32).optional(),
  wallet: z.string().trim().min(32).max(64).optional(),
});

/** POST /api/rooms/[code]/join: upsert user, add to the terrace (idempotent). */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  let body: z.infer<typeof JoinBody>;
  try {
    body = JoinBody.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const room = await fetchRoomInfo(admin, code);
    if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });

    const userId = await resolveUser(admin, body);
    const { error } = await admin
      .from("room_members")
      .insert({ room_id: room.roomId, user_id: userId });
    // unique violation = already on the terrace; treat as success
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    if (!error) room.members += 1;

    return NextResponse.json(room);
  } catch (e) {
    console.error("[api/rooms/[code]/join] failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
