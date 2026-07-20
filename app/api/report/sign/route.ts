import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Mints a fresh signed URL for a previously-generated report. Storage
// paths are `{user_id}/{report_id}.pdf`, so a prefix check is a cheap way
// to return a clean 404 instead of relying solely on the storage RLS
// policy rejecting the call.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path : "";

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(path, 3600);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
