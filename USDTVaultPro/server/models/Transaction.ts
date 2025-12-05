import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  userId: string;
  type: 'send' | 'receive';
  amount: string;
  address: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    enum: ['send', 'receive'],
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });

export const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);