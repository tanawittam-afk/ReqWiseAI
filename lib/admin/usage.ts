/**
 * The `/admin` page's usage view and reset (Phase 1, Slice 4). Reads/writes the
 * EXISTING `user_daily_usage` table (Slice 1) — no new usage table. Both functions
 * require `adminClient` to be the service-role client (`lib/supabase/admin.ts`):
 * `admin_list_daily_usage` and `admin_reset_daily_usage` have no grant to
 * `authenticated`, same reason as `setSignUpEnabled` in `sign-up-toggle.ts`. The caller
 * must have already passed `requireAdminUser()` on this exact request.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DailyUsageRow = {
  userId: string;
  email: string;
  analysesCount: number;
  updatedAt: string;
};

type RawUsageRow = {
  user_id: string;
  email: string;
  analyses_count: number;
  updated_at: string;
};

function parseUsageRows(data: unknown): DailyUsageRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is RawUsageRow => {
      const r = row as Record<string, unknown>;
      return (
        typeof r?.user_id === "string" &&
        typeof r?.email === "string" &&
        typeof r?.analyses_count === "number" &&
        typeof r?.updated_at === "string"
      );
    })
    .map((r) => ({
      userId: r.user_id,
      email: r.email,
      analysesCount: r.analyses_count,
      updatedAt: r.updated_at,
    }));
}

/** Today's per-user usage, admin's-eye view. Empty array on any failure — the page
 * degrades to "no usage today" rather than crashing; the failure itself is logged. */
export async function listTodayUsage(adminClient: SupabaseClient): Promise<DailyUsageRow[]> {
  const { data, error } = await adminClient.rpc("admin_list_daily_usage");
  if (error) {
    console.error(`[admin/usage] list failed: ${error.message}`);
    return [];
  }
  return parseUsageRows(data);
}

export async function resetUsage(
  adminClient: SupabaseClient,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient.rpc("admin_reset_daily_usage", {
    p_target_user_id: targetUserId,
  });
  if (error) {
    console.error(`[admin/usage] reset failed: ${error.message}`);
    return { ok: false, error: "Could not reset that user's counter. Try again." };
  }
  return { ok: true };
}
