import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [config] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id));

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2">
      {config ? (
        <p className="text-muted-foreground">
          Select a chat, or start a new one from the sidebar.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Configure your API key before starting a chat.
          </p>
          <Link
            href="/dashboard/settings"
            className="text-primary text-sm font-medium hover:underline"
          >
            Go to Settings
          </Link>
        </>
      )}
    </div>
  );
}
