import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchRoomsForUser } from "@/lib/rooms-server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/me/rooms?userId=<users.id>: the rooms this user is a member of,
    newest join first, each with fixture info + live member count.
    RLS hides private rooms from the anon client, so the terrace index reads
    membership through this service-role route instead. */
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")?.trim() ?? "";
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "userId must be a users.id uuid" }, { status: 400 });
  }
  try {
    const rooms = await fetchRoomsForUser(getSupabaseAdmin(), userId);
    return NextResponse.json({ rooms });
  } catch (e) {
    console.error("[api/me/rooms] lookup failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
