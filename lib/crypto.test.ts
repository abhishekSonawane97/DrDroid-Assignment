import { describe, expect, it } from "vitest";
import { decrypt, encrypt, maskApiKey } from "./crypto";

describe("encrypt/decrypt", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "sk-abcdefghijklmnopqrstuvwxyz1234567890";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time", () => {
    // Random IV per call — encrypting the same value twice must not be
    // deterministic, or it'd leak equality between two users' keys.
    const plaintext = "sk-same-key-both-times";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("fails to decrypt tampered ciphertext rather than returning garbage", () => {
    const encoded = encrypt("sk-original-value");
    const bytes = Buffer.from(encoded, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the ciphertext
    expect(() => decrypt(bytes.toString("base64"))).toThrow();
  });
});

describe("maskApiKey", () => {
  it("shows only the first 3 and last 4 characters", () => {
    expect(maskApiKey("sk-abcdefghijklmnop")).toBe("sk-…mnop");
  });

  it("fully masks very short keys", () => {
    expect(maskApiKey("short")).toBe("••••");
  });
});
