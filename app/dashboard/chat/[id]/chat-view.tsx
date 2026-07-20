"use client";

import { useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatView({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId },
    }),
  });

  const busy = status === "streaming" || status === "submitted";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-8">
        {messages.map((message) => (
          <div key={message.id}>
            <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
              {message.role}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
                ) : null,
              )}
            </div>
          </div>
        ))}
        {error && (
          <p className="text-destructive text-sm">
            {error.message === "Insufficient credits"
              ? "You're out of credits."
              : (error.message ?? "Something went wrong.")}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
