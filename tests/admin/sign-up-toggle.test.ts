/**
 * The sign-up toggle's read and write (Phase 1, Slice 4) — proves the shape of the
 * calls and the fail-open-on-RPC-error posture. The RPC's own anon-callable grant and
 * the "no grant to authenticated" boundary on the write side are the database's job —
 * see scripts/verify-admin.mts.
 */

import { describe, expect, it } from "vitest";
import { isSignUpEnabled, setSignUpEnabled } from "../../lib/admin/sign-up-toggle";
import { fakeSupabase } from "../fake-supabase";

describe("isSignUpEnabled", () => {
  it("reports enabled", async () => {
    const client = fakeSupabase({}, { rpc: { sign_up_is_enabled: { data: true } } });

    const result = await isSignUpEnabled(client);

    expect(result).toEqual({ ok: true, enabled: true });
  });

  it("reports disabled", async () => {
    const client = fakeSupabase({}, { rpc: { sign_up_is_enabled: { data: false } } });

    const result = await isSignUpEnabled(client);

    expect(result).toEqual({ ok: true, enabled: false });
  });

  it("fails open on an RPC error — the caller decides what that means, not this function", async () => {
    const client = fakeSupabase({}, { rpc: { sign_up_is_enabled: { error: { message: "boom" } } } });

    const result = await isSignUpEnabled(client);

    expect(result).toEqual({ ok: false });
  });

  it("treats an unparseable response as a failure rather than a silent true", async () => {
    const client = fakeSupabase({}, { rpc: { sign_up_is_enabled: { data: "not-a-boolean" } } });

    const result = await isSignUpEnabled(client);

    expect(result).toEqual({ ok: false });
  });
});

describe("setSignUpEnabled", () => {
  it("passes the target state and the acting admin's id", async () => {
    const client = fakeSupabase({}, { rpc: { admin_set_sign_up_enabled: { data: null, error: null } } });

    const result = await setSignUpEnabled(client, false, "admin-1");

    expect(client.rpcCalls[0]).toEqual({
      name: "admin_set_sign_up_enabled",
      args: { p_enabled: false, p_admin_user_id: "admin-1" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("translates a failure into a sentence that names no table", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { admin_set_sign_up_enabled: { error: { message: "permission denied for function" } } } },
    );

    const result = await setSignUpEnabled(client, true, "admin-1");

    expect(result).toEqual({ ok: false, error: "Could not update the sign-up switch. Try again." });
  });
});
