import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Web3Service } from '@/services/web3Service';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Web3ContextType {
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  network: string | null;
  chainId: number | null;
  bnbBalance: string;
  usdtBalance: string;
  provider: ethers.JsonRpcProvider | null;
  signer: ethers.Wallet | null;
  web3Service: Web3Service | null;
  hasImportedWallet: boolean;
  connectImportedWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalances: () => Promise<void>;
  checkImportedWallet: () => Promise<void>;
}

export const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const BSC_MAINNET_CONFIG = {
  chainId: '0x38', // 56 in hex
  chainName: 'Binance Smart Chain Mainnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/']
};

const USDT_CONTRACT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
const USDT_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [bnbBalance, setBnbBalance] = useState('0');
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Wallet | null>(null);
  const [web3Service, setWeb3Service] = useState<Web3Service | null>(null);
  const [hasImportedWallet, setHasImportedWallet] = useState(false);
  
  const { toast } = useToast();
  const { getAuthHeaders, user } = useAuth();

  // Track if we've already checked the wallet to prevent redundant calls
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);

  // Check if user has an imported wallet
  const checkImportedWallet = useCallback(async () => {
    if (!user) return;
    
    // Prevent redundant checks if we've already checked and nothing has changed
    if (hasCheckedWallet && hasImportedWallet) return;
    
    try {
      const response = await apiRequest('/api/wallet/imported-address', 'GET');
      
      setHasCheckedWallet(true);
      
      if (response.hasImportedWallet) {
        setHasImportedWallet(true);
      } else {
        // No imported wallet, clear the state
        setHasImportedWallet(false);
        
        // If currently connected, disconnect
        if (isConnected) {
          // Clear all wallet connection state
          setIsConnected(false);
          setAccount(null);
          setProvider(null);
          setSigner(null);
          setWeb3Service(null);
          setChainId(null);
          setNetwork(null);
          setBnbBalance('0');
          setUsdtBalance('0');
          
          toast({
            title: 'Wallet Disconnected',
            description: 'Imported wallet was removed and has been disconnected',
          });
        }
      }
    } catch (error) {
      // No imported wallet, clear the state
      setHasImportedWallet(false);
      
      // If currently connected, disconnect
      if (isConnected) {
        // Clear all wallet connection state
        setIsConnected(false);
        setAccount(null);
        setProvider(null);
        setSigner(null);
        setWeb3Service(null);
        setChainId(null);
        setNetwork(null);
        setBnbBalance('0');
        setUsdtBalance('0');
        
        toast({
          title: 'Wallet Disconnected',
          description: 'Imported wallet was removed and has been disconnected',
        });
      }
    }
  }, [user, isConnected, toast]);

  // Check for imported wallet on user login and reset check flag when user changes
  useEffect(() => {
    if (user) {
      // Reset the check flag when user changes to force a fresh check
      setHasCheckedWallet(false);
      checkImportedWallet();
    } else {
      // Clear wallet states when user logs out
      setHasCheckedWallet(false);
      setHasImportedWallet(false);
    }
  }, [user?.id]); // Only depend on user ID to avoid unnecessary calls

  // Auto-connect imported wallet when user is authenticated and has an imported wallet
  useEffect(() => {
    const autoConnect = async () => {
      // Only auto-connect if:
      // 1. User is authenticated
      // 2. User has an imported wallet
      // 3. Wallet is not already connected
      // 4. Not currently connecting
      if (user && hasImportedWallet && !isConnected && !isConnecting) {
        try {
          // Silent auto-connect without toast notifications
          setIsConnecting(true);
          
          // Get the decrypted private key from backend
          const keyResponse = await apiRequest('/api/wallet/imported-key', 'GET');
          
          if (!keyResponse.hasImportedWallet || !keyResponse.privateKey) {
            // No wallet found, update state
            setHasImportedWallet(false);
            return;
          }

          // Create a JsonRpcProvider for BSC mainnet
          const jsonRpcProvider = new ethers.JsonRpcProvider(BSC_MAINNET_CONFIG.rpcUrls[0]);
          
          // Create a wallet using the decrypted private key
          const wallet = new ethers.Wallet(keyResponse.privateKey);
          
          // Connect the wallet to the provider to get a signer
          const signer = wallet.connect(jsonRpcProvider);
          
          // Get the wallet address
          const address = await signer.getAddress();
          
          // Create Web3Service using the private key
          const service = await Web3Service.fromPrivateKey(keyResponse.privateKey);

          // Set the provider and signer for the imported wallet
          setProvider(jsonRpcProvider);
          setSigner(signer);
          setWeb3Service(service);
          setAccount(address);
          setChainId(56); // BSC Mainnet
          setNetwork('BSC Mainnet');
          setIsConnected(true);

          // Fetch initial balances silently
          try {
            const bnbBalanceWei = await jsonRpcProvider.getBalance(address);
            const bnbBalanceFormatted = ethers.formatEther(bnbBalanceWei);
            setBnbBalance(parseFloat(bnbBalanceFormatted).toFixed(6));

            const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, jsonRpcProvider);
            const usdtBalanceWei = await usdtContract.balanceOf(address);
            const usdtBalanceFormatted = ethers.formatEther(usdtBalanceWei);
            setUsdtBalance(parseFloat(usdtBalanceFormatted).toFixed(2));
          } catch (error) {
            console.error('Error fetching auto-connect balances:', error);
          }
          
          // Silent connection - no toast notification for auto-connect
          console.log(`Auto-connected wallet: ${address.slice(0, 6)}...${address.slice(-4)}`);
        } catch (error) {
          console.error('Auto-connect failed:', error);
          // Silent fail - user can manually connect if needed
        } finally {
          setIsConnecting(false);
        }
      }
    };

    // Small delay to ensure user state is fully loaded
    const timeoutId = setTimeout(autoConnect, 500);
    
    return () => clearTimeout(timeoutId);
  }, [user, hasImportedWallet]); // Don't include isConnected/isConnecting to avoid infinite loops

  const refreshBalances = useCallback(async () => {
    if (!provider || !account) return;

    try {
      // Get BNB balance
      const bnbBalanceWei = await provider.getBalance(account);
      const bnbBalanceFormatted = ethers.formatEther(bnbBalanceWei);
      setBnbBalance(parseFloat(bnbBalanceFormatted).toFixed(6));

      // Get USDT balance
      const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
      const usdtBalanceWei = await usdtContract.balanceOf(account);
      const usdtBalanceFormatted = ethers.formatEther(usdtBalanceWei);
      setUsdtBalance(parseFloat(usdtBalanceFormatted).toFixed(2));
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [provider, account]);


  const connectImportedWallet = async () => {
    if (!user) {
      toast({
        title: 'Not Logged In',
        description: 'Please log in to use an imported wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Get the decrypted private key from backend
      const keyResponse = await apiRequest('/api/wallet/imported-key', 'GET');
      
      if (!keyResponse.hasImportedWallet || !keyResponse.privateKey) {
        toast({
          title: 'No Imported Wallet',
          description: 'Please import a wallet first',
          variant: 'destructive',
        });
        return;
      }

      // Create a JsonRpcProvider for BSC mainnet
      const jsonRpcProvider = new ethers.JsonRpcProvider(BSC_MAINNET_CONFIG.rpcUrls[0]);
      
      // Create a wallet using the decrypted private key
      const wallet = new ethers.Wallet(keyResponse.privateKey);
      
      // Connect the wallet to the provider to get a signer
      const signer = wallet.connect(jsonRpcProvider);
      
      // Get the wallet address
      const address = await signer.getAddress();
      
      // Create Web3Service using the private key
      const service = await Web3Service.fromPrivateKey(keyResponse.privateKey);

      // Set the provider and signer for the imported wallet
      setProvider(jsonRpcProvider);
      setSigner(signer);
      setWeb3Service(service);
      setAccount(address);
      setChainId(56); // BSC Mainnet
      setNetwork('BSC Mainnet');
      setIsConnected(true);
      setHasImportedWallet(true);

      // Fetch initial balances using the provider
      try {
        const bnbBalanceWei = await jsonRpcProvider.getBalance(address);
        const bnbBalanceFormatted = ethers.formatEther(bnbBalanceWei);
        setBnbBalance(parseFloat(bnbBalanceFormatted).toFixed(6));

        const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, jsonRpcProvider);
        const usdtBalanceWei = await usdtContract.balanceOf(address);
        const usdtBalanceFormatted = ethers.formatEther(usdtBalanceWei);
        setUsdtBalance(parseFloat(usdtBalanceFormatted).toFixed(2));
      } catch (error) {
        console.error('Error fetching imported wallet balances:', error);
      }

      toast({
        title: 'Imported Wallet Connected',
        description: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
      });
    } catch (error: any) {
      console.error('Error connecting imported wallet:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect imported wallet',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setWeb3Service(null);
    setChainId(null);
    setNetwork(null);
    setBnbBalance('0');
    setUsdtBalance('0');
    
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
  };


  // Auto-refresh balances every 30 seconds when connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(refreshBalances, 30000);
    return () => clearInterval(interval);
  }, [isConnected, refreshBalances]);

  // Refresh imported wallet status when wallet-related queries are invalidated
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Only check wallet status when wallet-specific queries are invalidated
      if (event?.query?.queryKey && Array.isArray(event.query.queryKey)) {
        const queryKey = event.query.queryKey[0];
        if (typeof queryKey === 'string' && queryKey.includes('/wallet/')) {
          checkImportedWallet();
        }
      }
    });
    
    return () => unsubscribe();
  }, [checkImportedWallet]);

  const value: Web3ContextType = {
    isConnected,
    isConnecting,
    account,
    network,
    chainId,
    bnbBalance,
    usdtBalance,
    provider,
    signer,
    web3Service,
    hasImportedWallet,
    connectImportedWallet,
    disconnectWallet,
    refreshBalances,
    checkImportedWallet,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}