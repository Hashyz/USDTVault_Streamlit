import { Request } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Security event logger
 * In production, use a proper logging service like Winston or Pino
 */

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  REGISTRATION = 'REGISTRATION',
  LOGOUT = 'LOGOUT',
  PIN_VERIFICATION_SUCCESS = 'PIN_VERIFICATION_SUCCESS',
  PIN_VERIFICATION_FAILED = 'PIN_VERIFICATION_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  TWO_FA_SUCCESS = '2FA_SUCCESS',
  TWO_FA_FAILED = '2FA_FAILED',
  TRANSACTION_INITIATED = 'TRANSACTION_INITIATED',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  WALLET_IMPORTED = 'WALLET_IMPORTED',
  CREDENTIALS_EXPORTED = 'CREDENTIALS_EXPORTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATABASE_ERROR = 'DATABASE_ERROR',
  API_ERROR = 'API_ERROR',
}

export interface SecurityEvent {
  timestamp: Date;
  type: SecurityEventType;
  userId?: string;
  username?: string;
  ip: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  message: string;
  metadata?: any;
  requestId?: string;
}

class SecurityLogger {
  private logDir: string;
  private currentLogFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'security');
    this.ensureLogDirectory();
    this.currentLogFile = this.getLogFileName();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `security-${date}.log`);
  }

  private rotateLogIfNeeded() {
    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }
  }

  private formatLogEntry(event: SecurityEvent): string {
    return JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    }) + '\n';
  }

  public log(event: SecurityEvent) {
    try {
      this.rotateLogIfNeeded();
      const logEntry = this.formatLogEntry(event);
      
      // Write to file
      fs.appendFileSync(this.currentLogFile, logEntry);
      
      // Also log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SECURITY] ${event.type}: ${event.message}`, {
          userId: event.userId,
          ip: event.ip,
          endpoint: event.endpoint,
        });
      }
      
      // Alert on critical events
      this.checkCriticalEvent(event);
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  private checkCriticalEvent(event: SecurityEvent) {
    const criticalEvents = [
      SecurityEventType.ACCOUNT_LOCKED,
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityEventType.DATABASE_ERROR,
    ];
    
    if (criticalEvents.includes(event.type)) {
      // In production, send alert to monitoring service
      console.error(`[CRITICAL SECURITY EVENT] ${event.type}:`, event);
    }
  }

  public async getRecentEvents(count: number = 100): Promise<SecurityEvent[]> {
    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      const events = lines.slice(-count).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      return events;
    } catch {
      return [];
    }
  }

  public async getUserEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    const events = await this.getRecentEvents(500);
    return events
      .filter(event => event.userId === userId)
      .slice(-limit);
  }

  public async getFailedLoginAttempts(ip: string, minutes: number = 15): Promise<number> {
    const events = await this.getRecentEvents(200);
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    
    return events.filter(event => 
      event.type === SecurityEventType.LOGIN_FAILED &&
      event.ip === ip &&
      new Date(event.timestamp) > cutoff
    ).length;
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();

/**
 * Middleware to add request ID for tracking
 */
export function addRequestId() {
  return (req: Request & { requestId?: string }, res: any, next: any) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  };
}

/**
 * Helper to extract client info from request
 */
export function extractClientInfo(req: Request): {
  ip: string;
  userAgent: string;
  requestId: string;
} {
  return {
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        (req.headers['x-real-ip'] as string) ||
        req.socket.remoteAddress ||
        'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    requestId: (req as any).requestId || 'unknown',
  };
}

/**
 * Log security event from request context
 */
export function logSecurityEvent(
  req: Request,
  type: SecurityEventType,
  message: string,
  metadata?: any
) {
  const { ip, userAgent, requestId } = extractClientInfo(req);
  
  securityLogger.log({
    timestamp: new Date(),
    type,
    userId: (req as any).userId,
    username: (req as any).username,
    ip,
    userAgent,
    endpoint: req.path,
    method: req.method,
    statusCode: (req as any).res?.statusCode,
    message,
    metadata,
    requestId,
  });
}