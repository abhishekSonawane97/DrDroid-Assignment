import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

// Atomic reserve: only decrements (and returns true) if the row still has
// credits > 0. A concurrent second request against 1 remaining credit
// cannot both succeed — one loses the WHERE match and gets false.
export async function reserveCredit(userId: string): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ credits: sql`${users.credits} - 1` })
    .where(and(eq(users.id, userId), gt(users.credits, 0)))
    .returning({ id: users.id });
  return result.length > 0;
}

export async function refundCredit(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ credits: sql`${users.credits} + 1` })
    .where(eq(users.id, userId));
}
