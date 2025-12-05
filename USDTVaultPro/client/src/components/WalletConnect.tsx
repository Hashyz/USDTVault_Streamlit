import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Copy, Check, LogOut, Download, RefreshCw, Unplug, ExternalLink, Key, Repeat } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useContext } from 'react';
import { Web3Context } from '@/contexts/Web3Context';
import { Dialog } from '@/components/ui/dialog';
import CredentialExport from '@/components/CredentialExport';
import ImportWalletModal from '@/components/ImportWalletModal';
import { useToast } from '@/hooks/use-toast';

interface WalletConnectProps {
  user?: any;
}

export default function WalletConnect({ user }: WalletConnectProps) {
  const { logout } = useAuth();
  
  // Use optional Web3 context (might not be available in all routes)
  const web3Context = useContext(Web3Context);
  const { 
    isConnected = false, 
    isConnecting = false, 
    account = null, 
    chainId = null, 
    bnbBalance = '0', 
    usdtBalance = '0', 
    hasImportedWallet = false,
    connectImportedWallet = async () => {},
    disconnectWallet = () => {},
    refreshBalances = async () => {},
    checkImportedWallet = async () => {}
  } = web3Context || {};
  
  const [copied, setCopied] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const copyAddress = () => {
    const addressToCopy = account || user?.walletAddress;
    if (addressToCopy) {
      navigator.clipboard.writeText(addressToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
      });
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return 'No Address';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleLogout = () => {
    if (isConnected) {
      disconnectWallet();
    }
    logout();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalances();
    setTimeout(() => setIsRefreshing(false), 1000);
    toast({
      title: 'Balances Updated',
      description: 'Your wallet balances have been refreshed',
    });
  };

  const handleImportSuccess = async (address: string) => {
    // If address is empty, it means the wallet was removed
    if (!address) {
      // Clear modal state
      setImportModalOpen(false);
      
      // Refresh imported wallet status
      await checkImportedWallet();
      
      // Disconnect if we were connected to the imported wallet
      if (isConnected) {
        disconnectWallet();
      }
      
      return;
    }
    
    // Refresh imported wallet status for new import
    await checkImportedWallet();
    
    // Optionally auto-connect to the imported wallet if it was just imported
    if (web3Context && address) {
      await connectImportedWallet();
    }
  };

  const getNetworkBadge = () => {
    if (!isConnected) return null;
    
    if (chainId === 56) {
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/30" data-testid="badge-network">
          BSC Mainnet
        </Badge>
      );
    } else if (chainId === 97) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30" data-testid="badge-network">
          BSC Testnet
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30" data-testid="badge-network">
          Wrong Network
        </Badge>
      );
    }
  };

  const getWalletTypeBadge = () => {
    if (!isConnected) return null;
    
    return (
      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
        <Key className="w-3 h-3 mr-1" />
        Imported
      </Badge>
    );
  };

  // If Web3 is not connected and user is not logged in, return null
  // (Login/signup is required first)
  if (!isConnected && !user) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {isConnected ? (
          <>
            {getWalletTypeBadge()}
            {getNetworkBadge()}
          </>
        ) : user ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30" data-testid="badge-network">
            BSC
          </Badge>
        ) : null}
        
        {/* Only show import/connect buttons if not connected and no auto-connect in progress */}
        {!isConnected && user && !isConnecting && (
          <div className="flex gap-2">
            {hasImportedWallet ? (
              // Show reconnect button only if wallet exists but not connected (rare case)
              <Button 
                onClick={connectImportedWallet} 
                disabled={isConnecting}
                variant="outline"
                size="sm"
                data-testid="button-connect-imported"
              >
                <Repeat className="w-4 h-4 mr-2" />
                Reconnect Wallet
              </Button>
            ) : (
              // Show import button only if no wallet exists
              <Button 
                onClick={() => setImportModalOpen(true)} 
                variant="outline"
                size="sm"
                data-testid="button-import-wallet"
              >
                <Key className="w-4 h-4 mr-2" />
                Import Wallet
              </Button>
            )}
          </div>
        )}
        
        {/* Show connecting state during auto-connect */}
        {isConnecting && user && (
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Connecting...
          </Badge>
        )}
        
        {(isConnected || user) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="font-mono text-sm" data-testid="button-wallet-menu">
                <Wallet className="w-4 h-4 mr-2" />
                {truncateAddress(account || user?.walletAddress || '')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div>
                  {user && <div className="font-semibold mb-1">{user.username}</div>}
                  {isConnected && (
                    <div className="text-xs text-muted-foreground font-normal mb-1">
                      Connected via Imported Key
                    </div>
                  )}
                  {isConnected ? (
                    <div className="text-xs text-muted-foreground font-normal space-y-1">
                      <div className="flex justify-between">
                        <span>BNB Balance:</span>
                        <span className="font-mono">{bnbBalance} BNB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>USDT Balance:</span>
                        <span className="font-mono">{usdtBalance} USDT</span>
                      </div>
                    </div>
                  ) : user ? (
                    <div className="text-xs text-muted-foreground font-normal">
                      Balance: {parseFloat(user?.balance || '0').toFixed(2)} USDT
                    </div>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyAddress} data-testid="button-copy-address">
                {copied ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy Address'}
              </DropdownMenuItem>
              {isConnected && (
                <>
                  <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing} data-testid="button-refresh-balance">
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Balances
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      window.open(`https://bscscan.com/address/${account}`, '_blank');
                    }}
                    data-testid="button-view-bscscan"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View on BSCScan
                  </DropdownMenuItem>
                </>
              )}
              {user && (
                <>
                  <DropdownMenuSeparator />
                  {!isConnected && !hasImportedWallet && (
                    <DropdownMenuItem 
                      onClick={() => setImportModalOpen(true)} 
                      data-testid="button-import-wallet-menu"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Import Wallet
                    </DropdownMenuItem>
                  )}
                  {hasImportedWallet && (
                    <DropdownMenuItem 
                      onClick={() => setImportModalOpen(true)} 
                      data-testid="button-manage-imported"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Manage Imported Wallet
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={() => setCredentialModalOpen(true)} 
                    data-testid="button-export-credentials"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export App Credentials
                  </DropdownMenuItem>
                </>
              )}
              {isConnected && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet} className="text-warning" data-testid="button-disconnect">
                    <Unplug className="w-4 h-4 mr-2" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </>
              )}
              {user && (
                <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="button-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout from App
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      {user && (
        <>
          <Dialog open={credentialModalOpen} onOpenChange={setCredentialModalOpen}>
            <CredentialExport />
          </Dialog>
          <ImportWalletModal 
            open={importModalOpen} 
            onOpenChange={setImportModalOpen}
            onImportSuccess={handleImportSuccess}
          />
        </>
      )}
    </>
  );
}