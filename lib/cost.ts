import { MODEL_PRICING } from "./model-pricing";

export interface UsageForCost {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens?: number | null;
  cacheWriteTokens?: number | null;
}

const PER_MILLION = 1_000_000;

// Input Cost + Output Cost + Cache Cost. Returns null when the model isn't
// in MODEL_PRICING (e.g. a custom BYOK endpoint) rather than guessing.
export function calculateCost(usage: UsageForCost): number | null {
  const pricing = MODEL_PRICING[usage.model];
  if (!pricing) return null;

  const inputCost = (usage.promptTokens / PER_MILLION) * pricing.input;
  const outputCost = (usage.completionTokens / PER_MILLION) * pricing.output;

  const cacheReadCost =
    usage.cacheReadTokens && pricing.cacheRead
      ? (usage.cacheReadTokens / PER_MILLION) * pricing.cacheRead
      : 0;

  const cacheWriteCost =
    usage.cacheWriteTokens && pricing.cacheWrite
      ? (usage.cacheWriteTokens / PER_MILLION) * pricing.cacheWrite
      : 0;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}
