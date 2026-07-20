import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-lg p-8">
      <h1 className="text-xl font-semibold">API Settings</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Bring your own OpenAI-compatible endpoint and API key. Your key is
        encrypted at rest and never sent back to the browser in full.
      </p>
      {setup === "required" && (
        <p className="border-primary/30 bg-primary/5 mb-6 rounded-lg border px-3 py-2 text-sm">
          Set this up first — you&apos;ll need it before you can start chatting.
        </p>
      )}
      <SettingsForm />
    </div>
  );
}
