"use server";

/**
 * Save/delete a user's own Gemini API key (Phase 1, Slice 3 of the usable-product plan).
 *
 * Validation is deliberately light — non-empty, trimmed, a sane max length — with **no
 * live call to Gemini to test the key**, per the approved design. A bad key is instead
 * discovered honestly the first time an analysis run tries it: `runAnalysis` already
 * persists a `provider_error` run rather than crashing (see `run-analysis.ts`), which
 * reports "could not authenticate" without ever needing this action to phone Gemini
 * itself just to validate a paste.
 *
 * The decrypted key never appears in this action's return value — only a generic
 * success message. The status a user actually sees (`•••• 7f3a`, updated-at) comes back
 * through `revalidatePath` re-rendering the settings page's own
 * `get_my_gemini_key_status()` read, never through this action's response body.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readServerEnvironment } from "@/lib/config/env";
import { encryptGeminiKey } from "@/lib/security/gemini-key-crypto";
import type { GeminiKeyFormState } from "./form-state";

const MAX_KEY_LENGTH = 512;

export async function saveGeminiKeyAction(
  _prev: GeminiKeyFormState,
  formData: FormData,
): Promise<GeminiKeyFormState> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (apiKey.length === 0) {
    return { error: "Paste your Gemini API key first." };
  }
  if (apiKey.length > MAX_KEY_LENGTH) {
    return { error: `That doesn't look like a Gemini API key (longer than ${MAX_KEY_LENGTH} characters).` };
  }

  const environment = readServerEnvironment();
  if (!environment.geminiKeyEncryption.available || environment.geminiKeyEncryption.secret === null) {
    console.error("[settings] saveGeminiKeyAction: GEMINI_KEY_ENCRYPTION_SECRET is not configured");
    return { error: "Saving your own key isn't available on this deployment yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: "Your session has expired. Sign in again." };
  }

  const material = encryptGeminiKey(apiKey, environment.geminiKeyEncryption.secret);
  const lastFour = apiKey.slice(-4);

  const { error } = await supabase.rpc("save_my_gemini_key", {
    p_ciphertext: material.ciphertext,
    p_iv: material.iv,
    p_auth_tag: material.authTag,
    p_last_four: lastFour,
  });
  if (error) {
    console.error(`[settings] saveGeminiKeyAction: ${error.message}`);
    return { error: "Could not save your key. Try again." };
  }

  revalidatePath("/workspace/settings");
  return { success: `Saved — ending in ${lastFour}.` };
}

/** Bound to a plain `<form action={deleteGeminiKeyAction}>` with no fields — nothing in
 * the submitted FormData is needed, so no parameter is declared for it. */
export async function deleteGeminiKeyAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_gemini_key");
  if (error) {
    console.error(`[settings] deleteGeminiKeyAction: ${error.message}`);
  }
  revalidatePath("/workspace/settings");
}
