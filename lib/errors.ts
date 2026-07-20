import { APICallError } from "ai";

// Maps provider/network failures to the friendly copy required by spec §13
// (expired key, timeout, provider unavailable, invalid model). Never lets
// a raw stack trace or provider error body reach the client.
export function classifyProviderError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "Your API key appears to be invalid or expired. Check your API settings.";
    }
    if (error.statusCode === 404) {
      return "The selected model wasn't found at your configured endpoint.";
    }
    if (error.statusCode !== undefined && error.statusCode >= 500) {
      return "The AI provider is temporarily unavailable. Please try again shortly.";
    }
  }

  if (error instanceof Error) {
    if (/timeout|timed out|ETIMEDOUT/i.test(error.message)) {
      return "The request timed out. Please try again.";
    }
    if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(error.message)) {
      return "Could not reach the configured endpoint. Check your API settings.";
    }
  }

  return "Something went wrong while generating a response. Please try again.";
}
