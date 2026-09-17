/**
 * AES-256-GCM encrypt/decrypt for a user's own Gemini API key (Phase 1, Slice 3).
 *
 * Node's built-in `crypto` only — no new npm dependency (CLAUDE.md → Stack: "Do not add
 * a library beyond the list above without asking").
 *
 * The secret is passed in already base64-encoded (`GEMINI_KEY_ENCRYPTION_SECRET`, read
 * and validated by `lib/config/env.ts`) and must decode to exactly 32 bytes — the key
 * size AES-256 requires. Every input/output that leaves this module is base64 text,
 * matching what `save_my_gemini_key`/`get_my_gemini_key_material`
 * (`supabase/migrations/20260918000025_user_gemini_keys.sql`) store and return.
 *
 * `decryptGeminiKey` throws on a wrong secret or a tampered ciphertext/auth tag by
 * construction — GCM's `final()` call fails the authentication check rather than
 * silently returning garbage. Callers must not swallow that and treat it as "key
 * available"; `lib/analysis/own-gemini-key.ts` turns it into a clear user-facing error
 * instead.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce — the size GCM is designed for.

export type GeminiKeyMaterial = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

/** Decodes and length-checks the encryption secret. Throws with no key material in the message. */
function decodeSecret(secretBase64: string): Buffer {
  const key = Buffer.from(secretBase64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `GEMINI_KEY_ENCRYPTION_SECRET must decode to exactly ${KEY_BYTES} bytes (got ${key.length})`,
    );
  }
  return key;
}

export function encryptGeminiKey(plaintext: string, secretBase64: string): GeminiKeyMaterial {
  const key = decodeSecret(secretBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptGeminiKey(material: GeminiKeyMaterial, secretBase64: string): string {
  const key = decodeSecret(secretBase64);
  const iv = Buffer.from(material.iv, "base64");
  const authTag = Buffer.from(material.authTag, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(material.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
