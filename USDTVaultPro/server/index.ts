import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import { globalRateLimiter, apiSlowDown } from "./rateLimiting";
import { setCsrfToken, verifyCsrfToken } from "./csrf";
import { addRequestId, SecurityEventType, logSecurityEvent } from "./securityLogger";

// Verify JWT secret is set
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  console.error('Please set JWT_SECRET to a secure random string.');
  process.exit(1);
}

const app = express();

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for development
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Remove X-Powered-By header
app.disable('x-powered-by');

// Add request ID for tracking
app.use(addRequestId());

// Cookie parser for CSRF
app.use(cookieParser());

// Rate limiting and slowdown
app.use('/api/', globalRateLimiter);
app.use('/api/', apiSlowDown);

// MongoDB injection protection
app.use(mongoSanitize({
  replaceWith: '_',
  allowDots: false,
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Body parsing with size limits
app.use(express.json({
  limit: '1mb', // Prevent large payload DOS
  verify: (req, _res, buf) => {
    req.rawBody = buf;
    // Check for suspiciously large payloads
    if (buf.length > 500000) { // 500KB
      logSecurityEvent(req as any, SecurityEventType.SUSPICIOUS_ACTIVITY, 
        `Large payload received: ${buf.length} bytes`);
    }
  }
}));
app.use(express.urlencoded({ 
  extended: false,
  limit: '1mb'
}));

// CSRF protection for API routes
// Note: GET, HEAD, OPTIONS requests are automatically skipped by the middleware
app.use('/api/', setCsrfToken());
app.use('/api/', verifyCsrfToken({
  skipRoutes: [
    '/api/auth/login',      // Login uses password authentication
    '/api/auth/register',   // Registration doesn't need CSRF
    '/api/csrf-token',      // Endpoint to get CSRF token
    '/api/auth/verify',     // Token verification endpoint
    '/api/auth/refresh'     // Token refresh endpoint
  ]
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
