import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveUser, UNIQUE_VIOLATION } from "@/lib/rooms-server";

export const runtime = "nodejs";

const PickBody = z.object({
  /** Option id from props.options[].id (the value settlement compares against). */
  choice: z.string().trim().min(1).max(64),
  wallet: z.string().trim().min(32).max(64).optional(),
  handle: z.string().trim().min(1).max(32).optional(),
  /** users.id from a previous response, so guests keep one identity. */
  userId: z.string().uuid().optional(),
});

interface PropRow {
  id: string;
  room_id: string;
  state: string;
  locks_at: string;
  options: { id: string; label: string; odds?: string }[];
}

/** POST /api/props/[id]/pick: one immutable pick per (prop, user).
    409 { error: "locked" } when the window is shut,
    409 { error: "already_picked", choice } when the user already called it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "bad prop id" }, { status: 400 });
  }

  let body: z.infer<typeof PickBody>;
  try {
    body = PickBody.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: prop } = await admin
      .from("props")
      .select("id, room_id, state, locks_at, options")
      .eq("id", id)
      .maybeSingle<PropRow>();
    if (!prop) return NextResponse.json({ error: "prop not found" }, { status: 404 });

    // The window: state must be open AND locks_at still ahead of the clock.
    // The worker flips state on its own tick, so check both to close the gap.
    if (prop.state !== "open" || Date.parse(prop.locks_at) <= Date.now()) {
      return NextResponse.json({ error: "locked" }, { status: 409 });
    }

    const options = Array.isArray(prop.options) ? prop.options : [];
    if (!options.some((o) => o?.id === body.choice)) {
      return NextResponse.json({ error: "bad choice" }, { status: 400 });
    }

    // Reuse the caller's users row when the id checks out; otherwise mint one.
    let userId: string | null = null;
    if (body.userId) {
      const { data } = await admin
        .from("users")
        .select("id")
        .eq("id", body.userId)
        .maybeSingle();
      if (data?.id) userId = data.id as string;
    }
    if (!userId) userId = await resolveUser(admin, body);

    // Picking pulls you onto the terrace: leaderboard rows come from room_members.
    const { error: memberErr } = await admin
      .from("room_members")
      .insert({ room_id: prop.room_id, user_id: userId });
    if (memberErr && memberErr.code !== UNIQUE_VIOLATION) throw new Error(memberErr.message);

    // Picks are immutable: the unique (prop_id, user_id) key is the law.
    const { error } = await admin
      .from("picks")
      .insert({ prop_id: prop.id, user_id: userId, room_id: prop.room_id, choice: body.choice });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        const { data: existing } = await admin
          .from("picks")
          .select("choice")
          .eq("prop_id", prop.id)
          .eq("user_id", userId)
          .maybeSingle();
        return NextResponse.json(
          { error: "already_picked", choice: existing?.choice ?? null, userId },
          { status: 409 },
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    console.error("[api/props/[id]/pick] failed:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
