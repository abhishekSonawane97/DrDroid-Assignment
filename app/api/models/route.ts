import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [row] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id));

  if (!row) {
    return NextResponse.json(
      { error: "No API settings configured yet" },
      { status: 400 },
    );
  }

  // Not every OpenAI-compatible endpoint implements GET /v1/models — this
  // never throws a 500, always a usable JSON shape, so the settings UI can
  // fall back to manual model entry.
  try {
    const url = new URL("/v1/models", row.endpoint).toString();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${decrypt(row.encryptedKey)}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({
        models: [],
        error: `Endpoint returned ${res.status}`,
      });
    }

    const data = await res.json();
    const models: string[] = Array.isArray(data?.data)
      ? data.data
          .map((m: { id?: unknown }) => m.id)
          .filter((id: unknown): id is string => typeof id === "string")
      : [];

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({
      models: [],
      error: "Could not reach the configured endpoint",
    });
  }
}
