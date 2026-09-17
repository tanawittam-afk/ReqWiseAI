/**
 * The per-user daily analysis limit (Phase 1, Slice 1 of the usable-product plan).
 *
 * `incrementDailyUsage` / `decrementDailyUsage` are single RPC calls each, on a
 * **user-scoped** client — no service-role client in this file, same discipline as
 * `persist.ts` and `review/service.ts`. `increment_daily_usage` is SECURITY DEFINER so
 * it can do the atomic check-and-spend from `auth.uid()`; this layer's job is only to
 * shape the call and translate a refusal into a sentence, never to decide the limit
 * itself (that is `lib/config/limits.ts`, passed in by the caller).
 *
 * `getDailyUsageToday` is a plain read (RLS already scopes it to the caller's own
 * rows), used to render "N of 10 left today" without spending a slot.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type IncrementDailyUsageResult = { allowed: boolean; remaining: number };

export type DailyUsageServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type DailyUsageToday = { used: number; remaining: number; limit: number };

const GENERIC_INCREMENT_FAILURE = "Could not check today's analysis limit. Try again.";

/** Postgres errors are for the log; the caller gets a sentence that names no table. */
function translate(detail: string): string {
  if (/authentication required/i.test(detail)) return "Your session has expired. Sign in again.";
  return GENERIC_INCREMENT_FAILURE;
}

function parseIncrementRow(data: unknown): IncrementDailyUsageResult | null {
  // increment_daily_usage() is a `returns table(...)` function — supabase-js hands
  // back an array of rows, not a single object like the jsonb-returning RPCs.
  const row = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;
  if (typeof r.allowed !== "boolean" || typeof r.remaining !== "number") return null;
  return { allowed: r.allowed, remaining: r.remaining };
}

/**
 * Atomically spends one of today's slots, if any remain. `allowed: false` means the
 * caller was already at `limit` before this call — nothing was spent twice.
 */
export async function incrementDailyUsage(
  client: SupabaseClient,
  limit: number,
): Promise<DailyUsageServiceResult<IncrementDailyUsageResult>> {
  const { data, error } = await client.rpc("increment_daily_usage", { p_limit: limit });
  if (error) {
    console.error(`[daily-usage] increment failed: ${error.message}`);
    return { ok: false, error: translate(error.message) };
  }

  const row = parseIncrementRow(data);
  if (!row) return { ok: false, error: GENERIC_INCREMENT_FAILURE };
  return { ok: true, data: row };
}

/**
 * Refunds one slot after a successful increment whose analysis then failed. Best
 * effort and silent by design: this runs inside an already-failing request, and a
 * failed refund must never mask the original error the caller is about to return.
 */
export async function decrementDailyUsage(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("decrement_daily_usage");
  if (error) {
    console.error(`[daily-usage] refund failed: ${error.message}`);
  }
}

/**
 * "Today" in Asia/Bangkok, as `YYYY-MM-DD` — matches `(now() at time zone
 * 'Asia/Bangkok')::date` on the database side. Computed server-side; never trust the
 * browser's clock or timezone for this.
 */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/** How many of today's slots are left, without spending one. A missing row is 0 used. */
export async function getDailyUsageToday(client: SupabaseClient, limit: number): Promise<DailyUsageToday> {
  const { data, error } = await client
    .from("user_daily_usage")
    .select("analyses_count")
    .eq("usage_date", bangkokToday())
    .maybeSingle();

  if (error) throw new Error(`daily usage query failed: ${error.message}`);

  const used = (data as { analyses_count: number } | null)?.analyses_count ?? 0;
  return { used, remaining: Math.max(limit - used, 0), limit };
}
