import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
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
      <SettingsForm />
    </div>
  );
}
