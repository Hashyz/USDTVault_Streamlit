import { ethers } from 'ethers';
import { apiRequest } from '@/lib/queryClient';

// BSC Mainnet configuration
const BSC_MAINNET = {
  chainId: 56,
  name: 'BSC Mainnet',
  rpcUrl: 'https://bsc-dataseed.binance.org/',
  explorerUrl: 'https://bscscan.com/'
};

const USDT_CONTRACT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
const USDT_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  confirmations: number;
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  bscscanUrl: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  totalCostBNB: string;
  totalCostUSD: string;
}

export class Web3Service {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  
  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
  }

  // Static method to create service from private key
  static async fromPrivateKey(privateKey: string): Promise<Web3Service> {
    const provider = new ethers.JsonRpcProvider(BSC_MAINNET.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    return new Web3Service(provider, wallet);
  }

  // Static method to create service from backend-stored private key
  static async fromBackendKey(getAuthHeaders: () => HeadersInit): Promise<Web3Service | null> {
    try {
      // Check if user has an imported wallet
      const response = await apiRequest('/api/wallet/imported-address', 'GET');

      if (!response.hasImportedWallet) {
        return null;
      }

      // For backend-stored keys, we need a special implementation
      // that sends transactions through the backend
      const provider = new ethers.JsonRpcProvider(BSC_MAINNET.rpcUrl);
      
      // For now, we'll create a service without a real signer
      // In production, implement backend transaction signing
      // @ts-ignore - BackendSigner doesn't fully implement ethers.Signer yet
      const backendSigner = new BackendSigner(response.address, provider, getAuthHeaders) as any;
      
      return new Web3Service(provider, backendSigner);
    } catch (error) {
      console.error('Error creating service from backend key:', error);
      return null;
    }
  }

  async getAddress(): Promise<string> {
    return await this.signer.getAddress();
  }

  // Get BNB balance
  async getBNBBalance(address?: string): Promise<string> {
    try {
      const addr = address || await this.signer.getAddress();
      const balance = await this.provider.getBalance(addr);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting BNB balance:', error);
      throw error;
    }
  }

  // Get USDT balance
  async getUSDTBalance(address?: string): Promise<string> {
    try {
      const addr = address || await this.signer.getAddress();
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.provider);
      const balance = await usdtContract.balanceOf(addr);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting USDT balance:', error);
      throw error;
    }
  }

  // Estimate gas for BNB transfer
  async estimateBNBTransferGas(to: string, amount: string): Promise<GasEstimate> {
    try {
      const from = await this.signer.getAddress();
      const tx = {
        from,
        to,
        value: ethers.parseEther(amount)
      };

      const gasLimit = await this.provider.estimateGas(tx);
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');

      const totalCostWei = gasLimit * gasPrice;
      const totalCostBNB = ethers.formatEther(totalCostWei);
      
      // Estimate USD value (assuming 1 BNB = $300 for example)
      const bnbPriceUSD = 300; // In production, fetch from an API
      const totalCostUSD = (parseFloat(totalCostBNB) * bnbPriceUSD).toFixed(2);

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        totalCostBNB,
        totalCostUSD
      };
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw error;
    }
  }

  // Estimate gas for USDT transfer
  async estimateUSDTTransferGas(to: string, amount: string): Promise<GasEstimate> {
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.signer);
      const amountWei = ethers.parseEther(amount);
      
      const gasLimit = await usdtContract.transfer.estimateGas(to, amountWei);
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');

      const totalCostWei = gasLimit * gasPrice;
      const totalCostBNB = ethers.formatEther(totalCostWei);
      
      // Estimate USD value
      const bnbPriceUSD = 300; // In production, fetch from an API
      const totalCostUSD = (parseFloat(totalCostBNB) * bnbPriceUSD).toFixed(2);

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        totalCostBNB,
        totalCostUSD
      };
    } catch (error) {
      console.error('Error estimating USDT gas:', error);
      throw error;
    }
  }

  // Send BNB
  async sendBNB(to: string, amount: string): Promise<TransactionResult> {
    try {
      const tx = await this.signer.sendTransaction({
        to,
        value: ethers.parseEther(amount)
      });

      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        amount,
        status: receipt?.status === 1 ? 'success' : 'failed',
        confirmations: receipt?.confirmations || 0,
        blockNumber: receipt?.blockNumber?.toString(),
        gasUsed: receipt?.gasUsed.toString(),
        effectiveGasPrice: receipt?.gasPrice?.toString(),
        bscscanUrl: `https://bscscan.com/tx/${tx.hash}`
      };
    } catch (error) {
      console.error('Error sending BNB:', error);
      throw error;
    }
  }

  // Send USDT
  async sendUSDT(to: string, amount: string): Promise<TransactionResult> {
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.signer);
      const amountWei = ethers.parseEther(amount);
      
      const tx = await usdtContract.transfer(to, amountWei);
      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        from: await this.signer.getAddress(),
        to,
        amount,
        status: receipt?.status === 1 ? 'success' : 'failed',
        confirmations: receipt?.confirmations || 0,
        blockNumber: receipt?.blockNumber?.toString(),
        gasUsed: receipt?.gasUsed.toString(),
        effectiveGasPrice: receipt?.gasPrice?.toString(),
        bscscanUrl: `https://bscscan.com/tx/${tx.hash}`
      };
    } catch (error) {
      console.error('Error sending USDT:', error);
      throw error;
    }
  }

  // Check if address is valid
  isValidAddress(address: string): boolean {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  // Format address for display
  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Get transaction details
  async getTransaction(hash: string): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(hash);
    } catch (error) {
      console.error('Error getting transaction:', error);
      return null;
    }
  }

  // Wait for transaction confirmation
  async waitForTransaction(hash: string, confirmations = 1): Promise<ethers.TransactionReceipt | null> {
    try {
      const receipt = await this.provider.waitForTransaction(hash, confirmations);
      return receipt;
    } catch (error) {
      console.error('Error waiting for transaction:', error);
      return null;
    }
  }

  // Get current gas price
  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');
      return ethers.formatUnits(gasPrice, 'gwei');
    } catch (error) {
      console.error('Error getting gas price:', error);
      return '5';
    }
  }

  // Check USDT allowance
  async checkUSDTAllowance(owner: string, spender: string): Promise<string> {
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.provider);
      const allowance = await usdtContract.allowance(owner, spender);
      return ethers.formatEther(allowance);
    } catch (error) {
      console.error('Error checking allowance:', error);
      throw error;
    }
  }

  // Approve USDT spending
  async approveUSDT(spender: string, amount: string): Promise<TransactionResult> {
    try {
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, this.signer);
      const amountWei = ethers.parseEther(amount);
      
      const tx = await usdtContract.approve(spender, amountWei);
      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        from: await this.signer.getAddress(),
        to: spender,
        amount,
        status: receipt?.status === 1 ? 'success' : 'failed',
        confirmations: receipt?.confirmations || 0,
        blockNumber: receipt?.blockNumber?.toString(),
        gasUsed: receipt?.gasUsed.toString(),
        effectiveGasPrice: receipt?.gasPrice?.toString(),
        bscscanUrl: `https://bscscan.com/tx/${tx.hash}`
      };
    } catch (error) {
      console.error('Error approving USDT:', error);
      throw error;
    }
  }
}

// Custom signer implementation for backend-stored private keys
// This is a simplified implementation - in production, you'd want more robust backend signing
class BackendSigner {
  public readonly address: string;
  public readonly provider: ethers.Provider;
  private getAuthHeaders: () => HeadersInit;

  constructor(address: string, provider: ethers.Provider, getAuthHeaders: () => HeadersInit) {
    this.address = address;
    this.provider = provider;
    this.getAuthHeaders = getAuthHeaders;
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    // In production, implement backend signing
    throw new Error('Backend message signing not implemented');
  }

  async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // In production, implement backend transaction signing
    throw new Error('Backend transaction signing not implemented');
  }

  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    // In production, route through backend API for signing
    // For now, throw error to prevent accidental use
    throw new Error('Backend transaction sending not implemented. Please import your private key to send transactions.');
  }

  connect(provider: ethers.Provider): BackendSigner {
    return new BackendSigner(this.address, provider, this.getAuthHeaders);
  }
}