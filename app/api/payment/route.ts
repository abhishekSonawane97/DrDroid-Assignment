import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Unlock state is set only by the webhook (app/api/webhooks/stripe),
  // never by this success redirect — the redirect can be reached without
  // a completed payment.
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "MicroManus Unlock" },
          unit_amount: 500,
        },
        quantity: 1,
      },
    ],
    metadata: { userId: user.id },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/paywall?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/paywall?canceled=true`,
  });

  return NextResponse.json({ url: session.url });
}
