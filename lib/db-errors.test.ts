import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
  it("detects a raw postgres.js error with code at the top level", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects a Drizzle-wrapped error with the code under .cause", () => {
    // Reproduces what Drizzle actually throws: a "Failed query" Error
    // wrapping the raw PostgresError in .cause. Caught this via a live
    // webhook-replay test returning 500 instead of a graceful 200.
    const wrapped = new Error("Failed query: insert into ...");
    (wrapped as Error & { cause: unknown }).cause = { code: "23505" };
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUniqueViolation(new Error("network timeout"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
