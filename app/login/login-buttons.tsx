"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function signIn(provider: "google" | "github") {
  const supabase = createClient();
  supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export function LoginButtons() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <Button onClick={() => signIn("google")}>Continue with Google</Button>
      <Button variant="outline" onClick={() => signIn("github")}>
        Continue with GitHub
      </Button>
    </div>
  );
}
