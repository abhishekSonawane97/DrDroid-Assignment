import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2">
      <p className="text-muted-foreground">
        Select a chat, or start a new one from the sidebar.
      </p>
    </div>
  );
}
