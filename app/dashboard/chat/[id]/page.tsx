import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";

import { db } from "@/db";
import { chatThreads, messages as messagesTable } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.id, id));

  if (!thread || thread.userId !== user.id) {
    notFound();
  }

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.threadId, id))
    .orderBy(asc(messagesTable.createdAt));

  const initialMessages: UIMessage[] = history.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
  }));

  return <ChatView threadId={id} initialMessages={initialMessages} />;
}
