import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { classifyProviderError } from "./errors";

function apiError(statusCode: number) {
  return new APICallError({
    message: "provider error",
    url: "https://example.com/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    isRetryable: false,
  });
}

describe("classifyProviderError", () => {
  it("classifies 401 as an invalid/expired key", () => {
    expect(classifyProviderError(apiError(401))).toMatch(/invalid or expired/i);
  });

  it("classifies 403 the same as 401", () => {
    expect(classifyProviderError(apiError(403))).toMatch(/invalid or expired/i);
  });

  it("classifies 404 as an invalid model", () => {
    expect(classifyProviderError(apiError(404))).toMatch(/model/i);
  });

  it("classifies 5xx as provider unavailable", () => {
    expect(classifyProviderError(apiError(503))).toMatch(/unavailable/i);
  });

  it("classifies a timeout message", () => {
    expect(classifyProviderError(new Error("Request timed out"))).toMatch(
      /timed out/i,
    );
  });

  it("classifies a connection failure", () => {
    expect(
      classifyProviderError(new Error("fetch failed: ECONNREFUSED")),
    ).toMatch(/could not reach/i);
  });

  it("falls back to a generic message for anything unrecognized", () => {
    expect(classifyProviderError(new Error("something bizarre"))).toMatch(
      /something went wrong/i,
    );
    expect(classifyProviderError("not even an Error")).toMatch(
      /something went wrong/i,
    );
  });
});
