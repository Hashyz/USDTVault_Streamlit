import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  walletAddress: string;
  balance: string;
  encryptedCredentials: string | null;
  encryptedPrivateKey: string | null;
  pin: string | null;
  pinAttempts: number;
  pinLockoutUntil: Date | null;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
  backupCodes: string | null;
  aiConversations: Array<{
    timestamp: Date;
    goalId: string;
    reason: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    outcome: 'withdrew' | 'kept' | 'ongoing';
    savingsAmount: number;
    progress: number;
  }>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  walletAddress: {
    type: String,
    required: true,
  },
  balance: {
    type: String,
    default: '0',
  },
  encryptedCredentials: {
    type: String,
    default: null,
  },
  encryptedPrivateKey: {
    type: String,
    default: null,
  },
  pin: {
    type: String,
    default: null,
  },
  pinAttempts: {
    type: Number,
    default: 0,
  },
  pinLockoutUntil: {
    type: Date,
    default: null,
  },
  twoFactorSecret: {
    type: String,
    default: null,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  backupCodes: {
    type: String,
    default: null,
  },
  aiConversations: {
    type: [{
      timestamp: {
        type: Date,
        required: true,
      },
      goalId: {
        type: String,
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      messages: [{
        role: {
          type: String,
          enum: ['user', 'assistant'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
      }],
      outcome: {
        type: String,
        enum: ['withdrew', 'kept', 'ongoing'],
        required: true,
      },
      savingsAmount: {
        type: Number,
        required: true,
      },
      progress: {
        type: Number,
        required: true,
      },
    }],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for faster queries
UserSchema.index({ username: 1 });

export const UserModel = mongoose.model<IUser>('User', UserSchema);