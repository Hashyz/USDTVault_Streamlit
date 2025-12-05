import mongoose, { Document, Schema } from 'mongoose';

export interface IInvestmentPlan extends Document {
  userId: string;
  name: string;
  amount: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextContribution: Date;
  autoInvest: boolean;
  createdAt: Date;
}

const InvestmentPlanSchema = new Schema<IInvestmentPlan>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: String,
    required: true,
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
  },
  nextContribution: {
    type: Date,
    required: true,
  },
  autoInvest: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
InvestmentPlanSchema.index({ userId: 1, nextContribution: 1 });

export const InvestmentPlanModel = mongoose.model<IInvestmentPlan>('InvestmentPlan', InvestmentPlanSchema);