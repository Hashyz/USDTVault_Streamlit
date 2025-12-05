import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';

// Custom key generator to handle different IP headers
const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         (req.headers['x-real-ip'] as string) ||
         req.socket.remoteAddress ||
         'unknown';
};

// Store for tracking attempts (in production, use Redis)
const attemptStore = new Map<string, { count: number; resetTime: Date }>();

/**
 * Global rate limiter - 100 requests per 15 minutes
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
    retryAfter: 900, // seconds
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again in 15 minutes',
    });
  },
});

/**
 * Auth endpoints rate limiter - 5 attempts per 15 minutes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful auth requests
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts',
    retryAfter: 900,
  },
});

/**
 * Transaction endpoints rate limiter - 10 per hour
 */
export const transactionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user, not just IP
    const userId = (req as any).userId;
    const ip = getClientIp(req);
    return `${userId || 'anon'}_${ip}`;
  },
  message: {
    error: 'TRANSACTION_RATE_LIMIT_EXCEEDED',
    message: 'Too many transactions, please wait before trying again',
    retryAfter: 3600,
  },
});

/**
 * PIN/2FA verification rate limiter with exponential backoff
 */
export const verificationRateLimiter = (type: 'pin' | '2fa') => {
  return (req: Request, res: Response, next: any) => {
    const userId = (req as any).userId || 'anon';
    const ip = getClientIp(req);
    const key = `${type}_${userId}_${ip}`;
    
    const now = new Date();
    const attempt = attemptStore.get(key);
    
    if (attempt && attempt.resetTime > now) {
      const remainingTime = Math.ceil((attempt.resetTime.getTime() - now.getTime()) / 1000);
      
      if (attempt.count >= 5) {
        return res.status(429).json({
          error: 'VERIFICATION_RATE_LIMIT_EXCEEDED',
          message: `Too many ${type.toUpperCase()} verification attempts`,
          retryAfter: remainingTime,
          attemptsRemaining: 0,
        });
      }
      
      // Exponential backoff after 3 attempts
      if (attempt.count >= 3) {
        const backoffSeconds = Math.pow(2, attempt.count - 2) * 10; // 10s, 20s, 40s, etc.
        const backoffUntil = new Date(now.getTime() + backoffSeconds * 1000);
        
        if (backoffUntil > attempt.resetTime) {
          attempt.resetTime = backoffUntil;
        }
      }
      
      attempt.count++;
    } else {
      attemptStore.set(key, {
        count: 1,
        resetTime: new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes
      });
    }
    
    // Add attempt info to request for use in handlers
    (req as any).attemptInfo = attemptStore.get(key);
    next();
  };
};

/**
 * Slow down middleware for gradual performance degradation
 */
export const apiSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Start slowing down after 50 requests
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // Maximum delay of 2 seconds
  keyGenerator: getClientIp,
});

/**
 * Create user-specific rate limiter
 */
export const createUserRateLimiter = (maxRequests: number, windowMinutes: number) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => {
      const userId = (req as any).userId;
      if (!userId) return getClientIp(req);
      return `user_${userId}`;
    },
    message: {
      error: 'USER_RATE_LIMIT_EXCEEDED',
      message: `User rate limit exceeded. Max ${maxRequests} requests per ${windowMinutes} minutes`,
    },
  });
};

/**
 * API endpoint-specific rate limiters
 */
export const endpointLimiters = {
  // Wallet operations - more restrictive
  walletImport: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Only 3 wallet imports per hour
    keyGenerator: (req) => `wallet_${(req as any).userId}_${getClientIp(req)}`,
    message: {
      error: 'WALLET_IMPORT_LIMIT_EXCEEDED',
      message: 'Too many wallet import attempts. Please wait 1 hour',
    },
  }),
  
  // Export operations - prevent data scraping
  exportCredentials: rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5,
    keyGenerator: (req) => `export_${(req as any).userId}`,
    message: {
      error: 'EXPORT_LIMIT_EXCEEDED',
      message: 'Too many export attempts. Please wait 30 minutes',
    },
  }),
  
  // Gas estimation - prevent abuse
  gasEstimate: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 estimates per minute
    keyGenerator: (req) => `gas_${(req as any).userId || getClientIp(req)}`,
    message: {
      error: 'GAS_ESTIMATE_LIMIT_EXCEEDED',
      message: 'Too many gas estimation requests',
    },
  }),
  
  // Balance check - prevent polling abuse
  balanceCheck: rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 5, // 5 checks per 10 seconds
    keyGenerator: (req) => `balance_${(req as any).userId}`,
    message: {
      error: 'BALANCE_CHECK_LIMIT_EXCEEDED',
      message: 'Too many balance check requests',
    },
  }),
};

/**
 * Reset attempts for a user (call after successful verification)
 */
export function resetAttempts(type: 'pin' | '2fa', userId: string, ip: string) {
  const key = `${type}_${userId}_${ip}`;
  attemptStore.delete(key);
}

/**
 * Clean up old attempts periodically
 */
setInterval(() => {
  const now = new Date();
  for (const [key, attempt] of attemptStore.entries()) {
    if (attempt.resetTime < now) {
      attemptStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes