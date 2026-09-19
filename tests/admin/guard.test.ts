/**
 * The one admin-identity check (Phase 1, Slice 4) — proves the comparison itself, not
 * the RLS/grant boundary around the functions it gates, which needs a real Postgres
 * (see scripts/verify-admin.mts).
 */

import { describe, expect, it } from "vitest";
import { requireAdminUser } from "../../lib/admin/guard";
import { fakeSupabase } from "../fake-supabase";

describe("requireAdminUser", () => {
  it("refuses when ADMIN_EMAIL is not configured at all", async () => {
    const client = fakeSupabase({}, { userId: "user-1", userEmail: "owner@example.com" });

    const result = await requireAdminUser(client, null);

    expect(result).toEqual({ ok: false });
  });

  it("refuses a signed-out request", async () => {
    const client = fakeSupabase({}, { userId: null });

    const result = await requireAdminUser(client, "owner@example.com");

    expect(result).toEqual({ ok: false });
  });

  it("refuses an ordinary signed-in user whose email does not match", async () => {
    const client = fakeSupabase({}, { userId: "user-1", userEmail: "someone-else@example.com" });

    const result = await requireAdminUser(client, "owner@example.com");

    expect(result).toEqual({ ok: false });
  });

  it("accepts the admin, case-insensitively", async () => {
    const client = fakeSupabase({}, { userId: "user-1", userEmail: "Owner@Example.com" });

    const result = await requireAdminUser(client, "owner@example.com");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe("user-1");
  });
});
