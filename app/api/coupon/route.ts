import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { couponRedemptions, users } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

const VALID_COUPON = "SID_DRDROID";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (code !== VALID_COUPON) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
  }

  try {
    // The unique(user_id, coupon_code) constraint from Phase 1 is the
    // actual once-per-user guard — this insert either succeeds exactly
    // once or throws, with no separate check-then-insert race window.
    await db.transaction(async (tx) => {
      await tx.insert(couponRedemptions).values({
        userId: user.id,
        couponCode: VALID_COUPON,
      });
      await tx
        .update(users)
        .set({ isUnlocked: true, credits: 5, unlockedVia: "coupon" })
        .where(eq(users.id, user.id));
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Coupon already redeemed" },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ isUnlocked: true, credits: 5 });
}
