/**
 * The own-Gemini-key bypass lookup (Phase 1, Slice 3 of the usable-product plan).
 *
 * `getOwnGeminiApiKey` is the single RPC call + decrypt, on a **user-scoped** client —
 * no service-role client here, same discipline as `daily-usage.ts`. It answers one
 * question for a call site: does this user have their own key, and if so, what is it
 * (decrypted, in memory, for this request only)?
 *
 * `apiKey: null` means no key is saved — the caller falls through to the shared daily
 * limit exactly as before Slice 3. An `ok: false` result means a key IS saved but could
 * not be used (the server's encryption secret is missing/misconfigured, or decryption
 * failed — wrong secret or tampered/corrupted material) — this is surfaced to the user
 * rather than silently falling back to the shared limit, so a broken own-key setup can
 * never look like "it just used the shared limit instead" when the user thinks their
 * own key is doing the work.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptGeminiKey } from "@/lib/security/gemini-key-crypto";

export type OwnGeminiKeyLookup =
  | { ok: true; apiKey: string | null }
  | { ok: false; error: string };

export const OWN_KEY_UNUSABLE_MESSAGE =
  "Your saved Gemini key could not be used. Check it in Settings.";

const GENERIC_LOOKUP_FAILURE = "Could not check your saved Gemini key. Try again.";

type MaterialRow = { ciphertext: string; iv: string; auth_tag: string };

function parseMaterialRow(data: unknown): MaterialRow | null {
  // get_my_gemini_key_material() is a `returns table(...)` function — supabase-js
  // hands back an array of rows, not a single object, same shape quirk as
  // increment_daily_usage() in daily-usage.ts.
  const row = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;
  if (typeof r.ciphertext !== "string" || typeof r.iv !== "string" || typeof r.auth_tag !== "string") {
    return null;
  }
  return { ciphertext: r.ciphertext, iv: r.iv, auth_tag: r.auth_tag };
}

export type GeminiKeyStatus = { hasKey: boolean; lastFour: string | null; updatedAt: string | null };

type StatusRow = { has_key: boolean; last_four: string | null; updated_at: string | null };

function parseStatusRow(data: unknown): StatusRow | null {
  // get_my_gemini_key_status() is also a `returns table(...)` function — same
  // array-of-rows shape as get_my_gemini_key_material() and increment_daily_usage().
  const row = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== "object") return null;

  const r = row as Record<string, unknown>;
  if (typeof r.has_key !== "boolean") return null;
  return {
    has_key: r.has_key,
    last_four: typeof r.last_four === "string" ? r.last_four : null,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}

/** The settings page's read: whether a key is saved, and the display-safe hint. Never key material. */
export async function getGeminiKeyStatus(client: SupabaseClient): Promise<GeminiKeyStatus> {
  const { data, error } = await client.rpc("get_my_gemini_key_status");
  if (error) {
    console.error(`[own-gemini-key] status lookup failed: ${error.message}`);
    return { hasKey: false, lastFour: null, updatedAt: null };
  }

  const row = parseStatusRow(data);
  if (!row) return { hasKey: false, lastFour: null, updatedAt: null };
  return { hasKey: row.has_key, lastFour: row.last_four, updatedAt: row.updated_at };
}

export async function getOwnGeminiApiKey(
  client: SupabaseClient,
  encryptionSecret: string | null,
): Promise<OwnGeminiKeyLookup> {
  const { data, error } = await client.rpc("get_my_gemini_key_material");
  if (error) {
    console.error(`[own-gemini-key] material lookup failed: ${error.message}`);
    return { ok: false, error: GENERIC_LOOKUP_FAILURE };
  }

  const material = parseMaterialRow(data);
  if (!material) return { ok: true, apiKey: null };

  if (encryptionSecret === null) {
    console.error(
      "[own-gemini-key] a saved key exists but GEMINI_KEY_ENCRYPTION_SECRET is not configured",
    );
    return { ok: false, error: OWN_KEY_UNUSABLE_MESSAGE };
  }

  try {
    const apiKey = decryptGeminiKey(
      { ciphertext: material.ciphertext, iv: material.iv, authTag: material.auth_tag },
      encryptionSecret,
    );
    return { ok: true, apiKey };
  } catch (err) {
    console.error(`[own-gemini-key] decrypt failed: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, error: OWN_KEY_UNUSABLE_MESSAGE };
  }
}
