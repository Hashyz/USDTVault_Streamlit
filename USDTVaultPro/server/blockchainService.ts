import { ethers } from 'ethers';
import Decimal from 'decimal.js';
import fetch from 'node-fetch';

// BSC Configuration
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const BSCSCAN_API_URL = 'https://api.bscscan.com/api';
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';

// USDT Token ABI (minimal for balanceOf)
const USDT_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

// Initialize BSC provider
const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);

// USDT Contract instance
const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);

export interface BlockchainBalance {
  bnb: string;
  usdt: string;
  totalUSD: string;
}

export interface BSCTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  isError: string;
  gasUsed: string;
  gasPrice: string;
  contractAddress?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

export interface TransactionMetrics {
  totalTransactions: number;
  volume24h: string;
  successRate: number;
  riskScore: number;
  lastActivity: Date | null;
}

class BlockchainService {
  private bscscanApiKey: string = '';

  constructor() {
    // Note: In production, this should be loaded from environment variables
    // For now, using public rate-limited access
    this.bscscanApiKey = process.env.BSCSCAN_API_KEY || '';
  }

  /**
   * Fetch wallet balance from blockchain
   */
  async getWalletBalance(address: string): Promise<BlockchainBalance> {
    try {
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid wallet address');
      }

      // Fetch BNB balance
      const bnbBalanceWei = await provider.getBalance(address);
      const bnbBalance = ethers.formatEther(bnbBalanceWei);

      // Fetch USDT balance
      const usdtBalanceRaw = await usdtContract.balanceOf(address);
      const usdtDecimals = await usdtContract.decimals();
      const usdtBalance = ethers.formatUnits(usdtBalanceRaw, usdtDecimals);

      // Calculate total USD value (assuming BNB price for demo)
      // In production, you'd fetch real prices from an API
      const bnbPrice = 300; // Approximate BNB price in USD
      const bnbValueUSD = new Decimal(bnbBalance).mul(bnbPrice);
      const totalUSD = new Decimal(usdtBalance).add(bnbValueUSD).toFixed(2);

      return {
        bnb: bnbBalance,
        usdt: usdtBalance,
        totalUSD
      };
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      throw error;
    }
  }

  /**
   * Fetch BNB transactions from BSCScan
   */
  async getBNBTransactions(address: string, limit: number = 50): Promise<BSCTransaction[]> {
    try {
      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: '0',
        endblock: '99999999',
        sort: 'desc',
        page: '1',
        offset: limit.toString()
      });

      if (this.bscscanApiKey) {
        params.append('apikey', this.bscscanApiKey);
      }

      const response = await fetch(`${BSCSCAN_API_URL}?${params}`);
      const data = await response.json();

      if (data.status === '1' && data.result) {
        return data.result;
      }

      return [];
    } catch (error) {
      console.error('Error fetching BNB transactions:', error);
      return [];
    }
  }

  /**
   * Fetch BEP20 token transactions from BSCScan
   */
  async getTokenTransactions(address: string, limit: number = 50): Promise<BSCTransaction[]> {
    try {
      const params = new URLSearchParams({
        module: 'account',
        action: 'tokentx',
        address: address,
        startblock: '0',
        endblock: '99999999',
        sort: 'desc',
        page: '1',
        offset: limit.toString()
      });

      if (this.bscscanApiKey) {
        params.append('apikey', this.bscscanApiKey);
      }

      const response = await fetch(`${BSCSCAN_API_URL}?${params}`);
      const data = await response.json();

      if (data.status === '1' && data.result) {
        // Filter for USDT transactions
        return data.result.filter((tx: BSCTransaction) => 
          tx.contractAddress?.toLowerCase() === USDT_CONTRACT_ADDRESS.toLowerCase()
        );
      }

      return [];
    } catch (error) {
      console.error('Error fetching token transactions:', error);
      return [];
    }
  }

  /**
   * Fetch all transactions (BNB + USDT) for an address
   */
  async getAllTransactions(address: string, limit: number = 100): Promise<BSCTransaction[]> {
    try {
      const [bnbTxs, tokenTxs] = await Promise.all([
        this.getBNBTransactions(address, limit),
        this.getTokenTransactions(address, limit)
      ]);

      // Combine and sort by timestamp
      const allTxs = [...bnbTxs, ...tokenTxs];
      allTxs.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

      return allTxs.slice(0, limit);
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      return [];
    }
  }

  /**
   * Calculate transaction metrics from transaction history
   */
  calculateMetrics(transactions: BSCTransaction[], address: string): TransactionMetrics {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Filter transactions for the last 24 hours
    const recent24h = transactions.filter(tx => {
      const txTime = parseInt(tx.timeStamp) * 1000;
      return txTime >= oneDayAgo;
    });

    // Calculate 24h volume
    let volume24h = new Decimal(0);
    recent24h.forEach(tx => {
      if (tx.tokenDecimal) {
        // Token transaction
        const value = ethers.formatUnits(tx.value, tx.tokenDecimal);
        volume24h = volume24h.add(value);
      } else {
        // BNB transaction
        const value = ethers.formatEther(tx.value);
        // Convert BNB to USD (approximate)
        volume24h = volume24h.add(new Decimal(value).mul(300));
      }
    });

    // Calculate success rate
    const successfulTxs = transactions.filter(tx => tx.isError === '0').length;
    const successRate = transactions.length > 0 
      ? (successfulTxs / transactions.length) * 100 
      : 100;

    // Calculate risk score (0-100, lower is better)
    // Based on: failed transactions, high frequency, large volumes
    let riskScore = 0;
    
    // Failed transactions increase risk
    const failureRate = 100 - successRate;
    riskScore += failureRate * 0.5;
    
    // High frequency increases risk
    if (recent24h.length > 20) riskScore += 20;
    else if (recent24h.length > 10) riskScore += 10;
    
    // Large volumes increase risk
    if (volume24h.greaterThan(10000)) riskScore += 20;
    else if (volume24h.greaterThan(5000)) riskScore += 10;
    
    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Get last activity
    const lastActivity = transactions.length > 0 
      ? new Date(parseInt(transactions[0].timeStamp) * 1000)
      : null;

    return {
      totalTransactions: transactions.length,
      volume24h: volume24h.toFixed(2),
      successRate: parseFloat(successRate.toFixed(2)),
      riskScore: Math.round(riskScore),
      lastActivity
    };
  }

  /**
   * Format BSCScan transactions for frontend display
   */
  formatTransactionsForDisplay(transactions: BSCTransaction[], userAddress: string) {
    return transactions.map(tx => {
      const isToken = !!tx.tokenSymbol;
      const isSent = tx.from.toLowerCase() === userAddress.toLowerCase();
      
      let amount = '0';
      let currency = 'BNB';
      
      if (isToken) {
        amount = ethers.formatUnits(tx.value, tx.tokenDecimal || '18');
        currency = tx.tokenSymbol || 'Token';
      } else {
        amount = ethers.formatEther(tx.value);
      }

      return {
        id: tx.hash,
        transactionHash: tx.hash,
        type: isSent ? 'send' : 'receive',
        amount,
        currency,
        from: tx.from,
        to: tx.to,
        destinationAddress: isSent ? tx.to : undefined,
        sourceAddress: !isSent ? tx.from : undefined,
        status: tx.isError === '0' ? 'success' : 'failed',
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000),
        createdAt: new Date(parseInt(tx.timeStamp) * 1000)
      };
    });
  }

  /**
   * Validate if a private key corresponds to an address
   */
  validatePrivateKey(privateKey: string, expectedAddress: string): boolean {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Invalid private key:', error);
      return false;
    }
  }

  /**
   * Get wallet address from private key
   */
  getAddressFromPrivateKey(privateKey: string): string | null {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return wallet.address;
    } catch (error) {
      console.error('Invalid private key:', error);
      return null;
    }
  }

  /**
   * Send USDT transaction
   */
  async sendUSDT(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<{ hash: string; status: string }> {
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      const contractWithSigner = usdtContract.connect(wallet);
      
      const decimals = await usdtContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      
      // Send transaction
      const tx = await contractWithSigner.transfer(toAddress, amountWei);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        hash: receipt.hash,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Error sending USDT:', error);
      throw error;
    }
  }

  /**
   * Send BNB transaction
   */
  async sendBNB(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<{ hash: string; status: string }> {
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      const amountWei = ethers.parseEther(amount);
      
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: amountWei
      });
      
      const receipt = await tx.wait();
      
      return {
        hash: receipt.hash,
        status: receipt.status === 1 ? 'success' : 'failed'
      };
    } catch (error) {
      console.error('Error sending BNB:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    from: string,
    to: string,
    amount: string,
    currency: 'BNB' | 'USDT'
  ): Promise<{ gasEstimate: string; gasPriceGwei: string; totalCostBNB: string }> {
    try {
      let gasEstimate;
      
      if (currency === 'BNB') {
        gasEstimate = await provider.estimateGas({
          from,
          to,
          value: ethers.parseEther(amount)
        });
      } else {
        // USDT transfer gas estimate
        const data = usdtContract.interface.encodeFunctionData('transfer', [
          to,
          ethers.parseUnits(amount, 18)
        ]);
        
        gasEstimate = await provider.estimateGas({
          from,
          to: USDT_CONTRACT_ADDRESS,
          data
        });
      }
      
      const gasPrice = await provider.getFeeData();
      const gasPriceGwei = ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei');
      const totalCostBNB = ethers.formatEther(gasEstimate * (gasPrice.gasPrice || 0n));
      
      return {
        gasEstimate: gasEstimate.toString(),
        gasPriceGwei,
        totalCostBNB
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }
}

export const blockchainService = new BlockchainService();