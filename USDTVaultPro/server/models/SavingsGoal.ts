import mongoose, { Document, Schema } from 'mongoose';

export interface ISavingsGoal extends Document {
  userId: string;
  title: string;
  current: string;
  target: string;
  deadline: Date;
  autoSaveEnabled: boolean;
  autoSaveAmount?: string;
  autoSaveFrequency?: 'daily' | 'weekly' | 'monthly';
  nextAutoSave?: Date;
  lastWithdrawal?: Date;
  savingStreak: string;
  withdrawalCooldownUntil?: Date;
  createdAt: Date;
}

const SavingsGoalSchema = new Schema<ISavingsGoal>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  current: {
    type: String,
    default: '0',
  },
  target: {
    type: String,
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  autoSaveEnabled: {
    type: Boolean,
    default: false,
  },
  autoSaveAmount: {
    type: String,
    required: false,
  },
  autoSaveFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
  },
  nextAutoSave: {
    type: Date,
    required: false,
  },
  lastWithdrawal: {
    type: Date,
    required: false,
  },
  savingStreak: {
    type: String,
    default: '0',
  },
  withdrawalCooldownUntil: {
    type: Date,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
SavingsGoalSchema.index({ userId: 1, deadline: 1 });

export const SavingsGoalModel = mongoose.model<ISavingsGoal>('SavingsGoal', SavingsGoalSchema);