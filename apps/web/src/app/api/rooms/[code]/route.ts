import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchRoomInfo } from "@/lib/rooms-server";

export const runtime = "nodejs";

/** GET /api/rooms/[code]: room + fixture + member count. 404 when unknown. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  try {
    const room = await fetchRoomInfo(getSupabaseAdmin(), code);
    if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
    return NextResponse.json(room);
  } catch (e) {
    console.error("[api/rooms/[code]] lookup failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
