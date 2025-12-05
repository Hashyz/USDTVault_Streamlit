import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection using Double-Submit Cookie pattern
 * More flexible than csurf for API-based applications
 */

// Store CSRF tokens (in production, use Redis or session storage)
const csrfTokenStore = new Map<string, {
  token: string;
  createdAt: Date;
  userId?: string;
}>();

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to set CSRF token cookie
 */
export function setCsrfToken() {
  return (req: Request & { csrfToken?: string }, res: Response, next: NextFunction) => {
    let token = req.cookies?.['csrf-token'];
    
    if (!token || !csrfTokenStore.has(token)) {
      // Generate new token
      token = generateCsrfToken();
      csrfTokenStore.set(token, {
        token,
        createdAt: new Date(),
        userId: (req as any).userId,
      });
      
      // Set as httpOnly cookie with SameSite=Strict
      res.cookie('csrf-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    
    req.csrfToken = token;
    next();
  };
}

/**
 * Middleware to verify CSRF token
 */
export function verifyCsrfToken(options: { skipRoutes?: string[] } = {}) {
  const skipRoutes = options.skipRoutes || [];
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // Skip specified routes
    // req.baseUrl contains the mount path (/api) and req.path contains the rest
    const fullPath = req.baseUrl + req.path;
    if (skipRoutes.some(route => {
      // Handle both full paths and relative paths
      if (route.startsWith('/api/')) {
        return fullPath === route || fullPath.startsWith(route);
      }
      // For relative paths, check against req.path
      return req.path === route || req.path.startsWith(route);
    })) {
      return next();
    }
    
    // Get token from cookie
    const cookieToken = req.cookies?.['csrf-token'];
    
    // Get token from header or body
    const headerToken = req.headers['x-csrf-token'] as string || 
                       req.headers['csrf-token'] as string ||
                       req.body?.csrfToken;
    
    if (!cookieToken || !headerToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required',
      });
    }
    
    if (cookieToken !== headerToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid CSRF token',
      });
    }
    
    // Verify token exists in store
    const storedToken = csrfTokenStore.get(cookieToken);
    if (!storedToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_EXPIRED',
        message: 'CSRF token has expired',
      });
    }
    
    // Verify user ID matches if authenticated
    if ((req as any).userId && storedToken.userId && storedToken.userId !== (req as any).userId) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_USER_MISMATCH',
        message: 'CSRF token does not match user',
      });
    }
    
    next();
  };
}

/**
 * Endpoint to get CSRF token for frontend
 */
export function getCsrfTokenEndpoint() {
  return (req: Request & { csrfToken?: string }, res: Response) => {
    const token = req.csrfToken || generateCsrfToken();
    
    if (!req.csrfToken) {
      csrfTokenStore.set(token, {
        token,
        createdAt: new Date(),
        userId: (req as any).userId,
      });
      
      res.cookie('csrf-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }
    
    res.json({ csrfToken: token });
  };
}

/**
 * Clean up expired tokens
 */
setInterval(() => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  for (const [token, data] of csrfTokenStore.entries()) {
    if (data.createdAt < oneDayAgo) {
      csrfTokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000); // Clean every hour