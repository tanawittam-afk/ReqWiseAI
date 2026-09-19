/**
 * The sign-up on/off switch's read side (Phase 1, Slice 4). `isSignUpEnabled` is a
 * single RPC call on a **user-scoped** client — same discipline as
 * `lib/analysis/daily-usage.ts` — and, unusually for this codebase, is called with no
 * session at all: `sign_up_is_enabled()` is granted to `anon` specifically because the
 * sign-up page runs before any user exists.
 *
 * `ok: false` here means the RPC itself failed (network/DB trouble), not that sign-up is
 * toggled off — the caller (`app/auth/actions.ts`'s `signUp()`) treats that as fail-open:
 * an outage turning into an indefinite, silent sign-up freeze is worse than occasionally
 * letting one through during a blip. A deliberate `enabled: false` is a normal `ok: true`
 * result and is what actually blocks sign-up.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignUpToggleResult = { ok: true; enabled: boolean } | { ok: false };

export async function isSignUpEnabled(client: SupabaseClient): Promise<SignUpToggleResult> {
  const { data, error } = await client.rpc("sign_up_is_enabled");
  if (error) {
    console.error(`[sign-up-toggle] read failed: ${error.message}`);
    return { ok: false };
  }
  if (typeof data !== "boolean") {
    console.error(`[sign-up-toggle] unexpected response shape: ${JSON.stringify(data)}`);
    return { ok: false };
  }
  return { ok: true, enabled: data };
}

/**
 * The `/admin` page's write side. `adminClient` must be the service-role client
 * (`lib/supabase/admin.ts`) — `admin_set_sign_up_enabled` has no grant to
 * `authenticated` at all, so this call only works there, and only after the caller has
 * already passed `requireAdminUser()` on this exact request.
 */
export async function setSignUpEnabled(
  adminClient: SupabaseClient,
  enabled: boolean,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient.rpc("admin_set_sign_up_enabled", {
    p_enabled: enabled,
    p_admin_user_id: adminUserId,
  });
  if (error) {
    console.error(`[sign-up-toggle] set failed: ${error.message}`);
    return { ok: false, error: "Could not update the sign-up switch. Try again." };
  }
  return { ok: true };
}
