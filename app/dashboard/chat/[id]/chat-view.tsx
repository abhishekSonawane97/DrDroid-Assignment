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
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
                }
                if (part.type === "tool-webSearch") {
                  return <SearchToolPart key={i} part={part} />;
                }
                if (part.type === "tool-generateReport") {
                  return <ReportToolPart key={i} part={part} />;
                }
                return null;
              })}
              {(message.metadata as { pdfPath?: string } | undefined)
                ?.pdfPath && (
                <ReportDownloadLink
                  path={(message.metadata as { pdfPath: string }).pdfPath}
                />
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

interface SearchToolOutput {
  query?: string;
  results?: { title: string; link: string; snippet: string }[];
}

// useChat isn't parameterized with our server tool set, so the tool part's
// input/output arrive as `unknown` — matches lib/ai/tools.ts's webSearch
// tool shape (query in, { query, results } out).
function SearchToolPart({
  part,
}: {
  part: { state: string; input?: unknown; output?: unknown };
}) {
  if (part.state !== "output-available") {
    const input = part.input as { query?: string } | undefined;
    return (
      <p className="text-muted-foreground not-prose text-sm italic">
        🔍 Searching{input?.query ? ` for "${input.query}"` : "…"}
      </p>
    );
  }

  const output = part.output as SearchToolOutput | undefined;
  const results = output?.results ?? [];
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="not-prose bg-muted/50 my-2 rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-xs font-medium">Sources</p>
      <ul className="space-y-1">
        {results.map((r) => (
          <li key={r.link} className="text-xs">
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {r.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ReportToolOutput {
  title?: string;
  downloadUrl?: string;
}

function ReportToolPart({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  if (part.state !== "output-available") {
    return (
      <p className="text-muted-foreground not-prose text-sm italic">
        📄 Generating report…
      </p>
    );
  }

  const output = part.output as ReportToolOutput | undefined;
  if (!output?.downloadUrl) return null;

  return (
    <p className="not-prose my-2">
      <a
        href={output.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-sm font-medium hover:underline"
      >
        📄 Download {output.title ?? "report"} (PDF)
      </a>
    </p>
  );
}

// For a report generated in an earlier session — the signed URL from that
// time has expired, so a fresh one is minted on click.
function ReportDownloadLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch("/api/report/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (data.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <p className="not-prose my-2">
      <button
        onClick={download}
        disabled={loading}
        className="text-primary text-sm font-medium hover:underline disabled:opacity-50"
      >
        📄 {loading ? "Opening…" : "Download report (PDF)"}
      </button>
    </p>
  );
}
