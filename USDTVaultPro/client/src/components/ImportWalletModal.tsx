import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import PinModal from '@/components/PinModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  Key,
  Shield,
  Trash2,
  Upload,
  Copy,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface ImportWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (address: string) => void;
}

const importSchema = z.object({
  privateKey: z.string()
    .trim()
    .refine((key) => {
      const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
      return /^[0-9a-fA-F]{64}$/.test(cleanKey);
    }, 'Private key must be 64 hex characters (with or without 0x prefix)'),
});

type ImportFormData = z.infer<typeof importSchema>;

export default function ImportWalletModal({ 
  open, 
  onOpenChange, 
  onImportSuccess 
}: ImportWalletModalProps) {
  const { toast } = useToast();
  const { getAuthHeaders } = useAuth();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importedAddress, setImportedAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const form = useForm<ImportFormData>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      privateKey: '',
    },
  });

  // Clear local state when modal closes
  useEffect(() => {
    if (!open) {
      // Clear local state when modal closes
      setImportedAddress(null);
      setShowPrivateKey(false);
      setCopied(false);
      setShowDeleteConfirmation(false);
      setShowPinModal(false);
      setPinVerified(false);
      form.reset();
    }
  }, [open, form]);

  // Query to check if wallet is already imported
  const { data: walletData, refetch: refetchWalletData } = useQuery({
    queryKey: ['/api/wallet/imported-address'],
    enabled: open,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache the data (gcTime replaces cacheTime in React Query v5)
  });

  // Query to check PIN status
  const { data: pinStatus } = useQuery({
    queryKey: ['/api/auth/pin/status'],
    enabled: open,
    retry: 1,
  });

  const importMutation = useMutation({
    mutationFn: async (data: ImportFormData) => {
      return apiRequest('/api/wallet/import', 'POST', { privateKey: data.privateKey });
    },
    onSuccess: async (data) => {
      // Set the imported address
      setImportedAddress(data.address);
      form.reset();
      
      // Remove and invalidate the query to force fresh data
      queryClient.removeQueries({ queryKey: ['/api/wallet/imported-address'] });
      
      // Trigger parent component to refresh
      if (onImportSuccess) {
        onImportSuccess(data.address);
      }
      
      // Show success toast
      toast({
        title: 'Wallet Imported Successfully',
        description: `Your wallet ${data.address.slice(0, 6)}...${data.address.slice(-4)} has been imported securely.`,
      });
      
      // Close modal after a short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        setImportedAddress(null); // Clear after closing
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import wallet. Please check your private key.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/wallet/imported', 'DELETE');
    },
    onSuccess: async () => {
      // Clear all local state immediately
      setImportedAddress(null);
      setShowDeleteConfirmation(false);
      setCopied(false);
      
      // Remove the query from cache completely
      queryClient.removeQueries({ queryKey: ['/api/wallet/imported-address'] });
      
      // Trigger the parent component to refresh its state after removal
      if (onImportSuccess) {
        onImportSuccess(''); // Empty string signals wallet was removed
      }
      
      // Show success toast
      toast({
        title: 'Wallet Removed',
        description: 'Your imported wallet has been removed from the application.',
      });
      
      // Close modal immediately
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Removal Failed',
        description: error.message || 'Failed to remove imported wallet.',
        variant: 'destructive',
      });
    },
  });

  const handleImport = (data: ImportFormData) => {
    importMutation.mutate(data);
  };

  const handleDelete = () => {
    // Check if PIN is set up, if yes require verification
    if (pinStatus?.hasPinSetup) {
      setShowPinModal(true);
    } else {
      // No PIN set, proceed directly to confirmation
      setShowDeleteConfirmation(true);
    }
  };

  const handlePinSuccess = (verified: boolean) => {
    if (verified) {
      setPinVerified(true);
      setShowPinModal(false);
      setShowDeleteConfirmation(true);
    }
  };

  const confirmDelete = () => {
    deleteMutation.mutate();
    setShowDeleteConfirmation(false);
    setPinVerified(false);
  };

  const copyAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasImportedWallet = walletData?.hasImportedWallet || importedAddress;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              {hasImportedWallet ? 'Manage Imported Wallet' : 'Import Private Key'}
            </DialogTitle>
            <DialogDescription>
              {hasImportedWallet 
                ? 'Your wallet is securely stored and encrypted on our servers.'
                : 'Import your BSC wallet using your private key to enable on-chain transactions.'
              }
            </DialogDescription>
          </DialogHeader>

        {hasImportedWallet ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Imported Wallet Address</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                  {importedAddress || walletData?.address}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyAddress}
                  data-testid="button-copy-imported-address"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Security Info</AlertTitle>
              <AlertDescription>
                Your private key is encrypted using AES-256 encryption and stored securely. 
                Never share your private key with anyone.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-modal"
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-remove-wallet"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Wallet
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Alert className="border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>Security Warning</AlertTitle>
              <AlertDescription className="space-y-2 mt-2">
                <p className="text-xs">
                  • Never share your private key with anyone
                </p>
                <p className="text-xs">
                  • Ensure you're on the correct website
                </p>
                <p className="text-xs">
                  • Your key will be encrypted and stored securely
                </p>
                <p className="text-xs">
                  • Consider using a separate wallet for this app
                </p>
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleImport)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="privateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Private Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPrivateKey ? 'text' : 'password'}
                            placeholder="Enter your BSC private key..."
                            className="font-mono pr-20"
                            autoComplete="off"
                            data-testid="input-private-key"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1 h-7 text-xs"
                            onClick={() => setShowPrivateKey(!showPrivateKey)}
                            data-testid="button-toggle-visibility"
                          >
                            {showPrivateKey ? 'Hide' : 'Show'}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your private key (64 hex characters, with or without 0x prefix)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={importMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={importMutation.isPending}
                    data-testid="button-import"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importMutation.isPending ? 'Importing...' : 'Import Wallet'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remove Imported Wallet
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the imported wallet? This action cannot be undone.
              <div className="mt-3 p-3 border rounded-md bg-destructive/10 border-destructive/30">
                <div className="text-sm text-destructive font-medium">Warning:</div>
                <ul className="text-xs mt-1 space-y-1 text-destructive/90">
                  <li>• Your wallet address will be removed from the application</li>
                  <li>• All wallet-related data will be permanently deleted</li>
                  <li>• You'll need to re-import your private key to use wallet features again</li>
                  <li>• Make sure you have backed up your private key before proceeding</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowDeleteConfirmation(false)}
              data-testid="button-cancel-deletion"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-deletion"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        mode="verify"
        onSuccess={handlePinSuccess}
        title="PIN Required"
        description="Enter your PIN to remove the imported wallet"
      />
    </>
  );
}