"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function signIn(provider: "google") {
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
      <div className="flex flex-col gap-1">
        <Button variant="outline" disabled>
          Continue with GitHub
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          GitHub sign-in is coming soon.
        </p>
      </div>
    </div>
  );
}
