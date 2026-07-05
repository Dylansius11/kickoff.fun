/* Server-only Supabase client using the service role key.
   RLS lets clients read; every game-state WRITE flows through route handlers
   that use this client. The service role key must never reach the browser:
   it is not NEXT_PUBLIC_*, so Next.js never inlines it into client bundles,
   and the window guard below makes any accidental client import blow up loudly. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("supabase-admin is server-only. Never import it from client code.");
}

let admin: SupabaseClient | undefined;

/** Shared service-role client. Throws when server env is missing. */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return admin;
}
