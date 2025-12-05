import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import Decimal from "decimal.js";
import { insertTransactionSchema, insertSavingsGoalSchema, insertInvestmentPlanSchema } from "@shared/schema";
import { blockchainService } from "./blockchainService";
import { aiCounselingService } from "./services/aiCounseling";

// Import security modules
import { 
  authenticateToken,
  authenticateTempToken,
  generateTokens,
  generateTempToken,
  refreshAccessToken,
  blacklistToken
} from "./authMiddleware";
import {
  validate,
  sanitizeInput,
  calculateAmount,
  validateTransactionAmount,
  registerSchema,
  loginSchema,
  validatePasswordSchema,
  setupPinSchema,
  verifyPinSchema,
  resetPinSchema,
  updatePinSchema,
  enable2FASchema,
  verify2FASetupSchema,
  verify2FALoginSchema,
  disable2FASchema,
  importWalletSchema,
  walletByPrivateKeySchema,
  exportCredentialsSchema,
  sendTransactionSchema,
  estimateGasSchema,
  receiveTransactionSchema,
  updateTransactionStatusSchema,
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
  deleteSavingsGoalSchema,
  depositSavingsGoalSchema,
  createInvestmentPlanSchema,
  updateInvestmentPlanSchema,
  deleteInvestmentPlanSchema,
  refreshTokenSchema,
  logoutSchema
} from "./validation";
import {
  authRateLimiter,
  transactionRateLimiter,
  verificationRateLimiter,
  endpointLimiters,
  resetAttempts
} from "./rateLimiting";
import {
  walletOperationLock,
  idempotencyCheck,
  generateTransactionId
} from "./transactionLock";
import { getCsrfTokenEndpoint } from "./csrf";
import {
  SecurityEventType,
  logSecurityEvent,
  extractClientInfo
} from "./securityLogger";

// Configure Decimal.js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_DOWN });

export async function registerRoutes(app: Express): Promise<Server> {
  // CSRF token endpoint
  app.get("/api/csrf-token", getCsrfTokenEndpoint());

  // Authentication routes with rate limiting and validation
  app.post("/api/auth/register",
    authRateLimiter,
    validate(registerSchema),
    async (req, res) => {
      try {
        const { username, password } = req.body;
        
        // Sanitize input
        const sanitizedUsername = sanitizeInput(username).toLowerCase();
        
        // Check if user exists
        const existingUser = await storage.getUserByUsername(sanitizedUsername);
        if (existingUser) {
          logSecurityEvent(req, SecurityEventType.REGISTRATION, `Registration failed - username exists: ${sanitizedUsername}`);
          return res.status(400).json({ 
            error: 'USERNAME_EXISTS',
            message: "Username already exists" 
          });
        }

        // Create user
        const user = await storage.createUser({ 
          username: sanitizedUsername, 
          password 
        });
        
        const { accessToken, refreshToken } = generateTokens(user.id, user.username);
        
        logSecurityEvent(req, SecurityEventType.REGISTRATION, `User registered: ${sanitizedUsername}`);
        
        res.json({ 
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            walletAddress: user.walletAddress,
            balance: user.balance,
            hasPinSetup: !!user.pin,
          }
        });
      } catch (error: any) {
        logSecurityEvent(req, SecurityEventType.API_ERROR, `Registration error: ${error.message}`);
        res.status(500).json({ 
          error: 'REGISTRATION_FAILED',
          message: "Failed to register user",
          requestId: (req as any).requestId 
        });
      }
    }
  );

  app.post("/api/auth/login",
    authRateLimiter,
    validate(loginSchema),
    async (req, res) => {
      try {
        const { username, password } = req.body;
        const sanitizedUsername = sanitizeInput(username).toLowerCase();
        
        const user = await storage.getUserByUsername(sanitizedUsername);
        if (!user) {
          logSecurityEvent(req, SecurityEventType.LOGIN_FAILED, `Invalid username: ${sanitizedUsername}`);
          return res.status(401).json({ 
            error: 'INVALID_CREDENTIALS',
            message: "Invalid credentials" 
          });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          logSecurityEvent(req, SecurityEventType.LOGIN_FAILED, `Invalid password for user: ${sanitizedUsername}`);
          return res.status(401).json({ 
            error: 'INVALID_CREDENTIALS',
            message: "Invalid credentials" 
          });
        }

        // Check if 2FA is enabled
        if (user.twoFactorEnabled) {
          const tempToken = generateTempToken(user.id, user.username);
          
          logSecurityEvent(req, SecurityEventType.LOGIN_SUCCESS, `2FA required for user: ${sanitizedUsername}`);
          
          return res.json({
            requires2FA: true,
            tempToken,
          });
        }

        const { accessToken, refreshToken } = generateTokens(user.id, user.username);
        
        logSecurityEvent(req, SecurityEventType.LOGIN_SUCCESS, `User logged in: ${sanitizedUsername}`);
        
        res.json({ 
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            walletAddress: user.walletAddress,
            balance: user.balance,
            hasPinSetup: !!user.pin,
          }
        });
      } catch (error: any) {
        logSecurityEvent(req, SecurityEventType.API_ERROR, `Login error: ${error.message}`);
        res.status(500).json({ 
          error: 'LOGIN_FAILED',
          message: "Failed to login",
          requestId: (req as any).requestId
        });
      }
    }
  );

  app.get("/api/auth/verify", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
        balance: user.balance,
        hasPinSetup: !!user.pin,
      });
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({ message: "Failed to verify user" });
    }
  });

  // Password validation endpoint (for PIN operations)
  app.post("/api/auth/validate-password", authenticateToken, async (req: any, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Password validation error:", error);
      res.status(500).json({ message: "Failed to validate password" });
    }
  });

  // PIN Management routes
  app.post("/api/auth/pin/setup", authenticateToken, async (req: any, res) => {
    try {
      const { pin, password } = req.body;
      
      if (!pin || !password) {
        return res.status(400).json({ message: "PIN and password required" });
      }

      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 4-6 digits" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      // Hash the PIN
      const hashedPin = await bcrypt.hash(pin, 10);
      
      // Update user PIN
      const updatedUser = await storage.updateUserPin(req.userId, hashedPin);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to set up PIN" });
      }

      res.json({ message: "PIN set up successfully", hasPinSetup: true });
    } catch (error) {
      console.error("PIN setup error:", error);
      res.status(500).json({ message: "Failed to set up PIN" });
    }
  });

  app.post("/api/auth/pin/verify", authenticateToken, async (req: any, res) => {
    try {
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({ message: "PIN required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.pin) {
        return res.status(400).json({ message: "PIN not set up" });
      }

      // Check if account is locked
      if (user.pinLockoutUntil && new Date(user.pinLockoutUntil) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(user.pinLockoutUntil).getTime() - new Date().getTime()) / (1000 * 60));
        return res.status(429).json({ 
          message: `Account locked. Try again in ${remainingMinutes} minutes`,
          lockoutUntil: user.pinLockoutUntil
        });
      }

      // Verify PIN
      const validPin = await bcrypt.compare(pin, user.pin);
      
      if (validPin) {
        // Reset attempts on successful verification
        await storage.updatePinAttempts(req.userId, 0);
        await storage.updatePinLockout(req.userId, null);
        
        res.json({ message: "PIN verified successfully", verified: true });
      } else {
        // Increment failed attempts
        const attempts = (Number(user.pinAttempts) || 0) + 1;
        await storage.updatePinAttempts(req.userId, attempts);
        
        // Lock account after 5 failed attempts
        if (attempts >= 5) {
          const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
          await storage.updatePinLockout(req.userId, lockoutUntil);
          
          return res.status(429).json({ 
            message: "Too many failed attempts. Account locked for 15 minutes",
            lockoutUntil
          });
        }
        
        res.status(401).json({ 
          message: "Invalid PIN", 
          attemptsRemaining: 5 - attempts,
          verified: false
        });
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      res.status(500).json({ message: "Failed to verify PIN" });
    }
  });

  app.post("/api/auth/pin/reset", authenticateToken, async (req: any, res) => {
    try {
      const { password, newPin } = req.body;
      
      if (!password || !newPin) {
        return res.status(400).json({ message: "Password and new PIN required" });
      }

      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(newPin)) {
        return res.status(400).json({ message: "PIN must be 4-6 digits" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      // Hash the new PIN
      const hashedPin = await bcrypt.hash(newPin, 10);
      
      // Update user PIN and reset lockout
      const updatedUser = await storage.updateUserPin(req.userId, hashedPin);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to reset PIN" });
      }

      res.json({ message: "PIN reset successfully" });
    } catch (error) {
      console.error("PIN reset error:", error);
      res.status(500).json({ message: "Failed to reset PIN" });
    }
  });

  app.get("/api/auth/pin/status", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isLocked = user.pinLockoutUntil && new Date(user.pinLockoutUntil) > new Date();
      
      res.json({
        hasPinSetup: !!user.pin,
        isLocked,
        lockoutUntil: isLocked ? user.pinLockoutUntil : null,
        attemptsRemaining: user.pin ? Math.max(0, 5 - (Number(user.pinAttempts) || 0)) : null
      });
    } catch (error) {
      console.error("PIN status error:", error);
      res.status(500).json({ message: "Failed to get PIN status" });
    }
  });

  app.put("/api/auth/pin/update", authenticateToken, async (req: any, res) => {
    try {
      const { oldPin, newPin } = req.body;
      
      if (!oldPin || !newPin) {
        return res.status(400).json({ message: "Old PIN and new PIN required" });
      }

      // Validate new PIN format (6 digits)
      if (!/^\d{6}$/.test(newPin)) {
        return res.status(400).json({ message: "PIN must be exactly 6 digits" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.pin) {
        return res.status(400).json({ message: "PIN not set up" });
      }

      // Check if account is locked
      if (user.pinLockoutUntil && new Date(user.pinLockoutUntil) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(user.pinLockoutUntil).getTime() - new Date().getTime()) / (1000 * 60));
        return res.status(429).json({ 
          message: `Account locked. Try again in ${remainingMinutes} minutes`,
          lockoutUntil: user.pinLockoutUntil
        });
      }

      // Verify old PIN
      const validOldPin = await bcrypt.compare(oldPin, user.pin);
      
      if (!validOldPin) {
        // Increment failed attempts
        const attempts = (Number(user.pinAttempts) || 0) + 1;
        await storage.updatePinAttempts(req.userId, attempts);
        
        // Lock account after 3 failed attempts (not 5 for PIN updates)
        if (attempts >= 3) {
          const lockoutUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          await storage.updatePinLockout(req.userId, lockoutUntil);
          
          return res.status(429).json({ 
            message: "Too many failed attempts. Account locked for 5 minutes",
            lockoutUntil
          });
        }
        
        return res.status(401).json({ 
          message: "Invalid old PIN", 
          attemptsRemaining: 3 - attempts
        });
      }

      // Reset attempts and hash the new PIN
      await storage.updatePinAttempts(req.userId, 0);
      await storage.updatePinLockout(req.userId, null);
      
      const hashedPin = await bcrypt.hash(newPin, 10);
      
      // Update user PIN
      const updatedUser = await storage.updateUserPin(req.userId, hashedPin);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update PIN" });
      }

      res.json({ message: "PIN updated successfully" });
    } catch (error) {
      console.error("PIN update error:", error);
      res.status(500).json({ message: "Failed to update PIN" });
    }
  });

  app.delete("/api/auth/pin/remove", authenticateToken, async (req: any, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password required" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.pin) {
        return res.status(400).json({ message: "PIN not set up" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      // Remove PIN and reset related fields
      const updatedUser = await storage.updateUserPin(req.userId, null);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to remove PIN" });
      }

      // Also reset attempts and lockout
      await storage.updatePinAttempts(req.userId, 0);
      await storage.updatePinLockout(req.userId, null);

      res.json({ message: "PIN removed successfully" });
    } catch (error) {
      console.error("PIN remove error:", error);
      res.status(500).json({ message: "Failed to remove PIN" });
    }
  });

  // Two-Factor Authentication (2FA) routes
  const ENCRYPTION_KEY = process.env.SESSION_SECRET || JWT_SECRET;
  
  // Helper function to generate random alphanumeric code
  function generateBackupCode(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Rate limiting for 2FA attempts (simple in-memory store)
  const twoFactorAttempts = new Map<string, { count: number; resetAt: number }>();

  function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userAttempts = twoFactorAttempts.get(userId);
    
    if (!userAttempts || userAttempts.resetAt < now) {
      twoFactorAttempts.set(userId, { count: 1, resetAt: now + 60000 }); // Reset after 1 minute
      return true;
    }
    
    if (userAttempts.count >= 5) {
      return false; // Rate limit exceeded
    }
    
    userAttempts.count++;
    return true;
  }

  app.post("/api/auth/2fa/setup", authenticateToken, async (req: any, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password required to set up 2FA" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      // Generate new secret
      const secret = speakeasy.generateSecret({
        name: `USDT Savings (${user.username})`,
        length: 32,
      });

      // Encrypt the secret before storing
      const encryptedSecret = CryptoJS.AES.encrypt(secret.base32, ENCRYPTION_KEY).toString();
      
      // Store the secret temporarily (not enabled yet)
      await storage.setTwoFactorSecret(req.userId, encryptedSecret);

      // Send the OTP auth URL directly - the frontend will generate the QR code
      res.json({
        qrCode: secret.otpauth_url || '',
        manualEntryKey: secret.base32,
        appName: 'USDT Savings',
      });
    } catch (error) {
      console.error("2FA setup error:", error);
      res.status(500).json({ message: "Failed to set up 2FA" });
    }
  });

  app.post("/api/auth/2fa/verify", authenticateToken, async (req: any, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Verification code required" });
      }

      if (!checkRateLimit(req.userId)) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }

      const twoFactorData = await storage.getTwoFactorData(req.userId);
      if (!twoFactorData || !twoFactorData.secret) {
        return res.status(400).json({ message: "2FA not set up" });
      }

      // Decrypt the secret
      const decryptedSecret = CryptoJS.AES.decrypt(twoFactorData.secret, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

      // Verify the code
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: code,
        window: 2, // Allow 2 time steps before/after
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Generate backup codes
      const backupCodes: string[] = [];
      const hashedBackupCodes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const code = generateBackupCode();
        backupCodes.push(code);
        const hashedCode = await bcrypt.hash(code, 10);
        hashedBackupCodes.push(hashedCode);
      }

      // Encrypt backup codes for storage
      const encryptedBackupCodes = CryptoJS.AES.encrypt(
        JSON.stringify(hashedBackupCodes),
        ENCRYPTION_KEY
      ).toString();

      // Enable 2FA and store backup codes
      await storage.enableTwoFactor(req.userId, true);
      await storage.setBackupCodes(req.userId, encryptedBackupCodes);

      res.json({
        message: "2FA enabled successfully",
        backupCodes, // Return plain backup codes (show once only)
      });
    } catch (error) {
      console.error("2FA verification error:", error);
      res.status(500).json({ message: "Failed to verify 2FA" });
    }
  });

  app.post("/api/auth/2fa/disable", authenticateToken, async (req: any, res) => {
    try {
      const { password, code } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password required to disable 2FA" });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Invalid password" });
      }

      const twoFactorData = await storage.getTwoFactorData(req.userId);
      if (!twoFactorData || !twoFactorData.enabled) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      // Verify TOTP code or backup code
      if (code) {
        // Try TOTP first
        if (twoFactorData.secret) {
          const decryptedSecret = CryptoJS.AES.decrypt(twoFactorData.secret, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
          const validTotp = speakeasy.totp.verify({
            secret: decryptedSecret,
            encoding: 'base32',
            token: code,
            window: 2,
          });

          if (!validTotp && twoFactorData.backupCodes) {
            // Try backup code
            const decryptedBackupCodes = JSON.parse(
              CryptoJS.AES.decrypt(twoFactorData.backupCodes, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
            );
            
            let validBackupCode = false;
            for (const hashedCode of decryptedBackupCodes) {
              if (await bcrypt.compare(code.toUpperCase(), hashedCode)) {
                validBackupCode = true;
                break;
              }
            }
            
            if (!validBackupCode) {
              return res.status(400).json({ message: "Invalid verification code" });
            }
          } else if (!validTotp) {
            return res.status(400).json({ message: "Invalid verification code" });
          }
        }
      }

      // Disable 2FA and clear secrets
      await storage.enableTwoFactor(req.userId, false);
      await storage.setTwoFactorSecret(req.userId, null);
      await storage.setBackupCodes(req.userId, null);

      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      console.error("2FA disable error:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  app.get("/api/auth/2fa/status", authenticateToken, async (req: any, res) => {
    try {
      const twoFactorData = await storage.getTwoFactorData(req.userId);
      
      res.json({
        enabled: twoFactorData?.enabled || false,
        hasBackupCodes: !!twoFactorData?.backupCodes,
      });
    } catch (error) {
      console.error("2FA status error:", error);
      res.status(500).json({ message: "Failed to get 2FA status" });
    }
  });

  app.post("/api/auth/2fa/login-verify", async (req, res) => {
    try {
      const { tempToken, code } = req.body;
      
      if (!tempToken || !code) {
        return res.status(400).json({ message: "Temporary token and code required" });
      }

      // Verify temp token
      let tempUser: any;
      try {
        tempUser = jwt.verify(tempToken, JWT_SECRET) as any;
        if (!tempUser.temp) {
          return res.status(400).json({ message: "Invalid temporary token" });
        }
      } catch (error) {
        return res.status(401).json({ message: "Invalid or expired temporary token" });
      }

      if (!checkRateLimit(tempUser.id)) {
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }

      const user = await storage.getUser(tempUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const twoFactorData = await storage.getTwoFactorData(tempUser.id);
      if (!twoFactorData || !twoFactorData.enabled || !twoFactorData.secret) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      // Decrypt the secret
      const decryptedSecret = CryptoJS.AES.decrypt(twoFactorData.secret, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

      // Try TOTP verification first
      let verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: code,
        window: 2,
      });

      let backupCodeUsed = false;

      if (!verified && twoFactorData.backupCodes) {
        // Try backup code verification
        const decryptedBackupCodes = JSON.parse(
          CryptoJS.AES.decrypt(twoFactorData.backupCodes, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
        );
        
        const newBackupCodes = [];
        for (const hashedCode of decryptedBackupCodes) {
          if (await bcrypt.compare(code.toUpperCase(), hashedCode)) {
            verified = true;
            backupCodeUsed = true;
            // Don't include the used code in the new list
          } else {
            newBackupCodes.push(hashedCode);
          }
        }
        
        if (backupCodeUsed) {
          // Update backup codes (remove the used one)
          const encryptedBackupCodes = CryptoJS.AES.encrypt(
            JSON.stringify(newBackupCodes),
            ENCRYPTION_KEY
          ).toString();
          await storage.setBackupCodes(tempUser.id, encryptedBackupCodes);
        }
      }

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Generate full JWT token
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          walletAddress: user.walletAddress,
          balance: user.balance,
          hasPinSetup: !!user.pin,
        },
      });
    } catch (error) {
      console.error("2FA login verification error:", error);
      res.status(500).json({ message: "Failed to verify 2FA code" });
    }
  });

  // Wallet routes with security
  app.get("/api/wallet/balance", 
    authenticateToken,
    endpointLimiters.balanceCheck,
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.userId);
        if (!user) {
          return res.status(404).json({ 
            error: 'USER_NOT_FOUND',
            message: "User not found" 
          });
        }
        
        // Use Decimal.js for precise balance
        const balance = new Decimal(user.balance || 0).toFixed(8);
        
        res.json({ balance });
      } catch (error: any) {
        logSecurityEvent(req, SecurityEventType.API_ERROR, `Balance fetch error: ${error.message}`);
        res.status(500).json({ 
          error: 'BALANCE_FETCH_FAILED',
          message: "Failed to fetch balance",
          requestId: req.requestId
        });
      }
    }
  );

  // New Blockchain API endpoints for real BSC data
  app.get("/api/wallet", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: "User not found" 
        });
      }

      // If user has a wallet address, fetch real blockchain balance
      if (user.walletAddress && ethers.isAddress(user.walletAddress)) {
        try {
          const balances = await blockchainService.getWalletBalance(user.walletAddress);
          
          // Update user's balance in database with real blockchain data
          await storage.updateUserBalance(req.userId, parseFloat(balances.totalUSD));
          
          res.json({
            address: user.walletAddress,
            bnb: balances.bnb,
            usdt: balances.usdt,
            totalUSD: balances.totalUSD,
            balance: balances.totalUSD // For compatibility
          });
        } catch (blockchainError) {
          console.error("Blockchain fetch error:", blockchainError);
          // Fall back to stored balance if blockchain fetch fails
          res.json({
            address: user.walletAddress,
            balance: user.balance,
            error: "Unable to fetch real-time balance"
          });
        }
      } else {
        // No wallet address, return stored balance
        res.json({
          balance: user.balance,
          message: "No wallet address connected"
        });
      }
    } catch (error: any) {
      logSecurityEvent(req, SecurityEventType.API_ERROR, `Wallet fetch error: ${error.message}`);
      res.status(500).json({ 
        error: 'WALLET_FETCH_FAILED',
        message: "Failed to fetch wallet data",
        requestId: req.requestId
      });
    }
  });

  // Get real blockchain transactions from BSCScan
  app.get("/api/blockchain/transactions", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: "User not found" 
        });
      }

      if (!user.walletAddress || !ethers.isAddress(user.walletAddress)) {
        return res.json([]);
      }

      // Fetch real transactions from BSCScan
      const blockchainTxs = await blockchainService.getAllTransactions(user.walletAddress, 100);
      const formattedTxs = blockchainService.formatTransactionsForDisplay(blockchainTxs, user.walletAddress);
      
      res.json(formattedTxs);
    } catch (error: any) {
      console.error("Blockchain transactions fetch error:", error);
      res.status(500).json({ 
        error: 'TRANSACTIONS_FETCH_FAILED',
        message: "Failed to fetch blockchain transactions",
        requestId: req.requestId
      });
    }
  });

  // Get portfolio metrics calculated from real blockchain data
  app.get("/api/portfolio/metrics", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ 
          error: 'USER_NOT_FOUND',
          message: "User not found" 
        });
      }

      if (!user.walletAddress || !ethers.isAddress(user.walletAddress)) {
        // Return default metrics if no wallet
        return res.json({
          totalTransactions: 0,
          volume24h: "0",
          successRate: 100,
          riskScore: 0,
          lastActivity: null
        });
      }

      // Fetch transactions and calculate real metrics
      const transactions = await blockchainService.getAllTransactions(user.walletAddress, 100);
      const metrics = blockchainService.calculateMetrics(transactions, user.walletAddress);
      
      res.json(metrics);
    } catch (error: any) {
      console.error("Portfolio metrics error:", error);
      res.status(500).json({ 
        error: 'METRICS_FETCH_FAILED',
        message: "Failed to calculate portfolio metrics",
        requestId: req.requestId
      });
    }
  });

  app.post("/api/wallet/update", authenticateToken, async (req: any, res) => {
    try {
      const { walletAddress } = req.body;
      if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address required" });
      }
      
      const user = await storage.updateUserWallet(req.userId, walletAddress);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ walletAddress: user.walletAddress });
    } catch (error) {
      console.error("Wallet update error:", error);
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  // Credentials export/import
  app.get("/api/credentials/export", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        encryptedCredentials: user.encryptedCredentials,
        walletAddress: user.walletAddress,
      });
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export credentials" });
    }
  });

  app.post("/api/credentials/import", authenticateToken, async (req: any, res) => {
    try {
      const { encryptedCredentials } = req.body;
      if (!encryptedCredentials) {
        return res.status(400).json({ message: "Encrypted credentials required" });
      }
      
      const user = await storage.updateUserCredentials(req.userId, encryptedCredentials);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "Credentials imported successfully" });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to import credentials" });
    }
  });

  // Wallet Import/Export routes
  app.post("/api/wallet/import", authenticateToken, async (req: any, res) => {
    try {
      const { privateKey } = req.body;
      
      if (!privateKey) {
        return res.status(400).json({ message: "Private key required" });
      }

      // Validate private key format
      let cleanKey = privateKey.trim();
      if (cleanKey.startsWith('0x')) {
        cleanKey = cleanKey.slice(2);
      }
      
      if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
        return res.status(400).json({ message: "Invalid private key format" });
      }

      // Verify the private key is valid by deriving an address
      try {
        const wallet = new ethers.Wallet('0x' + cleanKey);
        const derivedAddress = wallet.address;
        
        // Encrypt the private key using SESSION_SECRET
        const sessionSecret = process.env.SESSION_SECRET || JWT_SECRET;
        const encryptedPrivateKey = CryptoJS.AES.encrypt(cleanKey, sessionSecret).toString();
        
        // Store encrypted private key
        const user = await storage.updateUserPrivateKey(req.userId, encryptedPrivateKey);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Also update the wallet address to match the imported key
        await storage.updateUserWallet(req.userId, derivedAddress);
        
        res.json({ 
          message: "Private key imported successfully",
          address: derivedAddress
        });
      } catch (error) {
        return res.status(400).json({ message: "Invalid private key" });
      }
    } catch (error) {
      console.error("Import private key error:", error);
      res.status(500).json({ message: "Failed to import private key" });
    }
  });

  // Simple endpoint to check wallet status (no private data)
  app.get("/api/wallet/status", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        hasImportedWallet: !!user.encryptedPrivateKey
      });
    } catch (error) {
      console.error("Get wallet status error:", error);
      res.status(500).json({ message: "Failed to get wallet status" });
    }
  });

  app.get("/api/wallet/imported-address", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.encryptedPrivateKey) {
        return res.status(404).json({ message: "No imported wallet found" });
      }
      
      try {
        // Decrypt the private key
        const sessionSecret = process.env.SESSION_SECRET || JWT_SECRET;
        const decryptedBytes = CryptoJS.AES.decrypt(user.encryptedPrivateKey, sessionSecret);
        const decryptedPrivateKey = decryptedBytes.toString(CryptoJS.enc.Utf8);
        
        // Derive the address
        const wallet = new ethers.Wallet('0x' + decryptedPrivateKey);
        
        res.json({ 
          address: wallet.address,
          hasImportedWallet: true
        });
      } catch (error) {
        console.error("Error deriving address:", error);
        return res.status(500).json({ message: "Failed to derive wallet address" });
      }
    } catch (error) {
      console.error("Get imported address error:", error);
      res.status(500).json({ message: "Failed to get imported address" });
    }
  });

  // New endpoint to get the decrypted private key for frontend wallet creation
  app.get("/api/wallet/imported-key", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.encryptedPrivateKey) {
        return res.status(404).json({ message: "No imported wallet found" });
      }
      
      try {
        // Decrypt the private key
        const sessionSecret = process.env.SESSION_SECRET || JWT_SECRET;
        const decryptedBytes = CryptoJS.AES.decrypt(user.encryptedPrivateKey, sessionSecret);
        const decryptedPrivateKey = decryptedBytes.toString(CryptoJS.enc.Utf8);
        
        // Return the decrypted private key
        // Note: This should only be done over HTTPS in production
        res.json({ 
          privateKey: '0x' + decryptedPrivateKey,
          hasImportedWallet: true
        });
      } catch (error) {
        console.error("Error decrypting private key:", error);
        return res.status(500).json({ message: "Failed to decrypt private key" });
      }
    } catch (error) {
      console.error("Get imported key error:", error);
      res.status(500).json({ message: "Failed to get imported key" });
    }
  });

  app.delete("/api/wallet/imported", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.updateUserPrivateKey(req.userId, null);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "Imported wallet removed successfully" });
    } catch (error) {
      console.error("Delete imported wallet error:", error);
      res.status(500).json({ message: "Failed to remove imported wallet" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", authenticateToken, async (req: any, res) => {
    try {
      console.log('Fetching transactions for userId:', req.userId);
      const transactions = await storage.getTransactions(req.userId);
      console.log(`Found ${transactions.length} transactions for user ${req.userId}`);
      if (transactions.length > 0) {
        console.log('Sample transaction:', JSON.stringify(transactions[0], null, 2));
      }
      res.json(transactions);
    } catch (error) {
      console.error("Fetch transactions error:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions",
    authenticateToken,
    transactionRateLimiter,
    walletOperationLock('transaction'),
    idempotencyCheck(),
    async (req: any, res) => {
      try {
        const transactionData = {
          ...req.body,
          userId: req.userId,
        };
        
        // Validate transaction data
        const result = insertTransactionSchema.safeParse(transactionData);
        if (!result.success) {
          logSecurityEvent(req, SecurityEventType.VALIDATION_ERROR, 'Invalid transaction data');
          return res.status(400).json({ 
            error: 'INVALID_TRANSACTION_DATA',
            message: "Invalid transaction data", 
            errors: result.error.flatten() 
          });
        }
        
        // Get user to check balance
        const user = await storage.getUser(req.userId);
        if (!user) {
          return res.status(404).json({ 
            error: 'USER_NOT_FOUND',
            message: "User not found" 
          });
        }
        
        // For send transactions, validate amount against balance
        if (result.data.type === 'send') {
          const amount = new Decimal(result.data.amount);
          const balance = new Decimal(user.balance);
          
          if (amount.gt(balance)) {
            logSecurityEvent(req, SecurityEventType.TRANSACTION_FAILED, 
              `Insufficient balance. Amount: ${amount.toString()}, Balance: ${balance.toString()}`);
            return res.status(400).json({ 
              error: 'INSUFFICIENT_BALANCE',
              message: "Insufficient balance for transaction" 
            });
          }
          
          // Check transaction limits
          if (amount.lt('0.01') || amount.gt('100000')) {
            return res.status(400).json({ 
              error: 'INVALID_AMOUNT',
              message: "Transaction amount must be between 0.01 and 100000 USDT" 
            });
          }
        }
        
        // Generate unique transaction ID
        const transactionId = generateTransactionId();
        const transactionWithId = { ...result.data, id: transactionId };
        
        // Create transaction
        const transaction = await storage.createTransaction(transactionWithId);
        
        logSecurityEvent(req, SecurityEventType.TRANSACTION_INITIATED, 
          `Transaction created: ${transactionId}, Type: ${result.data.type}, Amount: ${result.data.amount}`);
        
        res.json(transaction);
      } catch (error: any) {
        logSecurityEvent(req, SecurityEventType.TRANSACTION_FAILED, `Transaction error: ${error.message}`);
        res.status(500).json({ 
          error: 'TRANSACTION_FAILED',
          message: "Failed to create transaction",
          requestId: req.requestId
        });
      }
    }
  );

  app.patch("/api/transactions/:id/status", authenticateToken, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status || !["pending", "completed", "failed"].includes(status)) {
        return res.status(400).json({ message: "Valid status required" });
      }
      
      const transaction = await storage.updateTransactionStatus(req.params.id, status);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Update transaction error:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Savings Goals routes
  app.get("/api/savings-goals", authenticateToken, async (req: any, res) => {
    try {
      const goals = await storage.getSavingsGoals(req.userId);
      res.json(goals);
    } catch (error) {
      console.error("Fetch goals error:", error);
      res.status(500).json({ message: "Failed to fetch savings goals" });
    }
  });

  app.post("/api/savings-goals", authenticateToken, async (req: any, res) => {
    try {
      const goalData = {
        ...req.body,
        userId: req.userId,
        deadline: new Date(req.body.deadline),
      };
      
      const result = insertSavingsGoalSchema.safeParse(goalData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid goal data", errors: result.error.flatten() });
      }
      
      // If the goal has an initial deposit amount, validate available balance
      if (result.data.current && parseFloat(result.data.current) > 0) {
        const user = await storage.getUser(req.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Use Decimal.js for precise financial calculations
        const userBalance = new Decimal(user.balance || '0');
        const initialAmount = new Decimal(result.data.current);
        
        // Calculate total funds already locked in existing savings goals
        const existingGoals = await storage.getSavingsGoals(req.userId);
        let totalLockedFunds = new Decimal(0);
        for (const goal of existingGoals) {
          totalLockedFunds = totalLockedFunds.plus(new Decimal(goal.current || '0'));
        }
        
        // Calculate available balance for new goal
        const availableBalance = userBalance.minus(totalLockedFunds);
        
        // Validate sufficient available balance for initial deposit
        if (initialAmount.gt(availableBalance)) {
          return res.status(400).json({ 
            error: 'INSUFFICIENT_BALANCE',
            message: `Insufficient available balance for initial deposit. You have $${availableBalance.toFixed(2)} available (wallet: $${userBalance.toFixed(2)}, locked in other goals: $${totalLockedFunds.toFixed(2)})` 
          });
        }
        
        // Update user balance if there's an initial deposit
        const newUserBalance = userBalance.minus(initialAmount);
        await storage.updateUserBalance(req.userId, parseFloat(newUserBalance.toFixed(8)));
      }
      
      const goal = await storage.createSavingsGoal(result.data);
      res.json(goal);
    } catch (error) {
      console.error("Create goal error:", error);
      res.status(500).json({ message: "Failed to create savings goal" });
    }
  });

  app.patch("/api/savings-goals/:id", authenticateToken, async (req: any, res) => {
    try {
      const updates = req.body;
      if (updates.deadline) {
        updates.deadline = new Date(updates.deadline);
      }
      
      // Get the existing goal first to validate ownership and check balance changes
      const existingGoal = await storage.getSavingsGoal(req.params.id);
      if (!existingGoal || existingGoal.userId !== req.userId) {
        return res.status(404).json({ message: "Goal not found or unauthorized" });
      }
      
      // If updating the current amount, validate available balance
      if (updates.current !== undefined) {
        const user = await storage.getUser(req.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Use Decimal.js for precise financial calculations
        const userBalance = new Decimal(user.balance || '0');
        const newCurrentAmount = new Decimal(updates.current);
        const oldCurrentAmount = new Decimal(existingGoal.current || '0');
        
        // Only check if we're increasing the amount (adding more funds to the goal)
        if (newCurrentAmount.gt(oldCurrentAmount)) {
          const amountToAdd = newCurrentAmount.minus(oldCurrentAmount);
          
          // Calculate total funds locked in other savings goals
          const allUserGoals = await storage.getSavingsGoals(req.userId);
          let totalLockedFunds = new Decimal(0);
          
          // Sum up all current amounts in other goals (excluding this one)
          for (const userGoal of allUserGoals) {
            if (userGoal.id !== req.params.id) {
              totalLockedFunds = totalLockedFunds.plus(new Decimal(userGoal.current || '0'));
            }
          }
          
          // Calculate available balance
          const availableBalance = userBalance.minus(totalLockedFunds);
          
          // Validate sufficient available balance for the increase
          if (amountToAdd.gt(availableBalance)) {
            return res.status(400).json({ 
              error: 'INSUFFICIENT_BALANCE',
              message: `Insufficient available balance to update goal. You need $${amountToAdd.toFixed(2)} but have $${availableBalance.toFixed(2)} available (wallet: $${userBalance.toFixed(2)}, locked in other goals: $${totalLockedFunds.toFixed(2)})` 
            });
          }
          
          // Update user balance for the difference
          const newUserBalance = userBalance.minus(amountToAdd);
          await storage.updateUserBalance(req.userId, parseFloat(newUserBalance.toFixed(8)));
        } else if (newCurrentAmount.lt(oldCurrentAmount)) {
          // If reducing the amount, return the difference to the user's wallet
          const amountToReturn = oldCurrentAmount.minus(newCurrentAmount);
          const newUserBalance = userBalance.plus(amountToReturn);
          await storage.updateUserBalance(req.userId, parseFloat(newUserBalance.toFixed(8)));
        }
        
        // Ensure the updated current amount uses proper precision
        updates.current = newCurrentAmount.toFixed(8);
      }
      
      const goal = await storage.updateSavingsGoal(req.params.id, updates);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Update goal error:", error);
      res.status(500).json({ message: "Failed to update savings goal" });
    }
  });

  app.delete("/api/savings-goals/:id", authenticateToken, async (req: any, res) => {
    try {
      const deleted = await storage.deleteSavingsGoal(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      console.error("Delete goal error:", error);
      res.status(500).json({ message: "Failed to delete savings goal" });
    }
  });

  // Withdrawal from savings goal with protection and history tracking
  app.post("/api/savings-goals/:id/withdraw", authenticateToken, async (req: any, res) => {
    try {
      const { amount, useCoolingPeriod, reason, reasonDetails } = req.body;
      const goalId = req.params.id;
      
      // Get the goal first
      const goal = await storage.getSavingsGoal(goalId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      // Check if user owns the goal
      if (goal.userId !== req.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Check if cooling period is active
      if (goal.withdrawalCooldownUntil && new Date(goal.withdrawalCooldownUntil) > new Date()) {
        return res.status(400).json({ 
          message: "Withdrawal is in cooling period", 
          cooldownUntil: goal.withdrawalCooldownUntil 
        });
      }
      
      // Check if amount is valid
      const currentAmount = parseFloat(goal.current || '0');
      const withdrawAmount = parseFloat(amount);
      const targetAmount = parseFloat(goal.target);
      
      if (withdrawAmount <= 0 || withdrawAmount > currentAmount) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }
      
      // Calculate progress at withdrawal
      const progressAtWithdrawal = (currentAmount / targetAmount) * 100;
      
      // Store withdrawal history for tracking patterns
      const withdrawalHistory = {
        userId: req.userId,
        goalId: goalId,
        goalTitle: goal.title,
        amount: withdrawAmount.toString(),
        reason: reason || 'other',
        reasonDetails: reasonDetails || null,
        usedCoolingPeriod: useCoolingPeriod || false,
        completed: !useCoolingPeriod,
        progressAtWithdrawal: progressAtWithdrawal.toString(),
        savingsStreakLost: goal.savingStreak || '0',
      };
      
      await storage.addWithdrawalHistory(withdrawalHistory);
      
      // Process withdrawal
      const newAmount = currentAmount - withdrawAmount;
      const updates: any = {
        current: newAmount.toString(),
        lastWithdrawal: new Date(),
        savingStreak: '0', // Reset streak on withdrawal
      };
      
      // If cooling period requested, set it
      if (useCoolingPeriod) {
        updates.withdrawalCooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      }
      
      const updatedGoal = await storage.updateSavingsGoal(goalId, updates);
      
      // Update user balance (add withdrawn amount back to main balance)
      const user = await storage.getUser(req.userId);
      if (user) {
        const userBalance = parseFloat(user.balance || '0');
        await storage.updateUserBalance(req.userId, userBalance + withdrawAmount);
      }
      
      res.json({ 
        message: useCoolingPeriod ? "Withdrawal scheduled" : "Withdrawal successful",
        goal: updatedGoal,
        amount: withdrawAmount
      });
    } catch (error) {
      console.error("Withdrawal error:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // Get withdrawal history for user
  app.get("/api/withdrawal-history", authenticateToken, async (req: any, res) => {
    try {
      const history = await storage.getWithdrawalHistory(req.userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching withdrawal history:", error);
      res.status(500).json({ message: "Failed to fetch withdrawal history" });
    }
  });
  
  // Get withdrawal patterns analysis
  app.get("/api/withdrawal-patterns", authenticateToken, async (req: any, res) => {
    try {
      const patterns = await storage.getWithdrawalPatterns(req.userId);
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching withdrawal patterns:", error);
      res.status(500).json({ message: "Failed to fetch withdrawal patterns" });
    }
  });
  
  // Get AI counseling metrics
  app.get("/api/ai/counseling-metrics", authenticateToken, async (req: any, res) => {
    try {
      const metrics = await storage.getCounselingMetrics(req.userId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching counseling metrics:", error);
      res.status(500).json({ message: "Failed to fetch counseling metrics" });
    }
  });
  
  // Record AI conversation outcome
  app.post("/api/ai/conversation-outcome", authenticateToken, async (req: any, res) => {
    try {
      const { outcome, conversationId, reason, timeSpent } = req.body;
      
      // Get the user and update their conversation history
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: "USER_NOT_FOUND", message: "User not found" });
      }
      
      // Find and update the conversation
      const conversations = user.aiConversations || [];
      const conversationIndex = conversations.findIndex((c: any) => c.id === conversationId);
      
      if (conversationIndex === -1) {
        // Create a new conversation entry if not found
        const newConversation = {
          id: conversationId || Math.random().toString(36).substr(2, 9),
          outcome,
          reason,
          timestamp: new Date().toISOString(),
          messages: []
        };
        conversations.push(newConversation);
      } else {
        // Update existing conversation
        conversations[conversationIndex].outcome = outcome;
      }
      
      // Update user with new conversation data
      await storage.updateUser(req.userId, { aiConversations: conversations });
      
      // Add to counseling metrics
      await storage.addCounselingMetric({
        userId: req.userId,
        outcome,
        reason,
        timeSpent: timeSpent || 0,
        conversationId: conversationId || Math.random().toString(36).substr(2, 9)
      });
      
      console.log(`[SECURITY] ${req.sessionID}: AI conversation outcome: ${outcome} {
  userId: '${req.userId}',
  ip: '${req.ip}',
  endpoint: '/api/ai/conversation-outcome'
}`);
      
      res.json({ 
        success: true, 
        message: `Outcome recorded: ${outcome}`,
        conversationId: conversationId || conversations[conversations.length - 1].id
      });
    } catch (error) {
      console.error("Error recording conversation outcome:", error);
      res.status(500).json({ message: "Failed to record conversation outcome" });
    }
  });

  // AI-powered withdrawal counseling endpoint
  app.post("/api/ai/withdrawal-counseling", authenticateToken, async (req: any, res) => {
    try {
      const { 
        reason, 
        goalDetails, 
        withdrawalHistory, 
        conversationHistory,
        conversationId 
      } = req.body;

      // Validate required fields
      if (!reason || !goalDetails) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Reason and goal details are required'
        });
      }

      // Get user for context
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      // Build context for AI counseling
      const context = {
        userId: req.userId,
        reason,
        goalDetails: {
          title: goalDetails.title,
          current: parseFloat(goalDetails.current || '0'),
          target: parseFloat(goalDetails.target || '0'),
          progress: parseFloat(goalDetails.progress || '0'),
          deadline: goalDetails.deadline ? new Date(goalDetails.deadline) : null,
          savingStreak: parseInt(goalDetails.savingStreak || '0')
        },
        withdrawalHistory: withdrawalHistory || [],
        conversationHistory: conversationHistory || []
      };

      // Generate AI response
      const counselingResponse = await aiCounselingService.generateCounselingResponse(context);

      // Track usage for analytics
      await aiCounselingService.trackUsage(req.userId, reason);

      // Prepare conversation for storage
      const newMessage = {
        role: 'assistant' as const,
        content: counselingResponse.message
      };

      // Update conversation history in database if conversationId is provided
      if (conversationId) {
        // Find existing conversation
        const conversations = user.aiConversations || [];
        const existingConvIndex = conversations.findIndex(
          (conv: any) => conv.timestamp.toISOString() === conversationId
        );

        if (existingConvIndex !== -1) {
          // Update existing conversation
          conversations[existingConvIndex].messages.push(newMessage);
          
          // Update user with new conversation history
          await storage.updateUser(req.userId, {
            aiConversations: conversations
          });
        }
      } else {
        // Create new conversation entry
        const newConversation = {
          timestamp: new Date(),
          goalId: goalDetails.id || 'unknown',
          reason,
          messages: [newMessage],
          outcome: 'ongoing' as const,
          savingsAmount: context.goalDetails.current,
          progress: context.goalDetails.progress
        };

        // Add to user's conversation history
        const conversations = user.aiConversations || [];
        conversations.push(newConversation);
        
        // Update user with new conversation
        await storage.updateUser(req.userId, {
          aiConversations: conversations
        });
      }

      // Return the counseling response
      res.json({
        message: counselingResponse.message,
        suggestedActions: counselingResponse.suggestedActions,
        resources: counselingResponse.resources,
        sentiment: counselingResponse.sentiment,
        shouldShowWarning: counselingResponse.shouldShowWarning,
        conversationId: conversationId || new Date().toISOString()
      });

      logSecurityEvent(req, SecurityEventType.API_ACCESS, `AI counseling accessed for reason: ${reason}`);
    } catch (error: any) {
      console.error("AI counseling error:", error);
      logSecurityEvent(req, SecurityEventType.API_ERROR, `AI counseling error: ${error.message}`);
      
      // Return fallback response on error
      const { withdrawalGuidance } = require('./data/withdrawalGuidance');
      const fallback = withdrawalGuidance.getFallbackResponse(
        req.body.reason || 'other',
        parseFloat(req.body.goalDetails?.progress || '0')
      );
      
      res.json({
        message: fallback.message,
        suggestedActions: fallback.suggestions,
        resources: fallback.resources,
        sentiment: fallback.sentiment,
        shouldShowWarning: fallback.showWarning,
        isFallback: true
      });
    }
  });

  // Update AI conversation outcome (when user makes final decision)
  app.post("/api/ai/conversation-outcome", authenticateToken, async (req: any, res) => {
    try {
      const { conversationId, outcome } = req.body;

      if (!conversationId || !outcome) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Conversation ID and outcome are required'
        });
      }

      if (!['withdrew', 'kept'].includes(outcome)) {
        return res.status(400).json({
          error: 'INVALID_OUTCOME',
          message: 'Outcome must be "withdrew" or "kept"'
        });
      }

      // Get user
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      // Find and update the conversation
      const conversations = user.aiConversations || [];
      const convIndex = conversations.findIndex(
        (conv: any) => conv.timestamp.toISOString() === conversationId
      );

      if (convIndex !== -1) {
        conversations[convIndex].outcome = outcome;
        
        // Update user with updated conversation
        await storage.updateUser(req.userId, {
          aiConversations: conversations
        });

        res.json({ message: 'Conversation outcome updated successfully' });
      } else {
        res.status(404).json({
          error: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found'
        });
      }

      logSecurityEvent(req, SecurityEventType.API_ACCESS, `AI conversation outcome: ${outcome}`);
    } catch (error: any) {
      console.error("Conversation outcome update error:", error);
      logSecurityEvent(req, SecurityEventType.API_ERROR, `Conversation outcome error: ${error.message}`);
      res.status(500).json({
        error: 'UPDATE_FAILED',
        message: 'Failed to update conversation outcome'
      });
    }
  });
  
  // Deposit funds to savings goal
  app.post("/api/savings-goals/:id/deposit",
    authenticateToken,
    validate(depositSavingsGoalSchema),
    async (req: any, res) => {
      try {
        const { amount } = req.body;
        const goalId = req.params.id;
        
        // Get the goal first
        const goal = await storage.getSavingsGoal(goalId);
        if (!goal) {
          return res.status(404).json({ 
            error: 'GOAL_NOT_FOUND',
            message: "Savings goal not found" 
          });
        }
        
        // Check if user owns the goal
        if (goal.userId !== req.userId) {
          logSecurityEvent(req, SecurityEventType.UNAUTHORIZED_ACCESS, `User ${req.userId} attempted to deposit to goal ${goalId} owned by ${goal.userId}`);
          return res.status(403).json({ 
            error: 'UNAUTHORIZED',
            message: "You don't have permission to deposit to this goal" 
          });
        }
        
        // Get user balance
        const user = await storage.getUser(req.userId);
        if (!user) {
          return res.status(404).json({ 
            error: 'USER_NOT_FOUND',
            message: "User not found" 
          });
        }
        
        // Use Decimal.js for precise financial calculations
        const userBalance = new Decimal(user.balance || '0');
        const depositAmount = new Decimal(amount);
        
        // Validate amount is positive
        if (depositAmount.isNaN() || depositAmount.lte(0)) {
          return res.status(400).json({ 
            error: 'INVALID_AMOUNT',
            message: "Deposit amount must be positive" 
          });
        }
        
        // Calculate total funds locked in all savings goals
        // This prevents users from over-committing their balance across multiple goals
        const allUserGoals = await storage.getSavingsGoals(req.userId);
        let totalLockedFunds = new Decimal(0);
        
        // Sum up all current amounts in savings goals (excluding the current goal to avoid double-counting)
        for (const userGoal of allUserGoals) {
          if (userGoal.id !== goalId) {
            totalLockedFunds = totalLockedFunds.plus(new Decimal(userGoal.current || '0'));
          }
        }
        
        // Calculate the actual available balance
        // Available = Wallet Balance - Total Locked in Other Goals
        const availableBalance = userBalance.minus(totalLockedFunds);
        
        // Validate sufficient available balance
        if (depositAmount.gt(availableBalance)) {
          return res.status(400).json({ 
            error: 'INSUFFICIENT_BALANCE',
            message: `Insufficient available balance. You have $${availableBalance.toFixed(2)} available (wallet: $${userBalance.toFixed(2)}, locked in other goals: $${totalLockedFunds.toFixed(2)})` 
          });
        }
        
        // Calculate new amounts using Decimal.js for precision
        const currentGoalAmount = new Decimal(goal.current || '0');
        const targetAmount = new Decimal(goal.target);
        const newGoalAmount = currentGoalAmount.plus(depositAmount);
        const newUserBalance = userBalance.minus(depositAmount);
        
        // Don't allow deposits that exceed the target
        if (newGoalAmount.gt(targetAmount)) {
          const maxDeposit = targetAmount.minus(currentGoalAmount);
          return res.status(400).json({ 
            error: 'EXCEEDS_TARGET',
            message: `Maximum deposit for this goal is $${maxDeposit.toFixed(2)}` 
          });
        }
        
        // Update goal balance
        const updatedGoal = await storage.updateSavingsGoal(goalId, {
          current: newGoalAmount.toFixed(8), // Use 8 decimal places for USDT precision
          savingStreak: (parseInt(goal.savingStreak || '0') + 1).toString() // Increment saving streak
        });
        
        // Update user balance
        await storage.updateUserBalance(req.userId, parseFloat(newUserBalance.toFixed(8)));
        
        // Create transaction record
        await storage.createTransaction({
          userId: req.userId,
          type: 'send',
          amount: depositAmount.toFixed(8),
          currency: 'USDT',
          status: 'completed',
          destinationAddress: `goal:${goalId}`, // Special address format for goal deposits
        });
        
        logSecurityEvent(req, SecurityEventType.TRANSACTION_COMPLETED, `User ${req.userId} deposited $${depositAmount.toFixed(2)} to goal ${goalId}`);
        
        res.json({ 
          message: "Deposit successful",
          goal: updatedGoal,
          newBalance: newUserBalance.toFixed(2),
          amount: parseFloat(depositAmount.toFixed(8))
        });
      } catch (error: any) {
        console.error("Deposit error:", error);
        logSecurityEvent(req, SecurityEventType.API_ERROR, `Deposit error for user ${req.userId}: ${error.message}`);
        res.status(500).json({ 
          error: 'DEPOSIT_FAILED',
          message: "Failed to process deposit" 
        });
      }
    }
  );

  // Investment Plans routes
  app.get("/api/investment-plans", authenticateToken, async (req: any, res) => {
    try {
      const plans = await storage.getInvestmentPlans(req.userId);
      res.json(plans);
    } catch (error) {
      console.error("Fetch plans error:", error);
      res.status(500).json({ message: "Failed to fetch investment plans" });
    }
  });

  app.post("/api/investment-plans", authenticateToken, async (req: any, res) => {
    try {
      const planData = {
        ...req.body,
        userId: req.userId,
        nextContribution: new Date(req.body.nextContribution),
      };
      
      const result = insertInvestmentPlanSchema.safeParse(planData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid plan data", errors: result.error.flatten() });
      }
      
      const plan = await storage.createInvestmentPlan(result.data);
      res.json(plan);
    } catch (error) {
      console.error("Create plan error:", error);
      res.status(500).json({ message: "Failed to create investment plan" });
    }
  });

  app.patch("/api/investment-plans/:id", authenticateToken, async (req: any, res) => {
    try {
      const updates = req.body;
      if (updates.nextContribution) {
        updates.nextContribution = new Date(updates.nextContribution);
      }
      
      const plan = await storage.updateInvestmentPlan(req.params.id, updates);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Update plan error:", error);
      res.status(500).json({ message: "Failed to update investment plan" });
    }
  });

  app.delete("/api/investment-plans/:id", authenticateToken, async (req: any, res) => {
    try {
      const deleted = await storage.deleteInvestmentPlan(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Plan not found" });
      }
      
      res.json({ message: "Plan deleted successfully" });
    } catch (error) {
      console.error("Delete plan error:", error);
      res.status(500).json({ message: "Failed to delete investment plan" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}