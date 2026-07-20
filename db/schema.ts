import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// RLS is enabled here via .enableRLS(), but the actual policies live in
// supabase/seed.sql as raw SQL — drizzle-kit push (0.31.x) silently drops
// the using/withCheck expressions on pgPolicy(), producing empty,
// non-functional policies. Verified via db/schema.ts history; don't
// reintroduce pgPolicy() here without re-testing that push serializes it.

// Profile row for a Supabase Auth user. `id` matches auth.users.id exactly
// (populated on first login — see Phase 2), not a Drizzle-generated default.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    provider: text("provider").notNull(),
    credits: integer("credits").notNull().default(0),
    isUnlocked: boolean("is_unlocked").notNull().default(false),
    unlockedVia: text("unlocked_via"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

// Ownership is one hop away via chat_threads.user_id — see policies in
// supabase/seed.sql.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

// One BYOK config per user (see Phase 4).
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    encryptedKey: text("encrypted_key").notNull(),
    endpoint: text("endpoint").notNull(),
    selectedModel: text("selected_model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

// Single source of truth for token/cost analytics (see lib/cost.ts).
// thread_id / message_id use ON DELETE SET NULL so usage history survives
// even if the underlying conversation is later deleted.
export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => chatThreads.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    // Nullable/best-effort: not every OpenAI-compatible provider reports
    // prompt-cache token counts, and some only report cache reads.
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    // Null when the model isn't in MODEL_PRICING (lib/model-pricing.ts).
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSession: text("stripe_session").notNull(),
    // Idempotency guard for webhook retries — see Phase 3.4.
    stripeEventId: text("stripe_event_id").notNull().unique(),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
).enableRLS();

// Unique(user_id, coupon_code) enforces "once per user" at the DB level.
export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    couponCode: text("coupon_code").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.userId, table.couponCode)],
).enableRLS();

export const usersRelations = relations(users, ({ many, one }) => ({
  chatThreads: many(chatThreads),
  apiKey: one(apiKeys),
  usageLogs: many(usageLogs),
  payments: many(payments),
  couponRedemptions: many(couponRedemptions),
}));

export const chatThreadsRelations = relations(chatThreads, ({ one, many }) => ({
  user: one(users, {
    fields: [chatThreads.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(chatThreads, {
    fields: [messages.threadId],
    references: [chatThreads.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const usageLogsRelations = relations(usageLogs, ({ one }) => ({
  user: one(users, { fields: [usageLogs.userId], references: [users.id] }),
  thread: one(chatThreads, {
    fields: [usageLogs.threadId],
    references: [chatThreads.id],
  }),
  message: one(messages, {
    fields: [usageLogs.messageId],
    references: [messages.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

export const couponRedemptionsRelations = relations(
  couponRedemptions,
  ({ one }) => ({
    user: one(users, {
      fields: [couponRedemptions.userId],
      references: [users.id],
    }),
  }),
);
