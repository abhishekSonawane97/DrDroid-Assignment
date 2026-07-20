import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { decrypt, encrypt, maskApiKey } from "@/lib/crypto";
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
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    endpoint: row.endpoint,
    selectedModel: row.selectedModel,
    maskedKey: maskApiKey(decrypt(row.encryptedKey)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  // Empty apiKey means "keep the existing key" on update — the UI never
  // has the real value to pre-fill, so requiring re-entry on every save
  // would just train users to paste it more often than necessary.
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const selectedModel =
    typeof body?.selectedModel === "string" ? body.selectedModel.trim() : "";

  if (!endpoint || !selectedModel) {
    return NextResponse.json(
      { error: "endpoint and selectedModel are required" },
      { status: 400 },
    );
  }

  try {
    new URL(endpoint);
  } catch {
    return NextResponse.json(
      { error: "endpoint must be a valid URL" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id));

  if (!apiKey && !existing) {
    return NextResponse.json(
      { error: "apiKey is required for initial setup" },
      { status: 400 },
    );
  }

  const encryptedKey = apiKey ? encrypt(apiKey) : existing!.encryptedKey;

  await db
    .insert(apiKeys)
    .values({ userId: user.id, endpoint, encryptedKey, selectedModel })
    .onConflictDoUpdate({
      target: apiKeys.userId,
      set: { endpoint, encryptedKey, selectedModel },
    });

  return NextResponse.json({
    configured: true,
    endpoint,
    selectedModel,
    maskedKey: maskApiKey(apiKey || decrypt(encryptedKey)),
  });
}
