/**
 * The one admin-identity check (Phase 1, Slice 4). "No admin role in the database" is
 * an explicit, already-agreed design decision — admin-ness is `user.email === ADMIN_EMAIL`
 * (case-insensitive), computed here and re-run independently by `/admin`'s page.tsx AND
 * by every one of its Server Actions. Never trust a client-side "isAdmin" flag; never
 * cache the result across requests.
 *
 * Missing `ADMIN_EMAIL` entirely means nobody can ever pass this check — fail closed,
 * the opposite posture from the own-Gemini-key feature's fail-open "just unavailable"
 * (see `lib/config/env.ts`'s `adminEmail` comment for why).
 *
 * This function alone does NOT make it safe to call `admin_set_sign_up_enabled` /
 * `admin_list_daily_usage` / `admin_reset_daily_usage` on the user's own client — those
 * three have no grant to `authenticated` at all (see
 * `supabase/migrations/20260919000026_app_settings.sql`) and must be called through the
 * service-role client (`lib/supabase/admin.ts`), only after this check has passed on
 * that exact request.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AdminGuardResult = { ok: true; user: User } | { ok: false };

/**
 * `adminEmail` is passed in (already normalized by `readServerEnvironment().adminEmail`)
 * rather than read from `process.env` inside this function — the same
 * dependency-injection convention `getOwnGeminiApiKey`/`encryptGeminiKey` use for
 * `GEMINI_KEY_ENCRYPTION_SECRET`, so this stays directly unit-testable with a fake
 * client instead of needing to stub the environment.
 */
export async function requireAdminUser(
  client: SupabaseClient,
  adminEmail: string | null,
): Promise<AdminGuardResult> {
  if (adminEmail === null) return { ok: false };

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user || !user.email) return { ok: false };

  if (user.email.trim().toLowerCase() !== adminEmail) return { ok: false };

  return { ok: true, user };
}
