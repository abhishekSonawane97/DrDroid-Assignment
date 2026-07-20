import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Placeholder — the real sidebar/shell (Chats, Usage, API Keys, Settings)
// is built in later phases. This exists to make Phase 2's auth gating
// verifiable end-to-end.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Signed in as {user.email}</p>
    </div>
  );
}
