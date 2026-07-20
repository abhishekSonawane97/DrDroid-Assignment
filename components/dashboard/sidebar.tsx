"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Thread {
  id: string;
  title: string;
}

export function Sidebar() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/threads");
    const data = await res.json();
    setThreads(data.threads ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/threads")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setThreads(data.threads ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function createThread() {
    const res = await fetch("/api/threads", { method: "POST" });
    const data = await res.json();
    await loadThreads();
    router.push(`/dashboard/chat/${data.thread.id}`);
  }

  async function deleteThread(id: string) {
    if (!confirm("Delete this chat?")) return;
    await fetch(`/api/threads/${id}`, { method: "DELETE" });
    await loadThreads();
    router.push("/dashboard");
    router.refresh();
  }

  async function saveRename(id: string) {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title) return;
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await loadThreads();
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r p-4">
      <button
        onClick={createThread}
        className="hover:bg-muted mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
      >
        <Plus className="size-4" />
        New Chat
      </button>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="group hover:bg-muted flex items-center rounded-lg px-3 py-2"
          >
            {editingId === thread.id ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => saveRename(thread.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename(thread.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            ) : (
              <Link
                href={`/dashboard/chat/${thread.id}`}
                className="min-w-0 flex-1 truncate text-sm"
              >
                {thread.title}
              </Link>
            )}
            <div className="ml-1 hidden shrink-0 gap-1 group-hover:flex">
              <button
                onClick={() => {
                  setEditingId(thread.id);
                  setEditingTitle(thread.title);
                }}
                aria-label="Rename"
              >
                <Pencil className="text-muted-foreground size-3.5" />
              </button>
              <button
                onClick={() => deleteThread(thread.id)}
                aria-label="Delete"
              >
                <Trash2 className="text-muted-foreground size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/settings"
        className="hover:bg-muted mt-2 rounded-lg px-3 py-2 text-sm font-medium"
      >
        Settings
      </Link>
    </nav>
  );
}
