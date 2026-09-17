/**
 * The own-Gemini-key bypass lookup (Phase 1, Slice 3) — proves the shape of the RPC
 * calls this layer issues and how it maps a stored-but-unusable key back to a clear,
 * non-leaking sentence. The RPCs' own row-level access control is the database's job
 * and needs a real Postgres to prove, same note as `daily-usage.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  getGeminiKeyStatus,
  getOwnGeminiApiKey,
  OWN_KEY_UNUSABLE_MESSAGE,
} from "../../lib/analysis/own-gemini-key";
import { encryptGeminiKey } from "../../lib/security/gemini-key-crypto";
import { fakeSupabase } from "../fake-supabase";

const SECRET = Buffer.alloc(32, 5).toString("base64");
const OTHER_SECRET = Buffer.alloc(32, 6).toString("base64");

function materialRow(plaintext: string, secret: string) {
  const material = encryptGeminiKey(plaintext, secret);
  return { ciphertext: material.ciphertext, iv: material.iv, auth_tag: material.authTag };
}

describe("getOwnGeminiApiKey", () => {
  it("returns apiKey: null when no key is saved — the caller falls through to the shared limit", async () => {
    const client = fakeSupabase({}, { rpc: { get_my_gemini_key_material: { data: [] } } });

    const result = await getOwnGeminiApiKey(client, SECRET);

    expect(result).toEqual({ ok: true, apiKey: null });
  });

  it("also accepts a bare object row, not only the array shape supabase-js returns for table functions", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_material: { data: materialRow("my-real-key", SECRET) } } },
    );

    const result = await getOwnGeminiApiKey(client, SECRET);

    expect(result).toEqual({ ok: true, apiKey: "my-real-key" });
  });

  it("decrypts a saved key with the configured secret", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_material: { data: [materialRow("AIzaSyRealGeminiKey", SECRET)] } } },
    );

    const result = await getOwnGeminiApiKey(client, SECRET);

    expect(result).toEqual({ ok: true, apiKey: "AIzaSyRealGeminiKey" });
    expect(client.rpcCalls[0]).toEqual({ name: "get_my_gemini_key_material", args: {} });
  });

  it("refuses without leaking anything when the encryption secret is not configured", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_material: { data: [materialRow("AIzaSyRealGeminiKey", SECRET)] } } },
    );

    const result = await getOwnGeminiApiKey(client, null);

    expect(result).toEqual({ ok: false, error: OWN_KEY_UNUSABLE_MESSAGE });
  });

  it("refuses without leaking the raw decrypt error when the secret is wrong", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_material: { data: [materialRow("AIzaSyRealGeminiKey", SECRET)] } } },
    );

    const result = await getOwnGeminiApiKey(client, OTHER_SECRET);

    expect(result).toEqual({ ok: false, error: OWN_KEY_UNUSABLE_MESSAGE });
  });

  it("translates an RPC failure into a generic message", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_material: { error: { message: "boom" } } } },
    );

    const result = await getOwnGeminiApiKey(client, SECRET);

    expect(result).toEqual({ ok: false, error: "Could not check your saved Gemini key. Try again." });
  });

  it("treats an unparseable row as no key saved rather than a false positive", async () => {
    const client = fakeSupabase({}, { rpc: { get_my_gemini_key_material: { data: [{}] } } });

    const result = await getOwnGeminiApiKey(client, SECRET);

    expect(result).toEqual({ ok: true, apiKey: null });
  });
});

describe("getGeminiKeyStatus", () => {
  it("reports has_key: false when nothing is saved", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { get_my_gemini_key_status: { data: [{ has_key: false, last_four: null, updated_at: null }] } } },
    );

    const result = await getGeminiKeyStatus(client);

    expect(result).toEqual({ hasKey: false, lastFour: null, updatedAt: null });
  });

  it("reports the display-safe hint when a key is saved", async () => {
    const client = fakeSupabase(
      {},
      {
        rpc: {
          get_my_gemini_key_status: {
            data: [{ has_key: true, last_four: "7f3a", updated_at: "2026-09-18T00:00:00Z" }],
          },
        },
      },
    );

    const result = await getGeminiKeyStatus(client);

    expect(result).toEqual({ hasKey: true, lastFour: "7f3a", updatedAt: "2026-09-18T00:00:00Z" });
  });

  it("degrades to has_key: false rather than throwing when the RPC fails", async () => {
    const client = fakeSupabase({}, { rpc: { get_my_gemini_key_status: { error: { message: "boom" } } } });

    const result = await getGeminiKeyStatus(client);

    expect(result).toEqual({ hasKey: false, lastFour: null, updatedAt: null });
  });
});
