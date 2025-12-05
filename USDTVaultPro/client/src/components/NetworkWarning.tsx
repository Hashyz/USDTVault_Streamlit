import { useContext } from 'react';
import { Web3Context } from '@/contexts/Web3Context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wifi, WifiOff, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function NetworkWarning() {
  const web3Context = useContext(Web3Context);
  const { user } = useAuth();

  // If Web3Context doesn't exist, don't show warnings
  if (!web3Context) {
    return null;
  }

  const { isConnected, chainId, hasImportedWallet, connectImportedWallet } = web3Context;

  // If not logged in, don't show warnings
  if (!user) {
    return null;
  }

  // Check if wallet needs to be imported
  if (!hasImportedWallet) {
    return (
      <Alert className="border-warning/50 bg-warning/10 mb-4">
        <Key className="h-4 w-4" />
        <AlertDescription>
          <span>Import a wallet to enable blockchain features</span>
        </AlertDescription>
      </Alert>
    );
  }

  // Check for wallet connection
  if (!isConnected && hasImportedWallet) {
    return (
      <Alert className="border-warning/50 bg-warning/10 mb-4">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Connect your imported wallet to enable blockchain features</span>
          <Button
            size="sm"
            variant="outline"
            onClick={connectImportedWallet}
            data-testid="button-connect-wallet"
          >
            Connect Wallet
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Check for correct network (should always be BSC for imported wallets)
  if (isConnected && chainId !== 56) {
    return (
      <Alert className="border-destructive/50 bg-destructive/10 mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <span>Network error: Expected BSC Mainnet (Chain ID: 56)</span>
        </AlertDescription>
      </Alert>
    );
  }

  // Connected to correct network - show success
  return (
    <Alert className="border-green-500/50 bg-green-500/10 mb-4">
      <Wifi className="h-4 w-4" />
      <AlertDescription className="text-green-700 dark:text-green-300">
        Connected to BSC Mainnet - Ready for transactions
      </AlertDescription>
    </Alert>
  );
}