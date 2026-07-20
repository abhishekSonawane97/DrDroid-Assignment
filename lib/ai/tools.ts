import { tool } from "ai";
import { z } from "zod";

import { webSearch } from "@/lib/search";

export const agentTools = {
  webSearch: tool({
    description:
      "Search the web for current information. Use this when the answer requires up-to-date facts, or information you're not confident about.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }: { query: string }) => {
      const results = await webSearch(query);
      return { query, results };
    },
  }),
};
