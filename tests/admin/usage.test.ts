/**
 * The admin usage view and reset (Phase 1, Slice 4) — proves the shape of the calls and
 * the row-parsing/degrade-on-failure behavior. `admin_list_daily_usage`'s join to
 * `auth.users` and the Bangkok-date filter are the database's job — see
 * scripts/verify-admin.mts.
 */

import { describe, expect, it } from "vitest";
import { listTodayUsage, resetUsage } from "../../lib/admin/usage";
import { fakeSupabase } from "../fake-supabase";

describe("listTodayUsage", () => {
  it("maps snake_case rows to the camelCase shape the UI reads", async () => {
    const client = fakeSupabase(
      {},
      {
        rpc: {
          admin_list_daily_usage: {
            data: [
              { user_id: "user-1", email: "a@example.com", analyses_count: 4, updated_at: "2026-09-19T00:00:00Z" },
            ],
          },
        },
      },
    );

    const rows = await listTodayUsage(client);

    expect(rows).toEqual([
      { userId: "user-1", email: "a@example.com", analysesCount: 4, updatedAt: "2026-09-19T00:00:00Z" },
    ]);
  });

  it("degrades to an empty list on failure rather than throwing", async () => {
    const client = fakeSupabase({}, { rpc: { admin_list_daily_usage: { error: { message: "boom" } } } });

    const rows = await listTodayUsage(client);

    expect(rows).toEqual([]);
  });

  it("drops a malformed row instead of passing it through", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { admin_list_daily_usage: { data: [{ user_id: "user-1" }] } } },
    );

    const rows = await listTodayUsage(client);

    expect(rows).toEqual([]);
  });
});

describe("resetUsage", () => {
  it("passes the target user id", async () => {
    const client = fakeSupabase({}, { rpc: { admin_reset_daily_usage: { data: null, error: null } } });

    const result = await resetUsage(client, "user-1");

    expect(client.rpcCalls[0]).toEqual({
      name: "admin_reset_daily_usage",
      args: { p_target_user_id: "user-1" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("translates a failure into a sentence that names no table", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { admin_reset_daily_usage: { error: { message: "permission denied for function" } } } },
    );

    const result = await resetUsage(client, "user-1");

    expect(result).toEqual({ ok: false, error: "Could not reset that user's counter. Try again." });
  });
});
