import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { usageLogs, users } from "@/db/schema";

export interface UsageTotals {
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: string;
}

export interface UsageByModel {
  model: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cost: string;
}

export interface UsageSummary {
  creditsRemaining: number;
  totals: UsageTotals;
  byModel: UsageByModel[];
}

// Shared by GET /api/usage and the dashboard page, so both read the exact
// same aggregation rather than duplicating the SQL.
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const [userRow] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));

  const [totals] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::int`,
      cacheReadTokens: sql<number>`coalesce(sum(${usageLogs.cacheReadTokens}), 0)::int`,
      cacheWriteTokens: sql<number>`coalesce(sum(${usageLogs.cacheWriteTokens}), 0)::int`,
      totalCost: sql<string>`coalesce(sum(${usageLogs.estimatedCost}), 0)::text`,
    })
    .from(usageLogs)
    .where(eq(usageLogs.userId, userId));

  const byModel = await db
    .select({
      model: usageLogs.model,
      requests: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::int`,
      completionTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::int`,
      cost: sql<string>`coalesce(sum(${usageLogs.estimatedCost}), 0)::text`,
    })
    .from(usageLogs)
    .where(eq(usageLogs.userId, userId))
    .groupBy(usageLogs.model);

  return {
    creditsRemaining: userRow?.credits ?? 0,
    totals: totals ?? {
      totalRequests: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCost: "0",
    },
    byModel,
  };
}
