import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpRight, ArrowDownLeft, Copy, Check, ExternalLink, AlertCircle, Loader2, Wallet, PiggyBank, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useContext } from 'react';
import { Web3Context } from '@/contexts/Web3Context';
import { Web3Service } from '@/services/web3Service';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import type { SavingsGoal } from '@shared/schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface SendReceiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'send' | 'receive';
  currentBalance?: number;
}

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  address: string;
  amount: string;
  currency: 'USDT' | 'BNB';
  gasEstimate: any;
  bnbBalance: string;
  usdtBalance: string;
}

function TransactionConfirmationDialog({
  open,
  onClose,
  onConfirm,
  loading,
  address,
  amount,
  currency,
  gasEstimate,
  bnbBalance,
  usdtBalance,
}: ConfirmationDialogProps) {
  const totalCost = currency === 'BNB' 
    ? (parseFloat(amount) + parseFloat(gasEstimate?.totalCostBNB || '0')).toFixed(6)
    : amount;

  return (
    <Dialog open={open} onOpenChange={() => !loading && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Confirm Transaction</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Please review the transaction details before confirming
          </DialogDescription>
        </DialogHeader>
        
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">To Address</span>
              <span className="font-mono text-xs">{address.slice(0, 8)}...{address.slice(-6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{amount} {currency}</span>
            </div>
            {gasEstimate && (
              <>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="font-mono">{gasEstimate.totalCostBNB} BNB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gas Price</span>
                  <span className="font-mono text-xs">{gasEstimate.gasPrice} Gwei</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Estimated USD</span>
                  <span className="font-mono">~${gasEstimate.totalCostUSD}</span>
                </div>
              </>
            )}
            {currency === 'BNB' && (
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Cost</span>
                <span>{totalCost} BNB</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-1 p-3 bg-muted rounded-md text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your BNB Balance</span>
            <span className="font-mono">{parseFloat(bnbBalance).toFixed(6)} BNB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your USDT Balance</span>
            <span className="font-mono">{parseFloat(usdtBalance).toFixed(2)} USDT</span>
          </div>
        </div>

        {parseFloat(bnbBalance) < parseFloat(gasEstimate?.totalCostBNB || '0') && (
          <Alert className="border-destructive/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Insufficient BNB for gas fees. You need at least {gasEstimate?.totalCostBNB} BNB.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={loading || parseFloat(bnbBalance) < parseFloat(gasEstimate?.totalCostBNB || '0')}
            className="gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Processing...' : 'Confirm & Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SendReceiveModal({ 
  open, 
  onOpenChange, 
  defaultTab = 'send',
  currentBalance = 0
}: SendReceiveModalProps) {
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<any>(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [currency, setCurrency] = useState<'USDT' | 'BNB'>('USDT');
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Use optional Web3 context
  const web3Context = useContext(Web3Context);
  const { 
    isConnected = false, 
    account = null, 
    chainId = null,
    usdtBalance = '0',
    bnbBalance = '0',
    provider = null, 
    signer = null,
    refreshBalances = async () => {}
  } = web3Context || {};
  
  // Fetch savings goals to calculate locked amount
  const { data: savingsGoals, isLoading: isLoadingSavings } = useQuery<SavingsGoal[]>({
    queryKey: ['/api/savings-goals'],
    enabled: open && currency === 'USDT', // Only fetch when modal is open and USDT is selected
  });
  
  // Calculate total amount locked in savings
  const totalSavedAmount = useMemo(() => {
    if (!savingsGoals || currency !== 'USDT') return 0;
    return savingsGoals.reduce((total, goal) => {
      return total + parseFloat(goal.current || '0');
    }, 0);
  }, [savingsGoals, currency]);
  
  const myAddress = account || user?.walletAddress || '';
  
  // Calculate actual available balance (excluding savings)
  const walletBalance = isConnected ? parseFloat(usdtBalance) : currentBalance;
  const availableForSending = currency === 'BNB' 
    ? parseFloat(bnbBalance) 
    : Math.max(0, walletBalance - totalSavedAmount);
  
  // This is the effective balance that was previously used
  const effectiveBalance = currency === 'BNB' 
    ? parseFloat(bnbBalance) 
    : walletBalance;

  // Initialize Web3Service when connected
  const web3Service = signer && provider ? new Web3Service(provider, signer) : null;

  // Validate address on change
  useEffect(() => {
    if (sendAddress && web3Service) {
      setIsAddressValid(web3Service.isValidAddress(sendAddress));
    }
  }, [sendAddress, web3Service]);

  // Estimate gas when amount and address are valid
  useEffect(() => {
    const estimateGas = async () => {
      if (!web3Service || !sendAddress || !sendAmount || !isAddressValid) {
        setGasEstimate(null);
        return;
      }

      const amount = parseFloat(sendAmount);
      if (amount <= 0 || amount > availableForSending) {
        setGasEstimate(null);
        return;
      }

      setIsEstimatingGas(true);
      try {
        const estimate = currency === 'BNB'
          ? await web3Service.estimateBNBTransferGas(sendAddress, sendAmount)
          : await web3Service.estimateUSDTTransferGas(sendAddress, sendAmount);
        setGasEstimate(estimate);
      } catch (error) {
        console.error('Gas estimation failed:', error);
        setGasEstimate(null);
      } finally {
        setIsEstimatingGas(false);
      }
    };

    const debounceTimer = setTimeout(estimateGas, 500);
    return () => clearTimeout(debounceTimer);
  }, [sendAddress, sendAmount, currency, web3Service, isAddressValid, availableForSending]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!sendAddress || !sendAmount) {
        throw new Error('Please enter both address and amount');
      }
      
      const amount = parseFloat(sendAmount);
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      
      // Check if trying to send more than available (excluding savings)
      if (amount > availableForSending) {
        if (currency === 'USDT' && totalSavedAmount > 0 && amount <= effectiveBalance) {
          throw new Error(`This amount includes ${totalSavedAmount.toFixed(2)} USDT locked in savings goals. Withdraw from savings first if needed.`);
        } else {
          throw new Error('Insufficient balance');
        }
      }

      // If Web3 is connected, send real transaction
      if (web3Service && isConnected) {
        if (!isAddressValid) {
          throw new Error('Invalid wallet address');
        }

        if (chainId !== 56) {
          throw new Error('Please switch to BSC Mainnet');
        }

        // Check BNB balance for gas
        const bnbBalanceNum = parseFloat(bnbBalance);
        if (bnbBalanceNum < parseFloat(gasEstimate?.totalCostBNB || '0.001')) {
          throw new Error('Insufficient BNB for gas fees');
        }

        let result;
        if (currency === 'BNB') {
          result = await web3Service.sendBNB(sendAddress, sendAmount);
        } else {
          result = await web3Service.sendUSDT(sendAddress, sendAmount);
        }
        
        setTransactionHash(result.hash);
        
        // Store transaction in database with hash
        await apiRequest('/api/transactions', 'POST', {
          type: 'send',
          amount: amount.toString(),
          destinationAddress: sendAddress,
          transactionHash: result.hash,
          currency,
          status: result.status,
          gasUsed: result.gasUsed,
          effectiveGasPrice: result.effectiveGasPrice,
          blockNumber: result.blockNumber,
        });
        
        // Refresh balances after a delay
        setTimeout(() => {
          refreshBalances();
        }, 3000);
        
        return result;
      } else {
        // Fallback to database transaction (demo mode)
        return apiRequest('/api/transactions', 'POST', {
          type: 'send',
          amount: amount.toString(),
          destinationAddress: sendAddress,
          currency,
          status: 'completed',
        });
      }
    },
    onSuccess: (data) => {
      setShowConfirmation(false);
      
      if (data?.hash) {
        toast({
          title: 'Transaction Successful',
          description: (
            <div className="space-y-2">
              <p>Sent {sendAmount} {currency}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(data.bscscanUrl, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View on BSCScan
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(data.hash);
                    toast({ title: 'Transaction hash copied' });
                  }}
                  className="text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Hash
                </Button>
              </div>
            </div>
          ),
        });
      } else {
        toast({
          title: 'Transaction Sent',
          description: `Sent ${sendAmount} ${currency} to ${sendAddress.slice(0, 6)}...${sendAddress.slice(-4)}`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
      onOpenChange(false);
      setSendAddress('');
      setSendAmount('');
      setTransactionHash('');
      setGasEstimate(null);
    },
    onError: (error: any) => {
      setShowConfirmation(false);
      toast({
        title: 'Transaction Failed',
        description: error.message || `Failed to send ${currency}`,
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (isConnected && web3Service) {
      // Show confirmation dialog for blockchain transactions
      setShowConfirmation(true);
    } else {
      // Direct send for demo mode
      sendMutation.mutate();
    }
  };

  const handleConfirmedSend = () => {
    sendMutation.mutate();
  };

  const copyAddress = () => {
    if (myAddress) {
      navigator.clipboard.writeText(myAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
      });
    }
  };

  const handleMaxClick = () => {
    if (currency === 'BNB') {
      // For BNB, leave enough for gas (0.001 BNB)
      const maxAmount = Math.max(0, availableForSending - 0.001);
      setSendAmount(maxAmount.toFixed(6));
    } else {
      // For USDT, use available amount (excluding savings)
      const maxAmount = Math.max(0, availableForSending);
      setSendAmount(maxAmount.toFixed(2));
      
      // Show info toast if funds are in savings
      if (totalSavedAmount > 0 && availableForSending < effectiveBalance) {
        toast({
          title: 'Savings Protected',
          description: `${totalSavedAmount.toFixed(2)} USDT is locked in savings goals and excluded from available balance`,
        });
      }
    }
  };

  return (
    <>
      {/* Transaction Confirmation Dialog */}
      <TransactionConfirmationDialog
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmedSend}
        loading={sendMutation.isPending}
        address={sendAddress}
        amount={sendAmount}
        currency={currency}
        gasEstimate={gasEstimate}
        bnbBalance={bnbBalance}
        usdtBalance={usdtBalance}
      />

      {/* Main Send/Receive Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Send & Receive Crypto</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Transfer BNB and USDT on the Binance Smart Chain
            </DialogDescription>
          </DialogHeader>
          
          {isConnected && chainId !== 56 && (
            <Alert className="mb-4 border-warning/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please switch to BSC Mainnet to send transactions
              </AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send" data-testid="tab-send">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Send
              </TabsTrigger>
              <TabsTrigger value="receive" data-testid="tab-receive">
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Receive
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="send" className="space-y-4 mt-4">
              {/* Currency Selector */}
              {isConnected && (
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={(value) => setCurrency(value as 'USDT' | 'BNB')}>
                    <SelectTrigger data-testid="select-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USDT">USDT (BEP-20)</SelectItem>
                      <SelectItem value="BNB">BNB (Native)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Balance Display */}
              <div className="p-3 bg-muted rounded-md">
                <div className="space-y-2">
                  {currency === 'USDT' && totalSavedAmount > 0 ? (
                    <>
                      {/* Detailed breakdown for USDT with savings */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total Balance</span>
                          <span className="font-mono">{effectiveBalance.toFixed(2)} USDT</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <PiggyBank className="w-3 h-3" />
                            Locked in Savings
                          </span>
                          <span className="font-mono text-warning">-{totalSavedAmount.toFixed(2)} USDT</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="flex items-center gap-2">
                            Available to Send
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">
                                    {totalSavedAmount.toFixed(2)} USDT is protected in your savings goals. 
                                    Withdraw from savings first if you need to send these funds.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                          <span className="font-mono text-primary">
                            {availableForSending.toFixed(2)} USDT
                          </span>
                        </div>
                      </div>
                      {isConnected && (
                        <div className="flex items-center justify-between text-sm pt-1 border-t">
                          <span className="text-muted-foreground">BNB (for gas)</span>
                          <span className="font-mono">{parseFloat(bnbBalance).toFixed(6)} BNB</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Simple display for BNB or USDT without savings */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Available {currency}
                        </span>
                        <span className="font-mono font-semibold">
                          {currency === 'BNB' 
                            ? `${parseFloat(bnbBalance).toFixed(6)} BNB`
                            : `${availableForSending.toFixed(2)} USDT`
                          }
                        </span>
                      </div>
                      {isConnected && currency === 'USDT' && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">BNB (for gas)</span>
                          <span className="font-mono">{parseFloat(bnbBalance).toFixed(6)} BNB</span>
                        </div>
                      )}
                    </>
                  )}
                  {isLoadingSavings && currency === 'USDT' && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading savings information...
                    </div>
                  )}
                </div>
              </div>
            
              
              {/* Recipient Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Recipient Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value)}
                  className={`font-mono ${sendAddress && !isAddressValid ? 'border-destructive' : ''}`}
                  data-testid="input-recipient-address"
                />
                {sendAddress && !isAddressValid && (
                  <p className="text-xs text-destructive">Invalid wallet address</p>
                )}
              </div>
              
              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currency})</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step={currency === 'BNB' ? '0.000001' : '0.01'}
                    placeholder={currency === 'BNB' ? '0.000000' : '0.00'}
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="font-mono pr-16"
                    data-testid="input-amount"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
                    onClick={handleMaxClick}
                    data-testid="button-max"
                    type="button"
                  >
                    MAX
                  </Button>
                </div>
              </div>
              
              {/* Savings Protection Alert */}
              {currency === 'USDT' && totalSavedAmount > 0 && sendAmount && parseFloat(sendAmount) > availableForSending && parseFloat(sendAmount) <= effectiveBalance && (
                <Alert className="border-warning/50 bg-warning/5">
                  <PiggyBank className="h-4 w-4" />
                  <AlertDescription>
                    This amount includes {totalSavedAmount.toFixed(2)} USDT locked in savings goals. 
                    Withdraw from savings first if you need to send these funds.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Gas Estimate Display */}
              <div className="space-y-2 p-3 bg-muted rounded-md">
                {gasEstimate ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gas Fee</span>
                      <span className="font-mono">{gasEstimate.totalCostBNB} BNB</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gas Price</span>
                      <span className="font-mono text-xs">{gasEstimate.gasPrice} Gwei</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-mono">~${gasEstimate.totalCostUSD}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Network Fee</span>
                    <span className="font-mono text-xs">
                      {isEstimatingGas ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Estimating...
                        </span>
                      ) : isConnected ? (
                        'Enter details to estimate'
                      ) : (
                        'Demo mode - no gas fees'
                      )}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Transaction Hash Display (if exists) */}
              {transactionHash && (
                <Alert className="border-green-500/50">
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">Transaction Submitted!</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono">{transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://bscscan.com/tx/${transactionHash}`, '_blank')}
                          className="h-6 px-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Send Button */}
              <Button 
                onClick={handleSend} 
                className="w-full" 
                disabled={
                  sendMutation.isPending || 
                  !sendAddress || 
                  !sendAmount || 
                  (isConnected && (!isAddressValid || chainId !== 56))
                }
                data-testid="button-confirm-send"
              >
                {sendMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Transaction...
                  </span>
                ) : (
                  `Send ${currency}`
                )}
              </Button>
              
              {/* Demo Mode Notice */}
              {!isConnected && (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Running in demo mode. Connect your wallet for real blockchain transactions.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            {/* Receive Tab */}
            <TabsContent value="receive" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Your Wallet Address</Label>
                <div className="flex gap-2">
                  <Input
                    value={myAddress || 'Connect wallet to see address'}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-wallet-address"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyAddress}
                    data-testid="button-copy"
                    type="button"
                    disabled={!myAddress}
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {myAddress ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md">
                  <div className="p-4 bg-white rounded-md">
                    <QRCodeSVG 
                      value={myAddress} 
                      size={192}
                      level="H"
                      includeMargin={true}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Scan this QR code to receive crypto
                  </p>
                </div>
              ) : (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Connect your wallet to receive cryptocurrency
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Network Info */}
              {isConnected && (
                <div className="p-3 bg-muted rounded-md space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-medium">
                      {chainId === 56 ? 'BSC Mainnet' : `Chain ID: ${chainId}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USDT Contract</span>
                    <span className="font-mono text-xs">0x55d3...7955</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}