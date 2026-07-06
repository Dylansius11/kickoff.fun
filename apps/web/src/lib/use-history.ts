"use client";

/* Post-match data: finished fixtures, settled props, and the user's own picks.
   All reads go through the anon Supabase client (RLS allows SELECT on
   fixtures/props/picks), null-safe like use-fixtures: no client, no crash,
   just empty results. */

import * as React from "react";
import { getSupabase, type FixtureRow } from "./supabase";
import { useKickUser } from "./auth";
import { storedUserId } from "./identity";

/* ── snapshot accessor ─────────────────────────────────────────────── */

/** Final score straight out of fixtures.last_snapshot
    ({ homeScore, awayScore, phase, clockSeconds, ... } from the ingest worker).
    Null when the fixture never got a snapshot on the wire. */
export function snapshotScore(f: FixtureRow): { home: number; away: number } | null {
  const s = f.last_snapshot;
  if (!s) return null;
  const home = s["homeScore"];
  const away = s["awayScore"];
  if (typeof home !== "number" || typeof away !== "number") return null;
  return { home, away };
}

/* ── row shapes ────────────────────────────────────────────────────── */

export interface PropOption {
  id: string;
  label: string;
}

export interface PropRow {
  id: string;
  fixture_id: number;
  type: string;
  prompt: string;
  options: PropOption[];
  state: "open" | "locked" | "under_review" | "settled" | "voided";
  resolution: { winning_option_id?: string; reason?: string } | null;
}

export interface PickRow {
  prop_id: string;
  choice: string;
  is_correct: boolean | null;
  points_awarded: number;
  settle_state: "pending" | "settled" | "voided";
  created_at: string;
}

/** Supabase embeds joined rows as object or array depending on the relation. */
function embeddedFixtureId(row: Record<string, unknown>): number | null {
  const p = row["props"];
  const obj = Array.isArray(p) ? p[0] : p;
  const id = obj && typeof obj === "object" ? (obj as Record<string, unknown>)["fixture_id"] : null;
  return typeof id === "number" ? id : null;
}

/* ── identity ──────────────────────────────────────────────────────── */

/** Resolve "who is this browser" for history lookups.
    Wallet users: users row by wallet_pubkey. Guests: the id the rooms APIs
    handed back (localStorage). Guests with nothing stored have no history. */
export function useHistoryIdentity(): {
  userId: string | null;
  resolved: boolean;
  guest: boolean;
} {
  const { ready, authenticated, address } = useKickUser();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [resolved, setResolved] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    const supabase = getSupabase();
    if (authenticated && address && supabase) {
      let cancelled = false;
      supabase
        .from("users")
        .select("id")
        .eq("wallet_pubkey", address)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setUserId((data?.id as string | undefined) ?? storedUserId());
          setResolved(true);
        });
      return () => {
        cancelled = true;
      };
    }
    setUserId(storedUserId());
    setResolved(true);
  }, [ready, authenticated, address]);

  return { userId, resolved, guest: ready && !authenticated };
}

/* ── lobby: which finished fixtures did I play? ────────────────────── */

/** Fixture ids the user has at least one pick in (one batched query). */
export function usePlayedFixtureIds(userId: string | null): Set<number> {
  const [ids, setIds] = React.useState<Set<number>>(() => new Set());

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("picks")
      .select("prop_id, props!inner(fixture_id)")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next = new Set<number>();
        for (const row of data as Record<string, unknown>[]) {
          const fid = embeddedFixtureId(row);
          if (fid !== null) next.add(fid);
        }
        setIds(next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return ids;
}

/* ── match detail ──────────────────────────────────────────────────── */

export interface MatchDetail {
  fixture: FixtureRow | null;
  props: PropRow[];
  picks: PickRow[];
  loading: boolean;
}

/** Fixture + its settled/voided props + this user's picks on them. */
export function useMatchDetail(fixtureId: number, userId: string | null): MatchDetail {
  const [fixture, setFixture] = React.useState<FixtureRow | null>(null);
  const [props, setProps] = React.useState<PropRow[]>([]);
  const [picks, setPicks] = React.useState<PickRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !Number.isFinite(fixtureId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from("fixtures").select("*").eq("id", fixtureId).maybeSingle(),
      supabase
        .from("props")
        .select("id, fixture_id, type, prompt, options, state, resolution")
        .eq("fixture_id", fixtureId)
        .in("state", ["settled", "voided"])
        .order("settled_at", { ascending: true }),
    ]).then(([fx, pr]) => {
      if (cancelled) return;
      setFixture((fx.data as FixtureRow | null) ?? null);
      setProps(((pr.data as PropRow[] | null) ?? []).filter((p) => Array.isArray(p.options)));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId || !Number.isFinite(fixtureId)) {
      setPicks([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("picks")
      .select("prop_id, choice, is_correct, points_awarded, settle_state, created_at, props!inner(fixture_id)")
      .eq("user_id", userId)
      .eq("props.fixture_id", fixtureId)
      .then(({ data }) => {
        if (cancelled) return;
        setPicks(((data as unknown as PickRow[] | null) ?? []).slice());
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureId, userId]);

  return { fixture, props, picks, loading };
}

/* ── locker: match history ─────────────────────────────────────────── */

export interface HistoryEntry {
  fixtureId: number;
  home: string;
  away: string;
  kickoffAt: string;
  correct: number;
  total: number;
  points: number;
  allCorrect: boolean;
  lastPickAt: string;
}

/** The user's picks grouped per fixture, most recent first, capped at 10. */
export function useMatchHistory(userId: string | null, resolved: boolean): {
  entries: HistoryEntry[];
  loading: boolean;
} {
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!resolved) return;
    const supabase = getSupabase();
    if (!supabase || !userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .from("picks")
      .select("prop_id, choice, is_correct, points_awarded, settle_state, created_at, props!inner(fixture_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(async ({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as Record<string, unknown>[];

        // group by fixture
        const byFixture = new Map<
          number,
          { correct: number; total: number; points: number; settled: number; lastPickAt: string }
        >();
        for (const row of rows) {
          const fid = embeddedFixtureId(row);
          if (fid === null) continue;
          const g =
            byFixture.get(fid) ??
            { correct: 0, total: 0, points: 0, settled: 0, lastPickAt: String(row["created_at"] ?? "") };
          g.total += 1;
          if (row["is_correct"] === true) g.correct += 1;
          if (row["settle_state"] === "settled") g.settled += 1;
          g.points += typeof row["points_awarded"] === "number" ? (row["points_awarded"] as number) : 0;
          byFixture.set(fid, g);
        }

        const ids = [...byFixture.keys()];
        if (ids.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }

        const { data: fixtures } = await supabase
          .from("fixtures")
          .select("id, home_team, away_team, kickoff_at")
          .in("id", ids);
        if (cancelled) return;

        const fixtureById = new Map(
          ((fixtures ?? []) as { id: number; home_team: string; away_team: string; kickoff_at: string }[]).map(
            (f) => [f.id, f],
          ),
        );

        const next: HistoryEntry[] = [];
        for (const [fid, g] of byFixture) {
          const f = fixtureById.get(fid);
          if (!f) continue;
          next.push({
            fixtureId: fid,
            home: f.home_team,
            away: f.away_team,
            kickoffAt: f.kickoff_at,
            correct: g.correct,
            total: g.total,
            points: g.points,
            allCorrect: g.total > 0 && g.correct === g.total,
            lastPickAt: g.lastPickAt,
          });
        }
        next.sort((a, b) => Date.parse(b.lastPickAt) - Date.parse(a.lastPickAt));
        setEntries(next.slice(0, 10));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, resolved]);

  return { entries, loading };
}
