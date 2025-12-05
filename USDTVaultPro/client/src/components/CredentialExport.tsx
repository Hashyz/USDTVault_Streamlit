import { useState, useEffect } from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Lock, Key, Shield } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import CryptoJS from 'crypto-js';
import { Checkbox } from '@/components/ui/checkbox';
import PinModal from '@/components/PinModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CredentialExport() {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [includePrivateKey, setIncludePrivateKey] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pendingExport, setPendingExport] = useState(false);

  const { data: credentials } = useQuery({
    queryKey: ['/api/credentials/export'],
    queryFn: () => apiRequest('/api/credentials/export', 'GET'),
  });

  // Query to check PIN status
  const { data: pinStatus } = useQuery({
    queryKey: ['/api/auth/pin/status'],
    retry: 1,
  });

  // Query to get imported private key (only when PIN is verified)
  const { data: privateKeyData, refetch: refetchPrivateKey } = useQuery({
    queryKey: ['/api/wallet/imported-key'],
    enabled: false, // Only fetch when explicitly called
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!password) {
        throw new Error('Password is required');
      }

      // If including private key, ensure PIN was verified
      if (includePrivateKey && !pinVerified) {
        throw new Error('PIN verification required for private key export');
      }

      let privateKey = null;
      if (includePrivateKey && pinVerified) {
        // Fetch private key after PIN verification
        const keyData = await refetchPrivateKey();
        privateKey = keyData.data?.privateKey;
      }

      // Encrypt credentials with AES encryption using CryptoJS
      const dataToEncrypt = JSON.stringify({
        ...credentials,
        privateKey: privateKey,
        includesPrivateKey: includePrivateKey && !!privateKey,
        timestamp: new Date().toISOString(),
      });
      
      // Double encryption when private key is included
      let finalEncryptedData = CryptoJS.AES.encrypt(dataToEncrypt, password).toString();
      
      // Add additional encryption layer using PIN if private key is included
      if (includePrivateKey && pinVerified) {
        // Add a salt to make the encryption stronger
        const saltedData = JSON.stringify({
          data: finalEncryptedData,
          salt: CryptoJS.lib.WordArray.random(128/8).toString(),
        });
        finalEncryptedData = CryptoJS.AES.encrypt(saltedData, password + '-pin-verified').toString();
      }
      
      const encrypted = {
        encryptedData: finalEncryptedData,
        encrypted: true,
        version: includePrivateKey ? '2.0' : '1.0', // Version 2.0 includes private key
        algorithm: 'AES', // Specify encryption algorithm
        includesPrivateKey: includePrivateKey && !!privateKey,
        requiresPinImport: includePrivateKey && !!privateKey,
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(encrypted, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usdt-wallet-backup${includePrivateKey ? '-with-key' : ''}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Export Successful',
        description: includePrivateKey 
          ? 'Your credentials with private key have been encrypted and exported successfully.'
          : 'Your credentials have been encrypted and exported successfully.',
      });
      setPassword('');
      setIncludePrivateKey(false);
      setPinVerified(false);
      setPendingExport(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export credentials',
        variant: 'destructive',
      });
      setPinVerified(false);
      setPendingExport(false);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importFile || !password) {
        throw new Error('File and password are required');
      }

      const text = await importFile.text();
      const data = JSON.parse(text);

      if (!data.encrypted || !data.encryptedData) {
        throw new Error('Invalid backup file');
      }

      try {
        let decryptedData = data.encryptedData;
        
        // Handle version 2.0 files (with private key)
        if (data.version === '2.0' && data.requiresPinImport) {
          // First layer decryption with PIN verification
          const firstDecrypt = CryptoJS.AES.decrypt(decryptedData, password + '-pin-verified');
          const firstDecryptStr = firstDecrypt.toString(CryptoJS.enc.Utf8);
          
          if (!firstDecryptStr) {
            throw new Error('Decryption failed - this backup requires PIN verification');
          }
          
          const saltedData = JSON.parse(firstDecryptStr);
          decryptedData = saltedData.data;
        }

        // Decrypt with AES using CryptoJS
        const decryptedBytes = CryptoJS.AES.decrypt(decryptedData, password);
        const finalDecryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);
        
        if (!finalDecryptedData) {
          throw new Error('Decryption failed - invalid password');
        }
        
        const decrypted = JSON.parse(finalDecryptedData);
        
        // Import credentials to backend
        await apiRequest('/api/credentials/import', 'POST', {
          encryptedCredentials: decrypted.encryptedCredentials,
          privateKey: decrypted.privateKey, // Include private key if present
        });

        return true;
      } catch (e: any) {
        if (e.message.includes('PIN verification')) {
          throw e;
        }
        throw new Error('Invalid password or corrupted file');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Import Successful',
        description: 'Your credentials have been decrypted and imported successfully.',
      });
      setPassword('');
      setImportFile(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import credentials',
        variant: 'destructive',
      });
    },
  });

  // Effect to handle export after PIN verification
  // This ensures the state updates are complete before triggering the export
  useEffect(() => {
    if (pinVerified && pendingExport) {
      // Small delay to ensure all state updates are complete
      const timer = setTimeout(() => {
        setPendingExport(false);
        exportMutation.mutate();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pinVerified, pendingExport, exportMutation]);

  const handleExport = () => {
    // If including private key and PIN is set up, require PIN verification
    if (includePrivateKey && pinStatus?.hasPinSetup && !pinVerified) {
      setPendingExport(true); // Set flag to indicate export is pending
      setShowPinModal(true);
    } else {
      exportMutation.mutate();
    }
  };

  const handlePinSuccess = (verified: boolean) => {
    if (verified) {
      setPinVerified(true);
      setShowPinModal(false);
      // The export will be triggered by the useEffect hook
      // once the state updates are complete
    }
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Credentials</DialogTitle>
          <DialogDescription>
            Export or import your encrypted wallet credentials
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Export Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Credentials
            </h3>
            <div className="space-y-2">
              <Label htmlFor="export-password">Password (for encryption)</Label>
              <Input
                id="export-password"
                type="password"
                placeholder="Enter a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-export-password"
              />
              <p className="text-xs text-muted-foreground">
                This password will be used to encrypt your credentials
              </p>
            </div>
            
            {/* Include Private Key Option */}
            <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
              <Checkbox
                id="include-private-key"
                checked={includePrivateKey}
                onCheckedChange={(checked) => {
                  setIncludePrivateKey(checked as boolean);
                  if (!checked) setPinVerified(false);
                }}
                data-testid="checkbox-include-private-key"
              />
              <div className="flex-1">
                <label 
                  htmlFor="include-private-key" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  Include Private Key
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Export your imported wallet's private key (requires PIN verification)
                </p>
              </div>
            </div>

            {includePrivateKey && pinStatus?.hasPinSetup && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  PIN verification will be required to include your private key in the export.
                </AlertDescription>
              </Alert>
            )}

            {includePrivateKey && !pinStatus?.hasPinSetup && (
              <Alert variant="destructive">
                <AlertDescription>
                  You need to set up a PIN in Settings before you can export with private key.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleExport}
              disabled={!password || exportMutation.isPending || (includePrivateKey && !pinStatus?.hasPinSetup)}
              className="w-full"
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportMutation.isPending ? 'Exporting...' : 'Export Credentials'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Credentials
            </h3>
            <div className="space-y-2">
              <Label htmlFor="import-file">Backup File</Label>
              <Input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                data-testid="input-import-file"
              />
              {importFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-password">Password (for decryption)</Label>
              <Input
                id="import-password"
                type="password"
                placeholder="Enter your backup password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-import-password"
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={!password || !importFile || importMutation.isPending}
              className="w-full"
              variant="outline"
              data-testid="button-import"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importMutation.isPending ? 'Importing...' : 'Import Credentials'}
            </Button>
          </div>

          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="flex items-center gap-2 font-medium">
              <Lock className="w-3 h-3" />
              Security Note
            </p>
            <p className="mt-1 text-muted-foreground">
              Your credentials are encrypted before export. Keep your password safe - 
              you'll need it to import your credentials later. Private key exports have 
              additional encryption for extra security.
            </p>
          </div>
        </div>
      </DialogContent>

      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        mode="verify"
        onSuccess={handlePinSuccess}
        title="PIN Required"
        description="Enter your PIN to export credentials with private key"
      />
    </>
  );
}