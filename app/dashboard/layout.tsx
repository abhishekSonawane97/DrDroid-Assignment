import Link from "next/link";

// Minimal nav shell — only links to pages that actually exist yet. Each
// later phase (Usage, Chats proper) adds its own link when its page lands,
// rather than pointing at routes that 404.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <nav className="flex w-48 shrink-0 flex-col gap-1 border-r p-4">
        <Link
          href="/dashboard"
          className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
        >
          Chats
        </Link>
        <Link
          href="/dashboard/settings"
          className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
        >
          Settings
        </Link>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
