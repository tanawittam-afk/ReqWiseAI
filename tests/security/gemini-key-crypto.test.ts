/**
 * AES-256-GCM round trip for the own-Gemini-key bypass (Phase 1, Slice 3). Proves the
 * contract `lib/analysis/own-gemini-key.ts` and the settings actions rely on: the same
 * secret decrypts what it encrypted, and a wrong secret or tampered material fails
 * loudly (GCM's own authentication check) rather than returning garbage.
 */

import { describe, expect, it } from "vitest";
import { decryptGeminiKey, encryptGeminiKey } from "../../lib/security/gemini-key-crypto";

const SECRET_A = Buffer.alloc(32, 7).toString("base64");
const SECRET_B = Buffer.alloc(32, 9).toString("base64");

describe("gemini key crypto", () => {
  it("round-trips a plaintext key through the same secret", () => {
    const material = encryptGeminiKey("AIzaSyExampleGeminiKey1234567890", SECRET_A);

    expect(decryptGeminiKey(material, SECRET_A)).toBe("AIzaSyExampleGeminiKey1234567890");
  });

  it("produces a fresh random iv on every call, even for the same plaintext", () => {
    const first = encryptGeminiKey("same-plaintext", SECRET_A);
    const second = encryptGeminiKey("same-plaintext", SECRET_A);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("fails to decrypt with the wrong secret", () => {
    const material = encryptGeminiKey("AIzaSyExampleGeminiKey1234567890", SECRET_A);

    expect(() => decryptGeminiKey(material, SECRET_B)).toThrow();
  });

  it("fails to decrypt when the ciphertext has been tampered with", () => {
    const material = encryptGeminiKey("AIzaSyExampleGeminiKey1234567890", SECRET_A);
    const tamperedByte = Buffer.from(material.ciphertext, "base64");
    tamperedByte[0] = tamperedByte[0] ^ 0xff;

    expect(() =>
      decryptGeminiKey({ ...material, ciphertext: tamperedByte.toString("base64") }, SECRET_A),
    ).toThrow();
  });

  it("fails to decrypt when the auth tag has been tampered with", () => {
    const material = encryptGeminiKey("AIzaSyExampleGeminiKey1234567890", SECRET_A);
    const tamperedTag = Buffer.from(material.authTag, "base64");
    tamperedTag[0] = tamperedTag[0] ^ 0xff;

    expect(() =>
      decryptGeminiKey({ ...material, authTag: tamperedTag.toString("base64") }, SECRET_A),
    ).toThrow();
  });

  it("rejects a secret that does not decode to exactly 32 bytes", () => {
    const shortSecret = Buffer.alloc(16, 1).toString("base64");

    expect(() => encryptGeminiKey("key", shortSecret)).toThrow(/32 bytes/);
  });
});
