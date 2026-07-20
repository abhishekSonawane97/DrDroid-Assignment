import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { PaywallForm } from "./paywall-form";

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [row] = await db
    .select({ isUnlocked: users.isUnlocked })
    .from(users)
    .where(eq(users.id, user.id));

  if (row?.isUnlocked) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">Unlock MicroManus</h1>
      {success && (
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          Payment received — finishing up, this page will update shortly.
        </p>
      )}
      <PaywallForm />
    </div>
  );
}
