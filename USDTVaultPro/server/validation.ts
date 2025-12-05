import { z } from 'zod';
import { ethers } from 'ethers';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_DOWN });

/**
 * Custom Zod validators
 */

// Ethereum address validator
const ethereumAddressSchema = z.string().refine(
  (address) => ethers.isAddress(address),
  { message: 'Invalid Ethereum address format' }
);

// USDT amount validator (8 decimal places maximum)
const usdtAmountSchema = z.string().refine(
  (amount) => {
    try {
      const decimal = new Decimal(amount);
      if (decimal.isNaN() || !decimal.isFinite()) return false;
      if (decimal.lt(0)) return false;
      if (decimal.decimalPlaces() > 8) return false;
      // Maximum amount check (prevent overflow)
      if (decimal.gt('1000000000')) return false; // 1 billion max
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid USDT amount. Must be positive number with max 8 decimal places' }
);

// PIN validator (4-6 digits)
const pinSchema = z.string()
  .min(4, 'PIN must be at least 4 digits')
  .max(6, 'PIN must be at most 6 digits')
  .regex(/^\d+$/, 'PIN must contain only digits');

// Username validator
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Password validator
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

// Transaction hash validator
const transactionHashSchema = z.string().regex(
  /^0x[a-fA-F0-9]{64}$/,
  'Invalid transaction hash format'
);

/**
 * Request validation schemas
 */

// Auth endpoints
export const registerSchema = z.object({
  body: z.object({
    username: usernameSchema,
    password: passwordSchema,
  }).strict()
});

export const loginSchema = z.object({
  body: z.object({
    username: usernameSchema,
    password: passwordSchema,
  }).strict()
});

export const validatePasswordSchema = z.object({
  body: z.object({
    password: passwordSchema,
  }).strict()
});

// PIN endpoints
export const setupPinSchema = z.object({
  body: z.object({
    pin: pinSchema,
    password: passwordSchema,
  }).strict()
});

export const verifyPinSchema = z.object({
  body: z.object({
    pin: pinSchema,
  }).strict()
});

export const resetPinSchema = z.object({
  body: z.object({
    password: passwordSchema,
    newPin: pinSchema,
  }).strict()
});

export const updatePinSchema = z.object({
  body: z.object({
    oldPin: pinSchema,
    newPin: pinSchema,
  }).strict()
});

// 2FA endpoints
export const enable2FASchema = z.object({
  body: z.object({
    password: passwordSchema,
  }).strict()
});

export const verify2FASetupSchema = z.object({
  body: z.object({
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
    tempToken: z.string().min(1),
  }).strict()
});

export const verify2FALoginSchema = z.object({
  body: z.object({
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
    tempToken: z.string().min(1),
  }).strict()
});

export const disable2FASchema = z.object({
  body: z.object({
    password: passwordSchema,
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits').optional(),
    backupCode: z.string().optional(),
  }).strict().refine(
    data => data.token || data.backupCode,
    { message: 'Either token or backup code is required' }
  )
});

// Wallet endpoints
export const importWalletSchema = z.object({
  body: z.object({
    seedPhrase: z.string()
      .min(1, 'Seed phrase is required')
      .max(500, 'Seed phrase too long')
      .refine(
        (phrase) => {
          const words = phrase.trim().split(/\s+/);
          return words.length === 12 || words.length === 24;
        },
        { message: 'Seed phrase must contain 12 or 24 words' }
      ),
    password: passwordSchema,
  }).strict()
});

export const walletByPrivateKeySchema = z.object({
  body: z.object({
    privateKey: z.string()
      .regex(/^(0x)?[a-fA-F0-9]{64}$/, 'Invalid private key format'),
    password: passwordSchema,
  }).strict()
});

export const exportCredentialsSchema = z.object({
  body: z.object({
    password: passwordSchema,
  }).strict()
});

// Transaction endpoints
export const sendTransactionSchema = z.object({
  body: z.object({
    toAddress: ethereumAddressSchema,
    amount: usdtAmountSchema,
    pin: pinSchema,
    idempotencyKey: z.string()
      .min(1, 'Idempotency key required')
      .max(64, 'Idempotency key too long')
      .optional(),
  }).strict()
});

export const estimateGasSchema = z.object({
  body: z.object({
    toAddress: ethereumAddressSchema,
    amount: usdtAmountSchema,
  }).strict()
});

export const receiveTransactionSchema = z.object({
  body: z.object({
    amount: usdtAmountSchema,
    fromAddress: ethereumAddressSchema.optional(),
  }).strict()
});

export const updateTransactionStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['pending', 'completed', 'failed', 'success']),
  }).strict()
});

// Savings goals endpoints
export const createSavingsGoalSchema = z.object({
  body: z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(100, 'Title must be at most 100 characters'),
    target: usdtAmountSchema,
    deadline: z.string().datetime({ message: 'Invalid datetime format' }),
  }).strict()
});

export const updateSavingsGoalSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    title: z.string()
      .min(1)
      .max(100)
      .optional(),
    current: usdtAmountSchema.optional(),
    target: usdtAmountSchema.optional(),
    deadline: z.string().datetime().optional(),
  }).strict()
});

export const deleteSavingsGoalSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  })
});

export const depositSavingsGoalSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    amount: usdtAmountSchema,
  })
});

// Investment plans endpoints
export const createInvestmentPlanSchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(100, 'Name must be at most 100 characters'),
    amount: usdtAmountSchema,
    frequency: z.enum(['weekly', 'monthly']),
    nextContribution: z.string().datetime({ message: 'Invalid datetime format' }),
    autoInvest: z.boolean().optional().default(true),
  }).strict()
});

export const updateInvestmentPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string()
      .min(1)
      .max(100)
      .optional(),
    amount: usdtAmountSchema.optional(),
    frequency: z.enum(['weekly', 'monthly']).optional(),
    nextContribution: z.string().datetime().optional(),
    autoInvest: z.boolean().optional(),
  }).strict()
});

export const deleteInvestmentPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  })
});

// Token refresh endpoint
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }).strict()
});

// Logout endpoint
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }).strict()
});

/**
 * Validation middleware
 */
export function validate(schema: z.ZodSchema) {
  return async (req: any, res: any, next: any) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Basic HTML escaping
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

/**
 * Calculate safe USDT amount using Decimal.js
 */
export function calculateAmount(amount1: string, amount2: string, operation: 'add' | 'subtract' | 'multiply' | 'divide'): string {
  try {
    const d1 = new Decimal(amount1);
    const d2 = new Decimal(amount2);
    
    let result: Decimal;
    switch (operation) {
      case 'add':
        result = d1.plus(d2);
        break;
      case 'subtract':
        result = d1.minus(d2);
        break;
      case 'multiply':
        result = d1.times(d2);
        break;
      case 'divide':
        if (d2.isZero()) {
          throw new Error('Division by zero');
        }
        result = d1.dividedBy(d2);
        break;
    }
    
    // Round to 8 decimal places for USDT
    return result.toFixed(8);
  } catch (error) {
    throw new Error('Invalid amount calculation');
  }
}

/**
 * Validate business logic constraints
 */
export function validateTransactionAmount(amount: string, balance: string): boolean {
  try {
    const amountDecimal = new Decimal(amount);
    const balanceDecimal = new Decimal(balance);
    
    // Check minimum transaction amount (0.01 USDT)
    if (amountDecimal.lt('0.01')) {
      return false;
    }
    
    // Check maximum transaction amount (100000 USDT)
    if (amountDecimal.gt('100000')) {
      return false;
    }
    
    // Check sufficient balance
    if (amountDecimal.gt(balanceDecimal)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}