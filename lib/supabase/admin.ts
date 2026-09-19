/**
 * Service-role Supabase client — bypasses RLS. Server-only, and narrow by design.
 *
 * Sanctioned uses (docs/architecture/ARCHITECTURE.md §B.5, DATA-MODEL §C.7):
 *   - seeding / maintaining `domain_profiles`
 *   - inserting `analysis_items` during an analysis run, which has no INSERT policy
 *     precisely so that only the server can write items
 *   - `/admin`'s privileged reads/writes (Phase 1, Slice 4: `admin_list_daily_usage`,
 *     `admin_reset_daily_usage`, `admin_set_sign_up_enabled`) — those three functions
 *     have no grant to `authenticated` at all, so this is the only client that can call
 *     them, and only ever after `lib/admin/guard.ts`'s `requireAdminUser()` has already
 *     verified the caller's email against `ADMIN_EMAIL` on that exact request
 *
 * Everything else goes through `server.ts` so RLS stays the security boundary. The
 * guards below are load-bearing: the key must never reach a browser bundle, and a
 * request handler must never hand user input to this client.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "the service-role Supabase client must never be constructed in the browser",
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is server-only — never prefix it with NEXT_PUBLIC_.",
    );
  }

  return createSupabaseClient(supabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
