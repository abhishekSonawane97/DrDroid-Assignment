import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3)).toBe(true);
    }
    expect(checkRateLimit(key, 3)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-${crypto.randomUUID()}`;
    const keyB = `test-${crypto.randomUUID()}`;
    expect(checkRateLimit(keyA, 1)).toBe(true);
    expect(checkRateLimit(keyA, 1)).toBe(false);
    expect(checkRateLimit(keyB, 1)).toBe(true);
  });
});
