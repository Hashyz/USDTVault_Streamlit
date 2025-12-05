import { type User, type InsertUser, type Transaction, type InsertTransaction, type SavingsGoal, type InsertSavingsGoal, type InvestmentPlan, type InsertInvestmentPlan } from "@shared/schema";
import bcrypt from 'bcryptjs';
import { connectDB } from './db';
import { UserModel, IUser } from './models/User';
import { TransactionModel, ITransaction } from './models/Transaction';
import { SavingsGoalModel, ISavingsGoal } from './models/SavingsGoal';
import { InvestmentPlanModel, IInvestmentPlan } from './models/InvestmentPlan';

// Helper function to convert Mongoose document to plain object
function toPlainUser(doc: IUser | null): User | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id.toString(),
    username: doc.username,
    password: doc.password,
    walletAddress: doc.walletAddress,
    balance: doc.balance,
    encryptedCredentials: doc.encryptedCredentials,
    encryptedPrivateKey: doc.encryptedPrivateKey,
    pin: doc.pin,
    pinAttempts: doc.pinAttempts ? doc.pinAttempts.toString() : "0",
    pinLockoutUntil: doc.pinLockoutUntil,
    twoFactorSecret: doc.twoFactorSecret,
    twoFactorEnabled: doc.twoFactorEnabled,
    backupCodes: doc.backupCodes,
    createdAt: doc.createdAt,
  };
}

function toPlainTransaction(doc: ITransaction | null): Transaction | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    type: doc.type,
    amount: doc.amount,
    currency: "USDT",
    destinationAddress: doc.type === 'send' ? doc.address : undefined,
    sourceAddress: doc.type === 'receive' ? doc.address : undefined,
    transactionHash: undefined,
    blockNumber: undefined,
    gasUsed: undefined,
    effectiveGasPrice: undefined,
    status: doc.status as "pending" | "completed" | "failed" | "success",
    createdAt: doc.createdAt,
  };
}

function toPlainSavingsGoal(doc: ISavingsGoal | null): SavingsGoal | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    current: doc.current,
    target: doc.target,
    deadline: doc.deadline,
    autoSaveEnabled: doc.autoSaveEnabled,
    autoSaveAmount: doc.autoSaveAmount,
    autoSaveFrequency: doc.autoSaveFrequency,
    nextAutoSave: doc.nextAutoSave,
    lastWithdrawal: doc.lastWithdrawal,
    savingStreak: doc.savingStreak,
    withdrawalCooldownUntil: doc.withdrawalCooldownUntil,
    createdAt: doc.createdAt,
  };
}

function toPlainInvestmentPlan(doc: IInvestmentPlan | null): InvestmentPlan | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    name: doc.name,
    amount: doc.amount,
    frequency: doc.frequency,
    nextContribution: doc.nextContribution,
    autoInvest: doc.autoInvest,
    createdAt: doc.createdAt,
  };
}

// Extended storage interface for the wallet application
export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: string, balance: number): Promise<User | undefined>;
  updateUserWallet(userId: string, walletAddress: string): Promise<User | undefined>;
  updateUserCredentials(userId: string, encryptedCredentials: string): Promise<User | undefined>;
  updateUserPrivateKey(userId: string, encryptedPrivateKey: string | null): Promise<User | undefined>;
  updateUserPin(userId: string, hashedPin: string | null): Promise<User | undefined>;
  updatePinAttempts(userId: string, attempts: number): Promise<User | undefined>;
  updatePinLockout(userId: string, lockoutUntil: Date | null): Promise<User | undefined>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  
  // 2FA methods
  setTwoFactorSecret(userId: string, encryptedSecret: string | null): Promise<User | undefined>;
  enableTwoFactor(userId: string, enable: boolean): Promise<User | undefined>;
  setBackupCodes(userId: string, encryptedBackupCodes: string | null): Promise<User | undefined>;
  getTwoFactorData(userId: string): Promise<{ secret: string | null; enabled: boolean; backupCodes: string | null } | undefined>;
  
  // Transaction methods
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: "pending" | "completed" | "failed"): Promise<Transaction | undefined>;
  
  // Savings Goals methods
  getSavingsGoals(userId: string): Promise<SavingsGoal[]>;
  getSavingsGoal(id: string): Promise<SavingsGoal | undefined>;
  createSavingsGoal(goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal | undefined>;
  deleteSavingsGoal(id: string): Promise<boolean>;
  
  // Investment Plans methods
  getInvestmentPlans(userId: string): Promise<InvestmentPlan[]>;
  getInvestmentPlan(id: string): Promise<InvestmentPlan | undefined>;
  createInvestmentPlan(plan: InsertInvestmentPlan): Promise<InvestmentPlan>;
  updateInvestmentPlan(id: string, updates: Partial<InvestmentPlan>): Promise<InvestmentPlan | undefined>;
  deleteInvestmentPlan(id: string): Promise<boolean>;
  
  // Withdrawal & Deletion History methods
  addWithdrawalHistory(history: any): Promise<any>;
  getWithdrawalHistory(userId: string): Promise<any[]>;
  addDeletionHistory(history: any): Promise<any>;
  getDeletionHistory(userId: string): Promise<any[]>;
  getWithdrawalPatterns(userId: string): Promise<any>;
}

export class MongoStorage implements IStorage {
  private initialized = false;

  private async ensureConnection() {
    if (!this.initialized) {
      await connectDB();
      await this.initializeDemoData();
      this.initialized = true;
    }
  }

  private async initializeDemoData() {
    try {
      // Check if demo user already exists
      const existingUser = await UserModel.findOne({ username: 'demo' });
      if (existingUser) {
        console.log('Demo user already exists');
        // Update the password, PIN, and wallet address for the demo user
        const hashedPassword = await bcrypt.hash("demo1234", 10);
        const hashedPin = await bcrypt.hash("123456", 10);
        existingUser.password = hashedPassword;
        // Update to user's real wallet address for testing
        existingUser.walletAddress = '0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318';
        existingUser.balance = '10.00'; // Will be updated with real blockchain balance
        existingUser.pin = hashedPin; // Ensure demo account has PIN
        existingUser.pinAttempts = 0;
        existingUser.pinLockoutUntil = null;
        await existingUser.save();
        console.log('Demo user updated with real wallet address: 0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318');
        
        // Create or update demo savings goals
        const demoGoals = [
          {
            userId: existingUser._id.toString(),
            title: "Emergency Fund",
            current: 3.00,
            target: 5.00,
            deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            autoSaveEnabled: true,
            autoSaveAmount: 0.50,
            autoSaveFrequency: "weekly",
            savingStreak: 7,
            lastDepositDate: new Date().toISOString(),
            withdrawalCount: 0,
            protectionEnabled: true,
          },
          {
            userId: existingUser._id.toString(),
            title: "Vacation Fund",
            current: 2.00,
            target: 10.00,
            deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            autoSaveEnabled: false,
            autoSaveAmount: 0,
            autoSaveFrequency: "monthly",
            savingStreak: 3,
            lastDepositDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            withdrawalCount: 0,
            protectionEnabled: true,
          },
          {
            userId: existingUser._id.toString(),
            title: "Investment Goal",
            current: 1.00,
            target: 20.00,
            deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            autoSaveEnabled: true,
            autoSaveAmount: 1.00,
            autoSaveFrequency: "daily",
            savingStreak: 14,
            lastDepositDate: new Date().toISOString(),
            withdrawalCount: 0,
            protectionEnabled: true,
          }
        ];
        
        // Clear existing demo goals and create new ones
        await SavingsGoalModel.deleteMany({ userId: existingUser._id.toString() });
        for (const goal of demoGoals) {
          await SavingsGoalModel.create(goal);
        }
        console.log('Demo savings goals created/updated successfully');
        return;
      }

      // Create demo user with real wallet address
      const hashedPassword = await bcrypt.hash("demo1234", 10);
      const hashedPin = await bcrypt.hash("123456", 10); // Set a demo PIN
      const demoUser = new UserModel({
        username: 'demo',
        password: hashedPassword,
        walletAddress: '0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318', // User's real wallet
        balance: '10.00', // Will be updated with real blockchain balance
        encryptedCredentials: null,
        pin: hashedPin, // Add demo PIN
        pinAttempts: 0,
        pinLockoutUntil: null,
        twoFactorEnabled: false, // 2FA disabled for demo
        twoFactorSecret: null,
        backupCodes: null,
      });
      
      await demoUser.save();
      console.log('Demo user created with real wallet address: 0xe5e7F409E2627FDF3EeeE6a9CB5A042ebdA19318');
      
      // Create demo savings goals for testing
      const demoGoals = [
        {
          userId: demoUser._id.toString(),
          title: "Emergency Fund",
          current: 3.00,
          target: 5.00,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          autoSaveEnabled: true,
          autoSaveAmount: 0.50,
          autoSaveFrequency: "Weekly",
          savingStreak: 7,
          lastDepositDate: new Date().toISOString(),
          withdrawalCount: 0,
          protectionEnabled: true,
        },
        {
          userId: demoUser._id.toString(),
          title: "Vacation Fund",
          current: 2.00,
          target: 10.00,
          deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          autoSaveEnabled: false,
          autoSaveAmount: 0,
          autoSaveFrequency: "Monthly",
          savingStreak: 3,
          lastDepositDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          withdrawalCount: 0,
          protectionEnabled: true,
        },
        {
          userId: demoUser._id.toString(),
          title: "Investment Goal",
          current: 1.00,
          target: 20.00,
          deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          autoSaveEnabled: true,
          autoSaveAmount: 1.00,
          autoSaveFrequency: "Daily",
          savingStreak: 14,
          lastDepositDate: new Date().toISOString(),
          withdrawalCount: 0,
          protectionEnabled: true,
        }
      ];
      
      // Create demo savings goals
      for (const goal of demoGoals) {
        await SavingsGoalModel.create(goal);
      }
      console.log('Demo savings goals created successfully');
    } catch (error) {
      console.error('Error initializing demo data:', error);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      // Check if the ID is a valid MongoDB ObjectId
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        // If not, it might be an old UUID from the in-memory storage
        // Try to find by a different field or return undefined
        return undefined;
      }
      const user = await UserModel.findById(id);
      return toPlainUser(user);
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findOne({ username: username.toLowerCase() });
      return toPlainUser(user);
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ensureConnection();
    try {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      const walletAddress = `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}`;
      
      const user = new UserModel({
        username: insertUser.username.toLowerCase(),
        password: hashedPassword,
        walletAddress,
        balance: '0',
        encryptedCredentials: null,
      });
      
      const savedUser = await user.save();
      return toPlainUser(savedUser)!;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUserBalance(userId: string, balance: number): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { balance: balance.toString() },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user balance:', error);
      return undefined;
    }
  }

  async updateUserWallet(userId: string, walletAddress: string): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { walletAddress },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user wallet:', error);
      return undefined;
    }
  }

  async updateUserCredentials(userId: string, encryptedCredentials: string): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { encryptedCredentials },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user credentials:', error);
      return undefined;
    }
  }

  async updateUserPrivateKey(userId: string, encryptedPrivateKey: string | null): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { encryptedPrivateKey },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user private key:', error);
      return undefined;
    }
  }

  async updateUserPin(userId: string, hashedPin: string | null): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { pin: hashedPin, pinAttempts: 0, pinLockoutUntil: null },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user PIN:', error);
      return undefined;
    }
  }

  async updatePinAttempts(userId: string, attempts: number): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { pinAttempts: attempts },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating PIN attempts:', error);
      return undefined;
    }
  }

  async updatePinLockout(userId: string, lockoutUntil: Date | null): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { pinLockoutUntil: lockoutUntil },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating PIN lockout:', error);
      return undefined;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      // Remove non-updatable fields
      const { id, username, createdAt, ...updateData } = updates as any;
      
      const user = await UserModel.findByIdAndUpdate(
        userId,
        updateData,
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  // 2FA methods
  async setTwoFactorSecret(userId: string, encryptedSecret: string | null): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { twoFactorSecret: encryptedSecret },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error setting 2FA secret:', error);
      return undefined;
    }
  }

  async enableTwoFactor(userId: string, enable: boolean): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { twoFactorEnabled: enable },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error enabling/disabling 2FA:', error);
      return undefined;
    }
  }

  async setBackupCodes(userId: string, encryptedBackupCodes: string | null): Promise<User | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { backupCodes: encryptedBackupCodes },
        { new: true }
      );
      return toPlainUser(user);
    } catch (error) {
      console.error('Error setting backup codes:', error);
      return undefined;
    }
  }

  async getTwoFactorData(userId: string): Promise<{ secret: string | null; enabled: boolean; backupCodes: string | null } | undefined> {
    await this.ensureConnection();
    try {
      const user = await UserModel.findById(userId);
      if (!user) return undefined;
      
      return {
        secret: user.twoFactorSecret,
        enabled: user.twoFactorEnabled,
        backupCodes: user.backupCodes,
      };
    } catch (error) {
      console.error('Error getting 2FA data:', error);
      return undefined;
    }
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<Transaction[]> {
    await this.ensureConnection();
    try {
      const transactions = await TransactionModel
        .find({ userId })
        .sort({ createdAt: -1 });
      return transactions.map(tx => toPlainTransaction(tx)!);
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    await this.ensureConnection();
    try {
      // Check if the ID is a valid MongoDB ObjectId
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      const transaction = await TransactionModel.findById(id);
      return toPlainTransaction(transaction);
    } catch (error) {
      console.error('Error getting transaction:', error);
      return undefined;
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    await this.ensureConnection();
    try {
      console.log('Creating transaction with data:', JSON.stringify(insertTransaction, null, 2));
      
      // Map the insertTransaction fields to match the MongoDB model
      const transactionData = {
        userId: insertTransaction.userId,
        type: insertTransaction.type,
        amount: insertTransaction.amount,
        address: insertTransaction.type === 'send' 
          ? insertTransaction.destinationAddress 
          : insertTransaction.sourceAddress || insertTransaction.destinationAddress,
        status: insertTransaction.status,
      };
      
      console.log('Mapped to MongoDB model:', JSON.stringify(transactionData, null, 2));
      
      const transaction = new TransactionModel(transactionData);
      const savedTransaction = await transaction.save();
      console.log('Transaction saved to MongoDB with ID:', savedTransaction._id.toString());
      
      // Update user balance if transaction is completed
      if (savedTransaction.status === 'completed') {
        const user = await UserModel.findById(savedTransaction.userId);
        if (user) {
          const currentBalance = parseFloat(user.balance);
          const amount = parseFloat(savedTransaction.amount);
          const newBalance = savedTransaction.type === 'receive' 
            ? currentBalance + amount 
            : currentBalance - amount;
          await this.updateUserBalance(savedTransaction.userId, newBalance);
        }
      }
      
      return toPlainTransaction(savedTransaction)!;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }
  }

  async updateTransactionStatus(id: string, status: "pending" | "completed" | "failed"): Promise<Transaction | undefined> {
    await this.ensureConnection();
    try {
      // Check if the ID is a valid MongoDB ObjectId
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      const transaction = await TransactionModel.findById(id);
      if (!transaction) return undefined;
      
      const oldStatus = transaction.status;
      transaction.status = status;
      await transaction.save();
      
      // Update balance if status changed to completed
      if (oldStatus !== 'completed' && status === 'completed') {
        const user = await UserModel.findById(transaction.userId);
        if (user) {
          const currentBalance = parseFloat(user.balance);
          const amount = parseFloat(transaction.amount);
          const newBalance = transaction.type === 'receive' 
            ? currentBalance + amount 
            : currentBalance - amount;
          await this.updateUserBalance(transaction.userId, newBalance);
        }
      }
      
      return toPlainTransaction(transaction);
    } catch (error) {
      console.error('Error updating transaction status:', error);
      return undefined;
    }
  }

  // Savings Goals methods
  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    await this.ensureConnection();
    try {
      const goals = await SavingsGoalModel
        .find({ userId })
        .sort({ deadline: 1 });
      return goals.map(goal => toPlainSavingsGoal(goal)!);
    } catch (error) {
      console.error('Error getting savings goals:', error);
      return [];
    }
  }

  async getSavingsGoal(id: string): Promise<SavingsGoal | undefined> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      const goal = await SavingsGoalModel.findById(id);
      return toPlainSavingsGoal(goal);
    } catch (error) {
      console.error('Error getting savings goal:', error);
      return undefined;
    }
  }

  async createSavingsGoal(insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    await this.ensureConnection();
    try {
      const goal = new SavingsGoalModel({
        ...insertGoal,
        current: '0',
      });
      const savedGoal = await goal.save();
      return toPlainSavingsGoal(savedGoal)!;
    } catch (error) {
      console.error('Error creating savings goal:', error);
      throw new Error('Failed to create savings goal');
    }
  }

  async updateSavingsGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal | undefined> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      // Remove id from updates if present
      const { id: _, ...updateData } = updates;
      const goal = await SavingsGoalModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      return toPlainSavingsGoal(goal);
    } catch (error) {
      console.error('Error updating savings goal:', error);
      return undefined;
    }
  }

  async deleteSavingsGoal(id: string): Promise<boolean> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return false;
      }
      const result = await SavingsGoalModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      return false;
    }
  }

  // Investment Plans methods
  async getInvestmentPlans(userId: string): Promise<InvestmentPlan[]> {
    await this.ensureConnection();
    try {
      const plans = await InvestmentPlanModel
        .find({ userId })
        .sort({ nextContribution: 1 });
      return plans.map(plan => toPlainInvestmentPlan(plan)!);
    } catch (error) {
      console.error('Error getting investment plans:', error);
      return [];
    }
  }

  async getInvestmentPlan(id: string): Promise<InvestmentPlan | undefined> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      const plan = await InvestmentPlanModel.findById(id);
      return toPlainInvestmentPlan(plan);
    } catch (error) {
      console.error('Error getting investment plan:', error);
      return undefined;
    }
  }

  async createInvestmentPlan(insertPlan: InsertInvestmentPlan): Promise<InvestmentPlan> {
    await this.ensureConnection();
    try {
      const plan = new InvestmentPlanModel(insertPlan);
      const savedPlan = await plan.save();
      return toPlainInvestmentPlan(savedPlan)!;
    } catch (error) {
      console.error('Error creating investment plan:', error);
      throw new Error('Failed to create investment plan');
    }
  }

  async updateInvestmentPlan(id: string, updates: Partial<InvestmentPlan>): Promise<InvestmentPlan | undefined> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return undefined;
      }
      // Remove id from updates if present
      const { id: _, ...updateData } = updates;
      const plan = await InvestmentPlanModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      return toPlainInvestmentPlan(plan);
    } catch (error) {
      console.error('Error updating investment plan:', error);
      return undefined;
    }
  }

  async deleteInvestmentPlan(id: string): Promise<boolean> {
    await this.ensureConnection();
    try {
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return false;
      }
      const result = await InvestmentPlanModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Error deleting investment plan:', error);
      return false;
    }
  }
  
  // Withdrawal History methods - using in-memory storage for now
  private withdrawalHistory: any[] = [];
  private deletionHistory: any[] = [];
  private counselingMetrics: any[] = [];
  
  async addWithdrawalHistory(history: any): Promise<any> {
    const entry = {
      ...history,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date()
    };
    this.withdrawalHistory.push(entry);
    return entry;
  }
  
  async getWithdrawalHistory(userId: string): Promise<any[]> {
    return this.withdrawalHistory.filter(h => h.userId === userId);
  }
  
  async addDeletionHistory(history: any): Promise<any> {
    const entry = {
      ...history,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date()
    };
    this.deletionHistory.push(entry);
    return entry;
  }
  
  async getDeletionHistory(userId: string): Promise<any[]> {
    return this.deletionHistory.filter(h => h.userId === userId);
  }
  
  async addCounselingMetric(metric: any): Promise<any> {
    const entry = {
      ...metric,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date()
    };
    this.counselingMetrics.push(entry);
    return entry;
  }
  
  async getCounselingMetrics(userId: string): Promise<any> {
    const userMetrics = this.counselingMetrics.filter(m => m.userId === userId);
    const userHistory = this.withdrawalHistory.filter(h => h.userId === userId);
    const user = await this.getUser(userId);
    const conversations = user?.aiConversations || [];
    
    // Calculate metrics
    let totalSessions = conversations.length;
    let successfulDissuasions = conversations.filter((c: any) => c.outcome === 'kept').length;
    let totalWithdrawals = conversations.filter((c: any) => c.outcome === 'withdrew').length;
    let averageTimeSpent = 0;
    let totalMessageCount = 0;
    
    conversations.forEach((conv: any) => {
      if (conv.messages) {
        totalMessageCount += conv.messages.length;
      }
    });
    
    // Calculate average time spent from metrics
    const sessionTimes = userMetrics.filter(m => m.timeSpent).map(m => m.timeSpent);
    if (sessionTimes.length > 0) {
      averageTimeSpent = sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length;
    }
    
    // Success rate by reason
    const successByReason: Record<string, { total: number; kept: number; rate: number }> = {};
    conversations.forEach((conv: any) => {
      if (conv.reason) {
        if (!successByReason[conv.reason]) {
          successByReason[conv.reason] = { total: 0, kept: 0, rate: 0 };
        }
        successByReason[conv.reason].total++;
        if (conv.outcome === 'kept') {
          successByReason[conv.reason].kept++;
        }
      }
    });
    
    // Calculate success rates
    Object.keys(successByReason).forEach(reason => {
      const data = successByReason[reason];
      data.rate = data.total > 0 ? (data.kept / data.total) * 100 : 0;
    });
    
    // Daily metrics for chart
    const dailyMetrics: Record<string, { date: string; sessions: number; kept: number; withdrew: number }> = {};
    conversations.forEach((conv: any) => {
      const date = new Date(conv.timestamp).toISOString().split('T')[0];
      if (!dailyMetrics[date]) {
        dailyMetrics[date] = { date, sessions: 0, kept: 0, withdrew: 0 };
      }
      dailyMetrics[date].sessions++;
      if (conv.outcome === 'kept') {
        dailyMetrics[date].kept++;
      } else if (conv.outcome === 'withdrew') {
        dailyMetrics[date].withdrew++;
      }
    });
    
    const overallSuccessRate = totalSessions > 0 ? (successfulDissuasions / totalSessions) * 100 : 0;
    
    return {
      totalSessions,
      successfulDissuasions,
      totalWithdrawals,
      overallSuccessRate,
      averageTimeSpent,
      averageMessagesPerSession: totalSessions > 0 ? totalMessageCount / totalSessions : 0,
      successByReason,
      dailyMetrics: Object.values(dailyMetrics).sort((a, b) => a.date.localeCompare(b.date)),
      mostEffectiveForReason: Object.entries(successByReason)
        .sort((a, b) => b[1].rate - a[1].rate)[0]?.[0] || null
    };
  }
  
  async getWithdrawalPatterns(userId: string): Promise<any> {
    const userHistory = this.withdrawalHistory.filter(h => h.userId === userId);
    const user = await this.getUser(userId);
    const conversations = user?.aiConversations || [];
    
    // Analyze patterns
    const reasonCounts: Record<string, number> = {};
    let totalWithdrawals = 0;
    let resistedWithdrawals = 0;
    
    userHistory.forEach(entry => {
      if (entry.reason) {
        reasonCounts[entry.reason] = (reasonCounts[entry.reason] || 0) + 1;
      }
      totalWithdrawals++;
      if (entry.cancelled) {
        resistedWithdrawals++;
      }
    });
    
    // Add AI counseling impact
    const counselingImpact = conversations.filter((c: any) => c.outcome === 'kept').length;
    const totalCounselingSessions = conversations.length;
    
    return {
      totalWithdrawals,
      resistedWithdrawals,
      reasonCounts,
      mostCommonReason: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      resistanceRate: totalWithdrawals > 0 ? (resistedWithdrawals / totalWithdrawals) * 100 : 0,
      counselingImpact,
      totalCounselingSessions,
      counselingSuccessRate: totalCounselingSessions > 0 ? (counselingImpact / totalCounselingSessions) * 100 : 0
    };
  }
}

// Export the storage instance
export const storage = new MongoStorage();