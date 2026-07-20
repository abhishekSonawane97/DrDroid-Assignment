import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  apiKeys,
  chatThreads,
  messages as messagesTable,
  usageLogs,
} from "@/db/schema";
import { getUserModel } from "@/lib/ai/provider";
import { getAgentTools } from "@/lib/ai/tools";
import { calculateCost } from "@/lib/cost";
import { refundCredit, reserveCredit } from "@/lib/credits";
import { decrypt } from "@/lib/crypto";
import { classifyProviderError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

// Think -> Search -> Reason -> (Search again, optional) -> Reason -> Answer.
// One HTTP request = one credit regardless of how many tool-use steps the
// model takes within it — reserve/refund below wraps the whole streamText
// call, not each step.
const MAX_AGENT_STEPS = 5;

function extractText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const { messages, threadId }: { messages: UIMessage[]; threadId: string } =
    await request.json();

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId));

  if (!thread || thread.userId !== user.id) {
    return new Response("Thread not found", { status: 404 });
  }

  const [config] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id));

  if (!config) {
    return new Response("No API settings configured", { status: 400 });
  }

  const reserved = await reserveCredit(user.id);
  if (!reserved) {
    return new Response("Insufficient credits", { status: 402 });
  }

  try {
    const lastMessage = messages[messages.length - 1];
    const userText = extractText(lastMessage);

    await db.insert(messagesTable).values({
      threadId,
      role: "user",
      content: userText,
    });

    if (thread.title === "New Chat" && userText) {
      await db
        .update(chatThreads)
        .set({ title: userText.slice(0, 60) })
        .where(eq(chatThreads.id, threadId));
    }

    const model = getUserModel({
      endpoint: config.endpoint,
      apiKey: decrypt(config.encryptedKey),
      model: config.selectedModel,
    });

    const result = streamText({
      model,
      system:
        "You are a helpful AI research assistant. Use the webSearch tool " +
        "when a question needs current information or facts you're not " +
        "confident about. Cite sources by URL when you use search results. " +
        "Use the generateReport tool only when the user explicitly asks " +
        "for a report, summary document, or PDF.",
      messages: await convertToModelMessages(messages),
      tools: getAgentTools({
        supabase,
        userId: user.id,
        threadId,
        threadTitle: thread.title,
      }),
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      onFinish: async ({ text, usage }) => {
        const [assistantMessage] = await db
          .insert(messagesTable)
          .values({ threadId, role: "assistant", content: text })
          .returning({ id: messagesTable.id });

        const promptTokens = usage.inputTokens ?? 0;
        const completionTokens = usage.outputTokens ?? 0;
        const cacheReadTokens =
          usage.inputTokenDetails?.cacheReadTokens ?? null;
        const cacheWriteTokens =
          usage.inputTokenDetails?.cacheWriteTokens ?? null;

        const estimatedCost = calculateCost({
          model: config.selectedModel,
          promptTokens,
          completionTokens,
          cacheReadTokens,
          cacheWriteTokens,
        });

        await db.insert(usageLogs).values({
          userId: user.id,
          threadId,
          messageId: assistantMessage.id,
          model: config.selectedModel,
          promptTokens,
          completionTokens,
          cacheReadTokens,
          cacheWriteTokens,
          estimatedCost:
            estimatedCost !== null ? estimatedCost.toString() : null,
        });
      },
      onError: async () => {
        // Streaming failed after the credit was reserved — refund it.
        await refundCredit(user.id);
      },
    });

    // toUIMessageStreamResponse() is deprecated in this AI SDK version in
    // favor of the standalone helpers below. onError here controls the
    // friendly message that actually reaches the client — the onError
    // above only handles the credit refund, a separate concern.
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.fullStream,
        onError: classifyProviderError,
      }),
    });
  } catch (err) {
    // Failed before streaming even started (e.g. persisting the user
    // message) — refund the credit reserved above.
    await refundCredit(user.id);
    throw err;
  }
}
