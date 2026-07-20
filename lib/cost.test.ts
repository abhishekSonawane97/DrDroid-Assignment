import { describe, expect, it } from "vitest";
import { calculateCost } from "./cost";

describe("calculateCost", () => {
  it("returns null for an unknown model", () => {
    expect(
      calculateCost({
        model: "some-custom-self-hosted-model",
        promptTokens: 1000,
        completionTokens: 500,
      }),
    ).toBeNull();
  });

  it("computes input + output cost for a known model with no cache tokens", () => {
    // gpt-4o-mini: input 0.15 / 1M, output 0.60 / 1M
    const cost = calculateCost({
      model: "gpt-4o-mini",
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.15 + 0.6, 6);
  });

  it("returns 0 for a known model with zero usage", () => {
    expect(
      calculateCost({
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
      }),
    ).toBe(0);
  });

  it("includes cache read + cache write cost when the model prices them", () => {
    // claude-sonnet-4: input 3.0, output 15.0, cacheRead 0.3, cacheWrite 3.75
    const cost = calculateCost({
      model: "claude-sonnet-4",
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.0 + 15.0 + 0.3 + 3.75, 6);
  });

  it("ignores cache tokens when the model doesn't price them", () => {
    // kimi-k2 has no cacheRead/cacheWrite in MODEL_PRICING.
    const cost = calculateCost({
      model: "kimi-k2",
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.6 + 2.5, 6);
  });

  it("treats null/undefined cache token fields as zero usage", () => {
    const cost = calculateCost({
      model: "gpt-4o",
      promptTokens: 1_000_000,
      completionTokens: 0,
      cacheReadTokens: null,
      cacheWriteTokens: undefined,
    });
    expect(cost).toBeCloseTo(2.5, 6);
  });
});
