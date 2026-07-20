import Stripe from "stripe";

// Lazy singleton: instantiating Stripe at module top-level would run at
// Next.js build time (page-data collection evaluates the module), and the
// SDK throws synchronously if STRIPE_SECRET_KEY isn't set yet — breaking
// the build even when the route is never actually invoked.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
