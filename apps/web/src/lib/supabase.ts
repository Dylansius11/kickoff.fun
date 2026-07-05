/* Browser Supabase client, null-safe singleton. Never throws at import time. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Row shape of public.fixtures (supabase/migrations/0001_init.sql). */
export interface FixtureRow {
  id: number;
  home_team: string;
  away_team: string;
  group_round: string | null;
  kickoff_at: string; // timestamptz ISO string
  status: "upcoming" | "live" | "final";
  last_snapshot: Record<string, unknown> | null;
}

let client: SupabaseClient | null | undefined;

/** Returns the shared browser client, or null when env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client =
    url && anonKey
      ? createClient(url, anonKey, { auth: { persistSession: false } })
      : null;
  return client;
}
