import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { insertTransactionSchema, insertSavingsGoalSchema, insertInvestmentPlanSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Middleware to verify JWT token
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.userId = user.id;
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({ username, password });
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token,
        user: {
          id: user.id,
          username: user.username,
          walletAddress: user.walletAddress,
          balance: user.balance,
          hasPinSetup: !!user.pin,
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if 2FA is enabled
      if (user.twoFactorEnabled) {
        // Create temporary token for 2FA verification (5 minute expiry)
        const tempToken = jwt.sign(
          { id: user.id, username: user.username, temp: true },
          JWT_SECRET,
          { expiresIn: '5m' }
        );
        
        return res.json({
          requires2FA: true,
          tempToken,
        });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token,
        user: {
          id: user.id,
          username: user.username,
          walletAddress: user.walletAddress,
          balance: user.balance,
          hasPinSetup: !!user.pin,
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

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

  // Wallet routes
  app.get("/api/wallet/balance", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ balance: user.balance });
    } catch (error) {
      console.error("Balance fetch error:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
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

  app.post("/api/transactions", authenticateToken, async (req: any, res) => {
    try {
      const transactionData = {
        ...req.body,
        userId: req.userId,
      };
      
      const result = insertTransactionSchema.safeParse(transactionData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid transaction data", errors: result.error.flatten() });
      }
      
      const transaction = await storage.createTransaction(result.data);
      res.json(transaction);
    } catch (error) {
      console.error("Create transaction error:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

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