import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { chatThreads } from "@/db/schema";
import { createReport } from "@/lib/report";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const threadId = typeof body?.threadId === "string" ? body.threadId : "";
  const title = typeof body?.title === "string" ? body.title : "";
  const sections = Array.isArray(body?.sections) ? body.sections : null;
  const references = Array.isArray(body?.references) ? body.references : [];

  if (!threadId || !title || !sections) {
    return NextResponse.json(
      { error: "threadId, title, and sections are required" },
      { status: 400 },
    );
  }

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId));

  if (!thread || thread.userId !== user.id) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    const result = await createReport({
      supabase,
      userId: user.id,
      threadId,
      threadTitle: thread.title,
      title,
      sections,
      references,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
