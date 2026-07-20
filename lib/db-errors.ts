function hasCode(value: unknown, code: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    (value as { code?: unknown }).code === code
  );
}

// Postgres unique_violation (SQLSTATE 23505). Used to detect "already
// happened" races (duplicate coupon redemption, replayed Stripe webhook
// event) without a separate check-then-insert step. Drizzle wraps the raw
// postgres.js error in a "Failed query" error with the original under
// `.cause` — verified empirically via a webhook-replay test — so both
// levels need checking.
export function isUniqueViolation(err: unknown): boolean {
  if (hasCode(err, "23505")) return true;
  const cause = err instanceof Error ? err.cause : undefined;
  return hasCode(cause, "23505");
}
