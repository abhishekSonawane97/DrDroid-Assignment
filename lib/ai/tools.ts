import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import { createReport } from "@/lib/report";
import { webSearch } from "@/lib/search";

// webSearch needs no per-request context, so it's a plain export.
export const webSearchTool = tool({
  description:
    "Search the web for current information. Use this when the answer requires up-to-date facts, or information you're not confident about.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }: { query: string }) => {
    const results = await webSearch(query);
    return { query, results };
  },
});

// generateReport needs the caller's identity/thread/session, so it's built
// per-request rather than statically exported.
export function getAgentTools(context: {
  supabase: SupabaseClient;
  userId: string;
  threadId: string;
  threadTitle: string;
}) {
  return {
    webSearch: webSearchTool,
    generateReport: tool({
      description:
        "Generate a downloadable PDF report summarizing research findings. Only call this when the user explicitly asks for a report, summary document, or PDF.",
      inputSchema: z.object({
        title: z.string().describe("The report title"),
        sections: z
          .array(
            z.object({
              heading: z.string(),
              content: z.string(),
            }),
          )
          .describe("The report body, broken into headed sections"),
        references: z
          .array(z.string())
          .describe("Source URLs used to compile the report"),
      }),
      execute: async ({ title, sections, references }) => {
        const result = await createReport({
          supabase: context.supabase,
          userId: context.userId,
          threadId: context.threadId,
          threadTitle: context.threadTitle,
          title,
          sections,
          references,
        });
        return {
          title: result.title,
          downloadUrl: result.signedUrl,
        };
      },
    }),
  };
}
