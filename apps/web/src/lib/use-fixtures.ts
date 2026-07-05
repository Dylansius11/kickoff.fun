"use client";

/* Live fixtures from Supabase with Realtime merge and a mock fallback,
   so the lobby never renders an empty screen during the demo. */

import * as React from "react";
import { getSupabase, type FixtureRow } from "./supabase";
import { FIXTURES as MOCK_FIXTURES } from "../app/app/mock";

const STATUS_RANK: Record<FixtureRow["status"], number> = {
  live: 0,
  upcoming: 1,
  final: 2,
};

/** Mock fixtures mapped into FixtureRow shape (negative ids, never collide with TxLINE ids). */
const MOCK_ROWS: FixtureRow[] = MOCK_FIXTURES.map((f, i) => ({
  id: -(i + 1),
  home_team: f.home,
  away_team: f.away,
  group_round: f.round,
  // mock kickoff strings ("19:00", "LIVE", "FT") are not timestamps; synthesize
  kickoff_at: new Date(Date.now() + (i + 1) * 90 * 60 * 1000).toISOString(),
  status: f.status,
  last_snapshot: null,
}));

function sortFixtures(rows: FixtureRow[]): FixtureRow[] {
  return [...rows].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at),
  );
}

export function useFixtures(): {
  fixtures: FixtureRow[];
  loading: boolean;
  live: boolean;
} {
  const [fixtures, setFixtures] = React.useState<FixtureRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setFixtures(sortFixtures(MOCK_ROWS));
      setLive(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase
      .from("fixtures")
      .select("*")
      .order("kickoff_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setFixtures(sortFixtures(MOCK_ROWS));
          setLive(false);
        } else {
          setFixtures(sortFixtures(data as FixtureRow[]));
          setLive(true);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel("fixtures-lobby")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fixtures" },
        (payload) => {
          const row = payload.new as FixtureRow | null;
          if (!row || typeof row.id !== "number") return;
          setFixtures((prev) => {
            const next = prev.some((f) => f.id === row.id)
              ? prev.map((f) => (f.id === row.id ? row : f))
              : [...prev.filter((f) => f.id > 0), row]; // drop mock rows once real data streams in
            return sortFixtures(next);
          });
          setLive(true);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { fixtures, loading, live };
}
