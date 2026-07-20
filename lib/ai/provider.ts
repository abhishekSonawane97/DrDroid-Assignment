import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// Every BYOK provider is treated as OpenAI-compatible, per the frozen
// product decision — the user supplies an arbitrary endpoint + key.
export function getUserModel(config: {
  endpoint: string;
  apiKey: string;
  model: string;
}): LanguageModel {
  const provider = createOpenAICompatible({
    name: "byok",
    baseURL: config.endpoint,
    apiKey: config.apiKey,
  });
  return provider(config.model);
}
