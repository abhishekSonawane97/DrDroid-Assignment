import { NextResponse } from "next/server";

import { getUsageSummary } from "@/lib/usage";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const summary = await getUsageSummary(user.id);
  return NextResponse.json(summary);
}
