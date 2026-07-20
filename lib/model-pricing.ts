// USD per 1M tokens. Illustrative, approximate provider pricing — this
// project never bills LLM usage (BYOK), so these only back the dashboard's
// "estimated cost" display. Update as provider pricing changes; an unknown
// model is a normal case (custom/self-hosted endpoints), not an error —
// see lib/cost.ts, which returns null rather than guessing.
export interface ModelPricing {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.5, output: 10.0, cacheRead: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075 },
  "gpt-4.1": { input: 2.0, output: 8.0, cacheRead: 0.5 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cacheRead: 0.1 },
  "o4-mini": { input: 1.1, output: 4.4, cacheRead: 0.55 },
  "claude-opus-4": {
    input: 15.0,
    output: 75.0,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  "claude-sonnet-4": {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-haiku-4": {
    input: 0.8,
    output: 4.0,
    cacheRead: 0.08,
    cacheWrite: 1.0,
  },
  "kimi-k2": { input: 0.6, output: 2.5 },
  "moonshot-v1-8k": { input: 0.2, output: 0.2 },
  "deepseek-chat": { input: 0.28, output: 0.42 },
  "llama-3.3-70b": { input: 0.6, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};
