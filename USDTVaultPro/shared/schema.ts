import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  walletAddress: varchar("wallet_address").notNull().default(""),
  balance: numeric("balance", { precision: 20, scale: 8 }).notNull().default("0"),
  encryptedCredentials: text("encrypted_credentials"),
  encryptedPrivateKey: text("encrypted_private_key"),
  pin: text("pin"),
  pinAttempts: numeric("pin_attempts").notNull().default("0"),
  pinLockoutUntil: timestamp("pin_lockout_until"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  backupCodes: text("backup_codes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { enum: ["send", "receive"] }).notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency", { enum: ["USDT", "BNB"] }).notNull().default("USDT"),
  destinationAddress: varchar("destination_address"),
  sourceAddress: varchar("source_address"),
  transactionHash: varchar("transaction_hash"),
  blockNumber: numeric("block_number"),
  gasUsed: varchar("gas_used"),
  effectiveGasPrice: varchar("effective_gas_price"),
  status: varchar("status", { enum: ["pending", "completed", "failed", "success"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const savingsGoals = pgTable("savings_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  current: numeric("current", { precision: 20, scale: 8 }).notNull().default("0"),
  target: numeric("target", { precision: 20, scale: 8 }).notNull(),
  deadline: timestamp("deadline").notNull(),
  autoSaveEnabled: boolean("auto_save_enabled").notNull().default(false),
  autoSaveAmount: numeric("auto_save_amount", { precision: 20, scale: 8 }),
  autoSaveFrequency: varchar("auto_save_frequency", { enum: ["daily", "weekly", "monthly"] }),
  nextAutoSave: timestamp("next_auto_save"),
  lastWithdrawal: timestamp("last_withdrawal"),
  savingStreak: numeric("saving_streak").notNull().default("0"),
  withdrawalCooldownUntil: timestamp("withdrawal_cooldown_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({
  id: true,
  createdAt: true,
  current: true,
  savingStreak: true,
});

export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

export const investmentPlans = pgTable("investment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  frequency: varchar("frequency", { enum: ["weekly", "monthly"] }).notNull(),
  nextContribution: timestamp("next_contribution").notNull(),
  autoInvest: boolean("auto_invest").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvestmentPlanSchema = createInsertSchema(investmentPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertInvestmentPlan = z.infer<typeof insertInvestmentPlanSchema>;
export type InvestmentPlan = typeof investmentPlans.$inferSelect;

// Withdrawal History tracking
export const withdrawalHistory = pgTable("withdrawal_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  goalId: varchar("goal_id").notNull().references(() => savingsGoals.id),
  goalTitle: text("goal_title").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  reason: varchar("reason", { 
    enum: ["emergency", "achieved", "changed-mind", "gambling", "investment", "other"] 
  }).notNull(),
  reasonDetails: text("reason_details"),
  usedCoolingPeriod: boolean("used_cooling_period").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  cancelledAt: timestamp("cancelled_at"),
  resistanceStreak: numeric("resistance_streak").notNull().default("0"),
  progressAtWithdrawal: numeric("progress_at_withdrawal", { precision: 5, scale: 2 }),
  savingsStreakLost: numeric("savings_streak_lost"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWithdrawalHistorySchema = createInsertSchema(withdrawalHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertWithdrawalHistory = z.infer<typeof insertWithdrawalHistorySchema>;
export type WithdrawalHistory = typeof withdrawalHistory.$inferSelect;

// Deletion History tracking for goals
export const deletionHistory = pgTable("deletion_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  goalTitle: text("goal_title").notNull(),
  amountReturned: numeric("amount_returned", { precision: 20, scale: 8 }).notNull(),
  targetAmount: numeric("target_amount", { precision: 20, scale: 8 }).notNull(),
  progressAtDeletion: numeric("progress_at_deletion", { precision: 5, scale: 2 }),
  reason: varchar("reason", { 
    enum: ["achieved", "changed-mind", "emergency", "better-opportunity", "other"] 
  }).notNull(),
  reasonDetails: text("reason_details"),
  usedCoolingPeriod: boolean("used_cooling_period").notNull().default(false),
  cancelledDeletion: boolean("cancelled_deletion").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeletionHistorySchema = createInsertSchema(deletionHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertDeletionHistory = z.infer<typeof insertDeletionHistorySchema>;
export type DeletionHistory = typeof deletionHistory.$inferSelect;