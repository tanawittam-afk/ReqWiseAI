/**
 * The per-user daily analysis limit — proves the shape of the calls this layer issues
 * and how it maps a refusal back to a sentence. The RPCs' own atomicity (the
 * check-and-increment race, the Bangkok-midnight boundary) is the database's job and
 * needs a real Postgres to prove — see the "Manual verification" note in HANDOFF.md
 * once `20260917000024_daily_usage.sql` is applied.
 */

import { describe, expect, it } from "vitest";
import {
  bangkokToday,
  decrementDailyUsage,
  getDailyUsageToday,
  incrementDailyUsage,
} from "../../lib/analysis/daily-usage";
import { DAILY_ANALYSIS_LIMIT } from "../../lib/config/limits";
import { fakeSupabase } from "../fake-supabase";

describe("incrementDailyUsage", () => {
  it("passes the configured limit as p_limit and reports a spent slot", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { increment_daily_usage: { data: [{ allowed: true, remaining: 9 }] } } },
    );

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(client.rpcCalls[0]).toEqual({
      name: "increment_daily_usage",
      args: { p_limit: DAILY_ANALYSIS_LIMIT },
    });
    expect(result).toEqual({ ok: true, data: { allowed: true, remaining: 9 } });
  });

  it("reports the caller was already at the limit without a second round trip", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { increment_daily_usage: { data: [{ allowed: false, remaining: 0 }] } } },
    );

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ ok: true, data: { allowed: false, remaining: 0 } });
  });

  it("also accepts a bare object row, not only the array shape supabase-js returns for table functions", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { increment_daily_usage: { data: { allowed: true, remaining: 5 } } } },
    );

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ ok: true, data: { allowed: true, remaining: 5 } });
  });

  it("translates an expired session rather than leaking the raw Postgres message", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { increment_daily_usage: { error: { message: "authentication required" } } } },
    );

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ ok: false, error: "Your session has expired. Sign in again." });
  });

  it("falls back to a generic message for an unrecognized refusal", async () => {
    const client = fakeSupabase({}, { rpc: { increment_daily_usage: { error: { message: "boom" } } } });

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ ok: false, error: "Could not check today's analysis limit. Try again." });
  });

  it("treats an unparseable success row as a failure rather than a false allow", async () => {
    const client = fakeSupabase({}, { rpc: { increment_daily_usage: { data: [{}] } } });

    const result = await incrementDailyUsage(client, DAILY_ANALYSIS_LIMIT);

    expect(result.ok).toBe(false);
  });
});

describe("decrementDailyUsage", () => {
  it("calls the refund RPC with no arguments", async () => {
    const client = fakeSupabase({}, { rpc: { decrement_daily_usage: { data: null, error: null } } });

    await decrementDailyUsage(client);

    expect(client.rpcCalls[0]).toEqual({ name: "decrement_daily_usage", args: {} });
  });

  it("swallows a refund failure instead of throwing — it must never mask the original error", async () => {
    const client = fakeSupabase({}, { rpc: { decrement_daily_usage: { error: { message: "boom" } } } });

    await expect(decrementDailyUsage(client)).resolves.toBeUndefined();
  });
});

describe("getDailyUsageToday", () => {
  it("treats a missing row as zero used", async () => {
    const client = fakeSupabase({ user_daily_usage: [] });

    const result = await getDailyUsageToday(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ used: 0, remaining: DAILY_ANALYSIS_LIMIT, limit: DAILY_ANALYSIS_LIMIT });
  });

  it("reads today's count and computes what's left", async () => {
    const client = fakeSupabase({
      user_daily_usage: [{ usage_date: bangkokToday(), analyses_count: 4 }],
    });

    const result = await getDailyUsageToday(client, DAILY_ANALYSIS_LIMIT);

    expect(result).toEqual({ used: 4, remaining: DAILY_ANALYSIS_LIMIT - 4, limit: DAILY_ANALYSIS_LIMIT });
  });

  it("floors remaining at zero rather than going negative", async () => {
    const client = fakeSupabase({
      user_daily_usage: [{ usage_date: bangkokToday(), analyses_count: DAILY_ANALYSIS_LIMIT + 3 }],
    });

    const result = await getDailyUsageToday(client, DAILY_ANALYSIS_LIMIT);

    expect(result.remaining).toBe(0);
  });

  it("does not read a stale row for a different date", async () => {
    const client = fakeSupabase({
      user_daily_usage: [{ usage_date: "2000-01-01", analyses_count: 7 }],
    });

    const result = await getDailyUsageToday(client, DAILY_ANALYSIS_LIMIT);

    expect(result.used).toBe(0);
  });
});

describe("bangkokToday", () => {
  it("returns a YYYY-MM-DD date string", () => {
    expect(bangkokToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
