import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { chatThreads } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const threads = await db
    .select({
      id: chatThreads.id,
      title: chatThreads.title,
      createdAt: chatThreads.createdAt,
    })
    .from(chatThreads)
    .where(eq(chatThreads.userId, user.id))
    .orderBy(desc(chatThreads.createdAt));

  return NextResponse.json({ threads });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [thread] = await db
    .insert(chatThreads)
    .values({ userId: user.id })
    .returning({
      id: chatThreads.id,
      title: chatThreads.title,
      createdAt: chatThreads.createdAt,
    });

  return NextResponse.json({ thread });
}
