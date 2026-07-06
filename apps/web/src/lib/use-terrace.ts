"use client";

/* Live terrace data: real props, picks, leaderboard and Oracle lines off the
   props engine (Supabase + Realtime). One channel per room, four bindings:

     terrace:<roomId>
       props          event=* filter room_id=eq.<roomId>   (markets + settles)
       oracle_events  INSERT  filter room_id=eq.<roomId>   (the Gaffer's lines)
       room_members   event=* filter room_id=eq.<roomId>   (leaderboard refetch)
       fixtures       UPDATE  filter id=eq.<fixtureId>     (score + clock snapshot)

   Reads go straight to Supabase with the anon key (RLS allows select);
   the only write is POST /api/props/[id]/pick, service-role server side. */

import * as React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { rememberUserId, storedUserId } from "./identity";

/* Mirrors the props-engine contract (apps/ingest/src/props.ts). Do not drift. */
export interface PropOption {
  id: string;
  label: string;
  odds?: string;
}

export type PropDbState = "open" | "locked" | "under_review" | "settled" | "voided";

export interface LiveProp {
  id: string;
  room_id: string;
  type: string;
  prompt: string;
  options: PropOption[];
  state: PropDbState;
  resolution: { winning_option_id: string | null; reason: string } | null;
  opens_at: string;
  locks_at: string;
  settled_at: string | null;
}

export interface LiveMember {
  userId: string;
  handle: string;
  points: number;
  streak: number;
}

export interface LiveSnapshot {
  homeScore: number;
  awayScore: number;
  clockSeconds: number | null;
  phase: string;
}

export type PickOutcome = "ok" | "locked" | "already_picked" | "error";

interface Handlers {
  /** Fresh Oracle line landed (already applied to the feed). */
  onOracle?: (line: string, type: string) => void;
  /** A prop settled. won=true only when this browser picked the winner. */
  onSettle?: (prop: LiveProp, picked: boolean, won: boolean) => void;
  /** A prop flipped open -> locked (worker write via realtime). */
  onLock?: (prop: LiveProp) => void;
  /** Total goals in the fixture snapshot went up. */
  onGoal?: (snapshot: LiveSnapshot) => void;
}

const STATE_ORDER: Record<PropDbState, number> = {
  open: 0,
  locked: 1,
  under_review: 2,
  settled: 3,
  voided: 4,
};

function sortProps(list: LiveProp[]): LiveProp[] {
  return [...list].sort((a, b) => {
    const s = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (s !== 0) return s;
    // open: soonest lock first; everything else: freshest first
    if (a.state === "open") return Date.parse(a.locks_at) - Date.parse(b.locks_at);
    return Date.parse(b.locks_at) - Date.parse(a.locks_at);
  });
}

function toSnapshot(raw: unknown): LiveSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.homeScore !== "number" || typeof o.awayScore !== "number") return null;
  return {
    homeScore: o.homeScore,
    awayScore: o.awayScore,
    clockSeconds: typeof o.clockSeconds === "number" ? o.clockSeconds : null,
    phase: typeof o.phase === "string" ? o.phase : "pre",
  };
}

export function useTerraceLive(
  roomId: string | null,
  fixtureId: number | null,
  handlers: Handlers,
) {
  const [props, setProps] = React.useState<LiveProp[]>([]);
  const [propsLoaded, setPropsLoaded] = React.useState(false);
  const [myPicks, setMyPicks] = React.useState<Record<string, string>>({});
  const [members, setMembers] = React.useState<LiveMember[]>([]);
  const [snapshot, setSnapshot] = React.useState<LiveSnapshot | null>(null);
  const [oracleFeed, setOracleFeed] = React.useState<{ line: string; type: string }[]>([]);
  const [userId, setUserId] = React.useState<string | null>(null);

  // Latest values for the channel callbacks without resubscribing.
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;
  const picksRef = React.useRef(myPicks);
  picksRef.current = myPicks;
  const propsRef = React.useRef<Map<string, LiveProp>>(new Map());
  const snapshotRef = React.useRef<LiveSnapshot | null>(null);

  React.useEffect(() => {
    setUserId(storedUserId());
  }, []);

  const applyProps = React.useCallback((rows: LiveProp[]) => {
    for (const row of rows) propsRef.current.set(row.id, row);
    setProps(sortProps([...propsRef.current.values()]));
  }, []);

  const fetchMembers = React.useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;
    const { data } = await supabase
      .from("room_members")
      .select("user_id, points, streak, users(handle)")
      .eq("room_id", roomId)
      .order("points", { ascending: false })
      .order("joined_at", { ascending: true })
      .limit(50);
    if (!data) return;
    setMembers(
      data.map((m) => {
        const u = Array.isArray(m.users) ? m.users[0] : m.users;
        return {
          userId: m.user_id as string,
          handle: ((u as { handle?: string } | null)?.handle ?? "guest") as string,
          points: (m.points as number) ?? 0,
          streak: (m.streak as number) ?? 0,
        };
      }),
    );
  }, [roomId]);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;

    let cancelled = false;
    propsRef.current = new Map();

    // ── initial hydration ──
    (async () => {
      const [propRes] = await Promise.all([
        supabase
          .from("props")
          .select("id, room_id, type, prompt, options, state, resolution, opens_at, locks_at, settled_at")
          .eq("room_id", roomId)
          .order("opens_at", { ascending: false })
          .limit(24),
        fetchMembers(),
      ]);
      if (cancelled) return;
      if (propRes.data) applyProps(propRes.data as LiveProp[]);
      setPropsLoaded(true);

      const { data: events } = await supabase
        .from("oracle_events")
        .select("line, type, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!cancelled && events?.length) {
        setOracleFeed(events.map((e) => ({ line: e.line as string, type: e.type as string })));
      }

      if (fixtureId != null) {
        const { data: fx } = await supabase
          .from("fixtures")
          .select("last_snapshot")
          .eq("id", fixtureId)
          .maybeSingle();
        const snap = toSnapshot(fx?.last_snapshot);
        if (!cancelled && snap) {
          snapshotRef.current = snap;
          setSnapshot(snap);
        }
      }

      const uid = storedUserId();
      if (uid) {
        const { data: picks } = await supabase
          .from("picks")
          .select("prop_id, choice")
          .eq("room_id", roomId)
          .eq("user_id", uid);
        if (!cancelled && picks?.length) {
          setMyPicks(Object.fromEntries(picks.map((p) => [p.prop_id as string, p.choice as string])));
        }
      }
    })();

    // ── realtime ──
    let refetchTimer: number | undefined;
    const channel: RealtimeChannel = supabase
      .channel(`terrace:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "props", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as LiveProp | null;
          if (!row?.id) return;
          const prev = propsRef.current.get(row.id);
          applyProps([row]);
          if (prev?.state === "open" && row.state === "locked") handlersRef.current.onLock?.(row);
          if (prev && prev.state !== "settled" && row.state === "settled") {
            const mine = picksRef.current[row.id];
            const won = !!mine && mine === row.resolution?.winning_option_id;
            handlersRef.current.onSettle?.(row, !!mine, won);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "oracle_events", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { line?: string; type?: string } | null;
          if (!row?.line) return;
          const line = row.line;
          const type = row.type ?? "info";
          setOracleFeed((feed) => [{ line, type }, ...feed].slice(0, 5));
          handlersRef.current.onOracle?.(line, type);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        () => {
          // points live on room_members but handles need the users join: refetch, debounced
          window.clearTimeout(refetchTimer);
          refetchTimer = window.setTimeout(() => void fetchMembers(), 300);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fixtures", filter: `id=eq.${fixtureId ?? -1}` },
        (payload) => {
          const snap = toSnapshot((payload.new as { last_snapshot?: unknown } | null)?.last_snapshot);
          if (!snap) return;
          const prev = snapshotRef.current;
          snapshotRef.current = snap;
          setSnapshot(snap);
          if (prev && snap.homeScore + snap.awayScore > prev.homeScore + prev.awayScore) {
            handlersRef.current.onGoal?.(snap);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [roomId, fixtureId, applyProps, fetchMembers]);

  /** Optimistic, immutable pick. Reverts when the window is shut. */
  const pick = React.useCallback(
    async (
      propId: string,
      optionId: string,
      identity: { wallet?: string; handle?: string },
    ): Promise<PickOutcome> => {
      if (picksRef.current[propId]) return "already_picked";
      setMyPicks((p) => ({ ...p, [propId]: optionId }));
      const revert = () =>
        setMyPicks((p) => {
          const next = { ...p };
          delete next[propId];
          return next;
        });
      try {
        const res = await fetch(`/api/props/${encodeURIComponent(propId)}/pick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice: optionId,
            userId: storedUserId() ?? undefined,
            wallet: identity.wallet,
            handle: identity.handle,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          userId?: string;
          error?: string;
          choice?: string | null;
        };
        if (res.ok && data.ok) {
          if (data.userId) {
            rememberUserId(data.userId);
            setUserId(data.userId);
          }
          return "ok";
        }
        if (data.error === "already_picked") {
          // server has the truth; show the pick that actually stands
          setMyPicks((p) => ({ ...p, [propId]: data.choice ?? optionId }));
          if (data.userId) rememberUserId(data.userId);
          return "already_picked";
        }
        revert();
        return data.error === "locked" ? "locked" : "error";
      } catch {
        revert();
        return "error";
      }
    },
    [],
  );

  return { props, propsLoaded, myPicks, members, snapshot, oracleFeed, userId, pick };
}
