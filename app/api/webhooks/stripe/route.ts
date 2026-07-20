import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { isUniqueViolation } from "@/lib/db-errors";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      return new Response("Missing userId in session metadata", {
        status: 400,
      });
    }

    try {
      // stripe_event_id is unique (Phase 1 schema) — this is the
      // idempotency guard. A replayed webhook throws here and is treated
      // as already-processed rather than granting credits twice.
      await db.transaction(async (tx) => {
        await tx.insert(payments).values({
          userId,
          stripeSession: session.id,
          stripeEventId: event.id,
          amount: session.amount_total ?? 0,
          status: "completed",
        });
        await tx
          .update(users)
          .set({ isUnlocked: true, credits: 5, unlockedVia: "stripe" })
          .where(eq(users.id, userId));
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return new Response("OK (already processed)", { status: 200 });
      }
      throw err;
    }
  }

  return new Response("OK", { status: 200 });
}
