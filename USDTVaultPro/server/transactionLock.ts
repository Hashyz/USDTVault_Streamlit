import { Request, Response, NextFunction } from 'express';

/**
 * Transaction lock manager to prevent race conditions
 * In production, use Redis with Redlock algorithm
 */

// Lock storage
const transactionLocks = new Map<string, {
  userId: string;
  timestamp: Date;
  expiresAt: Date;
}>();

// Idempotency key storage (prevent duplicate transactions)
const idempotencyKeys = new Map<string, {
  userId: string;
  result: any;
  timestamp: Date;
}>();

// User locks for preventing concurrent wallet operations
const userLocks = new Map<string, {
  operation: string;
  timestamp: Date;
  expiresAt: Date;
}>();

/**
 * Acquire a lock for a specific user's wallet operations
 */
export async function acquireUserLock(userId: string, operation: string, ttlMs: number = 30000): Promise<boolean> {
  const existingLock = userLocks.get(userId);
  
  if (existingLock && existingLock.expiresAt > new Date()) {
    // Lock is held by another operation
    return false;
  }
  
  // Acquire the lock
  userLocks.set(userId, {
    operation,
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  
  return true;
}

/**
 * Release a user's wallet lock
 */
export function releaseUserLock(userId: string) {
  userLocks.delete(userId);
}

/**
 * Middleware to ensure wallet operations are serialized per user
 */
export function walletOperationLock(operation: string) {
  return async (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'User authentication required',
      });
    }
    
    // Try to acquire lock with retries
    let attempts = 0;
    const maxAttempts = 10;
    const retryDelay = 100; // ms
    
    while (attempts < maxAttempts) {
      const acquired = await acquireUserLock(userId, operation);
      
      if (acquired) {
        // Lock acquired, ensure it's released after operation
        res.on('finish', () => {
          releaseUserLock(userId);
        });
        
        return next();
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempts));
      }
    }
    
    // Could not acquire lock after retries
    return res.status(503).json({
      error: 'WALLET_OPERATION_IN_PROGRESS',
      message: 'Another wallet operation is in progress. Please try again shortly.',
    });
  };
}

/**
 * Idempotency middleware for transaction endpoints
 */
export function idempotencyCheck() {
  return (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const idempotencyKey = req.body.idempotencyKey || req.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      // No idempotency key provided, continue without checking
      return next();
    }
    
    const userId = req.userId;
    const key = `${userId}_${idempotencyKey}`;
    const existing = idempotencyKeys.get(key);
    
    if (existing) {
      // Check if it's from the same user
      if (existing.userId !== userId) {
        return res.status(400).json({
          error: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency key belongs to another user',
        });
      }
      
      // Return the cached result
      return res.status(200).json({
        ...existing.result,
        cached: true,
      });
    }
    
    // Store the response when it's sent
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyKeys.set(key, {
          userId: userId!,
          result: data,
          timestamp: new Date(),
        });
      }
      return originalJson(data);
    };
    
    next();
  };
}

/**
 * Transaction lock to prevent double-spending
 */
export async function acquireTransactionLock(transactionId: string, userId: string, ttlMs: number = 60000): Promise<boolean> {
  const existing = transactionLocks.get(transactionId);
  
  if (existing && existing.expiresAt > new Date()) {
    return false; // Lock is held
  }
  
  transactionLocks.set(transactionId, {
    userId,
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  
  return true;
}

/**
 * Release transaction lock
 */
export function releaseTransactionLock(transactionId: string) {
  transactionLocks.delete(transactionId);
}

/**
 * Clean up expired locks and idempotency keys
 */
setInterval(() => {
  const now = new Date();
  
  // Clean expired user locks
  for (const [userId, lock] of userLocks.entries()) {
    if (lock.expiresAt < now) {
      userLocks.delete(userId);
    }
  }
  
  // Clean expired transaction locks
  for (const [id, lock] of transactionLocks.entries()) {
    if (lock.expiresAt < now) {
      transactionLocks.delete(id);
    }
  }
  
  // Clean old idempotency keys (keep for 24 hours)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const [key, data] of idempotencyKeys.entries()) {
    if (data.timestamp < oneDayAgo) {
      idempotencyKeys.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}