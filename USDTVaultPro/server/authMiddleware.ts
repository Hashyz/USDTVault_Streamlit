import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT secret must be provided via environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set<string>();

// Refresh token storage (in production, use database)
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware to verify JWT token
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access token required' 
    });
  }

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ 
      error: 'TOKEN_REVOKED',
      message: 'Token has been revoked' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if it's a temporary token (for 2FA)
    if (decoded.temp) {
      return res.status(401).json({ 
        error: 'TEMPORARY_TOKEN',
        message: '2FA verification required' 
      });
    }

    req.userId = decoded.id;
    req.userRole = decoded.role || 'user';
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired' 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: 'Invalid token' 
      });
    }
    return res.status(500).json({ 
      error: 'TOKEN_VERIFICATION_FAILED',
      message: 'Token verification failed' 
    });
  }
};

/**
 * Middleware for temporary 2FA tokens
 */
export const authenticateTempToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Temporary token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if it's actually a temporary token
    if (!decoded.temp) {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN_TYPE',
        message: 'Temporary token expected' 
      });
    }

    req.userId = decoded.id;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED',
        message: 'Temporary token has expired' 
      });
    }
    return res.status(401).json({ 
      error: 'INVALID_TOKEN',
      message: 'Invalid temporary token' 
    });
  }
};

/**
 * Generate access and refresh tokens
 */
export function generateTokens(userId: string, username: string, role: string = 'user') {
  const accessToken = jwt.sign(
    { id: userId, username, role },
    JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    { id: userId, username, role, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  refreshTokens.set(refreshToken, { userId, expiresAt });

  return { accessToken, refreshToken };
}

/**
 * Generate temporary token for 2FA
 */
export function generateTempToken(userId: string, username: string) {
  return jwt.sign(
    { id: userId, username, temp: true },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return null;
    }

    const storedToken = refreshTokens.get(refreshToken);
    if (!storedToken || storedToken.userId !== decoded.id) {
      return null;
    }

    if (new Date() > storedToken.expiresAt) {
      refreshTokens.delete(refreshToken);
      return null;
    }

    const accessToken = jwt.sign(
      { id: decoded.id, username: decoded.username, role: decoded.role || 'user' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return { accessToken };
  } catch {
    return null;
  }
}

/**
 * Blacklist a token (for logout)
 */
export function blacklistToken(token: string) {
  tokenBlacklist.add(token);
}

/**
 * Clean up expired tokens periodically
 */
setInterval(() => {
  const now = new Date();
  
  // Clean expired refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (now > data.expiresAt) {
      refreshTokens.delete(token);
    }
  }
  
  // In production, clean blacklist based on token expiry time
  // For now, clear it if it gets too large
  if (tokenBlacklist.size > 10000) {
    tokenBlacklist.clear();
  }
}, 60 * 60 * 1000); // Run every hour