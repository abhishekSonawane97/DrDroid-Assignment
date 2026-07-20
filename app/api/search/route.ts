import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { webSearch } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Unlike /api/chat, this endpoint isn't implicitly capped by the credit
  // ceiling — it's the actual unprotected path to the platform's Serper key.
  if (!checkRateLimit(`search:${user.id}`)) {
    return NextResponse.json(
      { error: "Too many search requests. Please slow down." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const results = await webSearch(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
